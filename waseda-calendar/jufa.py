"""Supplement men's TOP league scores from JUFA Kanto's official result reports.

The Waseda game-men fixture page is a reliable schedule but score posting can lag.
Only certified first-division match reports are parsed. Do NOT invent results.
"""
from __future__ import annotations
import datetime as dt
import json
from pathlib import Path
import re
import unicodedata
import urllib.parse

JUFA_LEAGUE_URL = "https://www.jufa-kanto.jp/league/"
JUFA_DOMAIN = "www.jufa-kanto.jp"
LEAGUE_COMPETITION = "関東大学サッカーリーグ"
TEAM = "早稲田大学"


def norm(value):
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).split())


def compact(value):
    return norm(value).replace(" ", "").replace("　", "")


def score_pair(result):
    return (result["for"], result["against"], result.get("pkFor"), result.get("pkAgainst"))


def score_is_valid(result):
    return isinstance(result, dict) and all(
        isinstance(result.get(k), int) and not isinstance(result.get(k), bool)
        and 0 <= result[k] <= 40
        for k in ("for", "against")
    )


def match_identity(event):
    return (
        norm(event.get("competition")),
        norm(event.get("round")),
        compact(event.get("opponent")),
        event.get("date"),
    )


def candidate_articles(doc, year, limit=12):
    """Extract recent federation league-result articles from the official league index."""
    urls = []
    for link in doc.xpath('//a[contains(@href, "/news/detail/")]'):
        title = norm(link.text_content())
        if (str(year) not in title or "結果" not in title
                or "リーグ戦" not in title or not re.search(r"第\s*\d+\s*節", title)):
            continue
        href = urllib.parse.urljoin(JUFA_LEAGUE_URL, link.get("href"))
        parsed = urllib.parse.urlparse(href)
        if parsed.scheme != "https" or parsed.netloc != JUFA_DOMAIN:
            continue
        if href not in urls:
            urls.append(href)
        if len(urls) >= limit:
            break
    return urls


def extract_first_division(doc):
    """Restrict to first division, excluding similarly named teams in other leagues."""
    raw = doc.text_content()
    start = re.search(r"[〖【\[]\s*1部リーグ\s*[〗】\]]", raw)
    if not start:
        return None
    remainder = raw[start.end():]
    end = re.search(
        r"[〖【\[]\s*2部リーグ\s*[〗】\]]|リーグ戦ニュース一覧を見る|連盟について",
        remainder,
    )
    return norm(remainder[:end.start()] if end else remainder)


def article_round(doc, year):
    # Headline is the authoritative round indicator, not a body reference.
    heads = doc.xpath("//h1")
    headline = norm(heads[-1].text_content()) if heads else ""
    if str(year) not in headline or "結果" not in headline:
        return None
    if "リーグ戦" not in headline:
        return None
    m = re.search(r"第\s*(\d+)\s*節", headline)
    return "第" + m.group(1) + "節" if m else None


def article_date(doc):
    """Prefer first yyyy/mm/dd in article heading/date region, not footer links."""
    raw = norm(doc.text_content()[:5000])
    m = re.search(r"(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})", raw)
    if not m:
        return None
    try:
        return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def score_from_division(division, opponent):
    """Scores appear as Waseda 3(1-0)0 Opponent (or reversed when away)."""
    if not division:
        return None
    # Normalize compatibility ideographs, whitespace and dash variants.
    s = compact(division).replace("−", "-").replace("–", "-").replace("ー", "-")
    opp = compact(opponent)
    # The parenthesized halftime score is mandatory; prevents unanchored false positives.
    pattern = r"(\d{1,2})\((\d{1,2})-(\d{1,2})\)(\d{1,2})"
    home = re.search(re.escape(TEAM) + pattern + re.escape(opp), s)
    if home:
        return {"for": int(home.group(1)), "against": int(home.group(4))}
    away = re.search(re.escape(opp) + pattern + re.escape(TEAM), s)
    if away:
        return {"for": int(away.group(4)), "against": int(away.group(1))}
    return None


def apply_result(event, score, url, source_type, warnings, reviewed_at=None):
    if not score_is_valid(score):
        raise ValueError("Invalid official result: " + str(score))
    old = event.get("result")
    if old:
        if score_pair(old) != score_pair(score):
            warnings.append(
                f"RESULT CONFLICT {event['round']} vs {event['opponent']}: "
                f"{event['result']} (source {event.get('resultSource', event['source'])}) "
                f"vs {score} (source {url}). No automatic overwrite."
            )
        return False
    event["result"] = score
    event["status"] = "final"
    event["resultSource"] = url
    event["resultSourceType"] = source_type
    if reviewed_at:
        event["resultCheckedAt"] = reviewed_at
    return True


def apply_archived_results(events, archive, warnings):
    """Explicit one-time, source-cited exceptions for federation publications."""
    updated = 0
    for verified in archive:
        matches = [
            e for e in events if
            match_identity(e) == (
                LEAGUE_COMPETITION,
                verified["round"],
                compact(verified["opponent"]),
                verified["date"],
            )
        ]
        if len(matches) != 1:
            raise RuntimeError("Archived result cannot be uniquely matched: " + str(verified))
        target = matches[0]
        if apply_result(
            target, verified["result"], verified["url"], "jufa-verified-archive",
            warnings, verified.get("verifiedAt"),
        ):
            updated += 1
    return updated


def apply_previous_results(events, previous, warnings):
    """Do not regress a certified result if the slower schedule loses its score.

    Only restore matches with identical competition, round, opponent and date.
    """
    old_by_id = {match_identity(e): e for e in previous}
    recovered = 0
    for e in events:
        if e.get("result"):
            continue
        old = old_by_id.get(match_identity(e))
        if not old or not score_is_valid(old.get("result")):
            continue
        if apply_result(e, old["result"], old.get("resultSource") or old["source"],
                        "previously-verified", warnings, old.get("resultCheckedAt")):
            recovered += 1
    return recovered


def merge_federation_results(events, year, now, fetch_document, archive, previous):
    """Return audit. Each source fail or mismatch is visible, never silently discarded."""
    warnings = []
    archive_count = apply_archived_results(events, archive, warnings)
    previous_count = apply_previous_results(events, previous, warnings)

    recent = [
        e for e in events if
        e["competition"] == LEAGUE_COMPETITION and e.get("date")
        and 0 <= (now.date() - dt.date.fromisoformat(e["date"])).days <= 35
    ]
    # Check certified reports even if schedule already has a score: detect conflicts.
    candidate_rounds = {e["round"] for e in recent}
    found_rounds, matched_scores = set(), 0
    try:
        doc = fetch_document(JUFA_LEAGUE_URL)
        urls = candidate_articles(doc, year)
        if not urls:
            warnings.append("JUFA news listing contained no qualifying recent league-result reports")
        for url in urls:
            try:
                article = fetch_document(url)
                round_label = article_round(article, year)
                if round_label not in candidate_rounds:
                    continue
                candidates = [e for e in recent if e["round"] == round_label]
                if len(candidates) != 1:
                    warnings.append(f"Ambiguous federation match, round {round_label}")
                    continue
                e = candidates[0]
                # A published round can have different match dates; limit evidence to a
                # 0..3-day publication window for this fixture, not just round number.
                published_date = article_date(article)
                if published_date:
                    match_day = dt.date.fromisoformat(e["date"])
                    if not (0 <= (published_date - match_day).days <= 3):
                        continue
                division = extract_first_division(article)
                result = score_from_division(division, e["opponent"])
                if not result:
                    continue
                found_rounds.add(round_label)
                if apply_result(e, result, url, "jufa-report", warnings,
                                now.isoformat(timespec="seconds")):
                    matched_scores += 1
            except Exception as exc:
                warnings.append(f"JUFA article could not be verified: {url}: {exc}")
    except Exception as exc:
        warnings.append(f"JUFA league-news fetch failed: {exc}")
    return {
        "archiveMatchesApplied": archive_count,
        "previousResultsRecovered": previous_count,
        "liveFederationResultsApplied": matched_scores,
        "federationRoundsChecked": len(found_rounds),
        "warnings": warnings,
    }


def result_gaps(events, now):
    """Flag all league results still unknown >6h after scheduled final whistle."""
    out = []
    for e in events:
        if e["competition"] != LEAGUE_COMPETITION or not e.get("date") or e.get("result"):
            continue
        try:
            game_day = dt.date.fromisoformat(e["date"])
            time = dt.time.fromisoformat(e["time"]) if e.get("time") else dt.time(14, 0)
            kickoff = dt.datetime.combine(game_day, time, tzinfo=dt.timezone(dt.timedelta(hours=9)))
        except ValueError:
            continue
        if now >= kickoff + dt.timedelta(hours=8):
            out.append(f"{e['date']} {e['round']} vs {e['opponent']}")
    return out
