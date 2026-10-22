#!/usr/bin/env python3
"""WASEDA CALENDAR — official men's TOP matches -> JSON and iCalendar.

Source of truth: https://www.waseda-afc.jp/game-men
Supplemental cross-check: official monthly calendar (not a source of blind overwrites).
No training sessions, FC, I-League or women's matches.
Any fetch/parse/validation failure exits before replacing published files.
"""
from __future__ import annotations
import calendar
import datetime as dt
import hashlib
import json
import re
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

from lxml import html

ROOT = Path(__file__).resolve().parent
JST = dt.timezone(dt.timedelta(hours=9))
RESULTS_URL = "https://www.waseda-afc.jp/game-men"
CALENDAR_URL = "https://www.waseda-afc.jp/calendar/calendar-men.cgi"
SOURCE_NAME = "早稲田大学ア式蹴球部（男子TOP）"
COMPETITIONS = [
    "関東大学サッカーリーグ",
    "総理大臣杯",
    "アミノバイタルカップ",
    "定期交流戦",
    "天皇杯",
]
JP_WEEKDAYS = "月火水木金土日"

def norm(x):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(x or ""))).strip()

def text(el):
    return norm(el.text_content()) if hasattr(el, "text_content") else norm(el)

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "WasedaCalendar/1.0 (+https://silovar-uk.github.io/worksportfolio/waseda-calendar/)",
        "Accept": "text/html,application/xhtml+xml",
    })
    with urllib.request.urlopen(req, timeout=35) as res:
        data = res.read()
    if len(data) < 500:
        raise RuntimeError("Official source returned an unexpectedly short document: " + url)
    return html.fromstring(data)

def match_date(raw, year):
    m = re.search(r"(\d{1,2})月\s*(\d{1,2})日(?:\s*\(([月火水木金土日])[^)]*\))?", norm(raw))
    if not m:
        return None
    month, day = int(m.group(1)), int(m.group(2))
    try:
        date = dt.date(year, month, day)
    except ValueError:
        return None
    # Exclude previous-season rows on a yearless page (e.g. Dec 2025).
    if m.group(3) and JP_WEEKDAYS[date.weekday()] != m.group(3):
        return None
    return date.isoformat()

def parse_result(raw):
    s = norm(raw).replace("−", "-").replace("–", "-").replace("—", "-").replace("ー", "-")
    m = re.search(r"(\d+)\s*-\s*(\d+)", s)
    if not m:
        return None
    a, b = int(m.group(1)), int(m.group(2))
    pk = re.search(r"PK\s*(\d+)\s*[-:]\s*(\d+)", s, re.I)
    if pk:
        return {"for": a, "against": b, "pkFor": int(pk.group(1)), "pkAgainst": int(pk.group(2))}
    # The official page's scraped text may concatenate "1 - 1" and "4 PK 5".
    m_pk_tail = re.search(r"PK\s*(\d+)", s, re.I)
    if m_pk_tail:
        second = m.group(2)
        if len(second) > 1:
            return {"for": a, "against": int(second[:-1]), "pkFor": int(second[-1]), "pkAgainst": int(m_pk_tail.group(1))}
        # Avoid fabricating a score from ambiguous PK formatting.
        return None
    return {"for": a, "against": b}

def event_id(year, competition, round_label, opponent):
    key = f"{year}|{competition}|{round_label}|{opponent}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:20]

def league_round(raw):
    s = norm(raw)
    return ("第" + s + "節") if re.fullmatch(r"\d+", s) else s

def is_allowed_table(headers):
    h = "|".join(headers)
    return "開催日" in h and "対戦相手" in h and "結果" in h and "試合会場" in h and "開始" in h

def parse_results(doc, year):
    eligible = []
    for tbl in doc.xpath("//table"):
        trs = tbl.xpath(".//tr")
        if not trs:
            continue
        headers = [text(x) for x in trs[0].xpath("./th|./td")]
        if is_allowed_table(headers):
            eligible.append(tbl)
    if len(eligible) < 3:
        raise RuntimeError(f"Expected >=3 TOP official-results tables; found {len(eligible)}")

    events = []
    for index, tbl in enumerate(eligible):
        # The result page's first tables are the men's TOP competitions, in this order.
        if index >= len(COMPETITIONS):
            break  # no I-League, FC or youth records
        competition = COMPETITIONS[index]
        for tr in tbl.xpath(".//tr")[1:]:
            fields = [text(x) for x in tr.xpath("./th|./td")]
            if len(fields) != 6:
                continue
            round_raw, date_raw, time_raw, venue, opponent, result_raw = fields
            if not opponent or opponent in {"対戦相手", "-", "未定"}:
                continue
            # Guard against another team's rows if the official HTML layout changes.
            if any(x in opponent.upper() for x in ["U22", "U-22"]):
                continue
            date = match_date(date_raw, year)
            # Empty fixture dates are meaningful, but reject rows with year/week-day mismatch.
            if date is None and re.search(r"\d{1,2}月\s*\d{1,2}日", date_raw):
                continue
            clock_m = re.search(r"(?<!\d)(\d{1,2}):(\d{2})(?!\d)", time_raw)
            clock = f"{int(clock_m.group(1)):02d}:{clock_m.group(2)}" if clock_m else None
            round_label = league_round(round_raw) if index == 0 else round_raw
            result = parse_result(result_raw)
            home_away = "HOME" if ("東伏見" in venue or "早稲田大学" in venue) else ("AWAY" if index == 0 else "NEUTRAL")
            events.append({
                "id": event_id(year, competition, round_label, opponent),
                "date": date,
                "time": clock,
                "competition": competition,
                "round": round_label,
                "opponent": opponent,
                "venue": venue or "会場未定",
                "homeAway": home_away,
                "status": "final" if result else "scheduled",
                "result": result,
                "source": RESULTS_URL,
            })
    league = [e for e in events if e["competition"] == COMPETITIONS[0]]
    if len(league) < 20 or len(events) < 23:
        raise RuntimeError(f"Official results data unexpectedly sparse: league={len(league)}, all={len(events)}")
    if len({e["id"] for e in events}) != len(events):
        raise RuntimeError("Duplicated match IDs; upstream structure may have changed")
    return events

def audit_calendar(year, events):
    """Cross-check monthly TOP fixtures. Never override the authoritative results table."""
    warnings = []
    calendar_checked = 0
    known_league = {re.search(r"第(\d+)節", e["round"]).group(1): e
                    for e in events if e["competition"] == COMPETITIONS[0] and re.search(r"第(\d+)節", e["round"])}
    now = dt.datetime.now(JST)
    # Check near-term months rather than assuming the calendar's entire year is published.
    months = sorted({(now + dt.timedelta(days=d)).strftime("%Y-%m") for d in [-35, 0, 35, 65]})
    for yearmonth in months:
        yy, mm = map(int, yearmonth.split("-"))
        if yy != year:
            continue
        try:
            doc = fetch(f"{CALENDAR_URL}?mon={mm}&year={yy}")
        except Exception as exc:
            warnings.append(f"月間カレンダーの照合を省略（{mm}月）: {exc}")
            continue
        for tr in doc.xpath("//tr"):
            cols = [text(c) for c in tr.xpath("./th|./td")]
            if len(cols) < 3 or not cols[0].isdigit():
                continue
            day = int(cols[0])
            cell = cols[2]
            if "関東大学サッカーリーグ" not in cell or "TOP" not in cell:
                continue
            for m in re.finditer(r"第\s*(\d+)\s*節[^〗】]*[〗】]\s*TOP\s*(\d{1,2}:\d{2})\s*vs\s*([^＠@【]+)", cell):
                n, tm, opponent = m.groups()
                found = known_league.get(n)
                try:
                    cdate = dt.date(yy, mm, day).isoformat()
                except ValueError:
                    continue
                calendar_checked += 1
                if found:
                    opp = norm(opponent)
                    if found["date"] and found["date"] != cdate:
                        warnings.append(f"第{n}節: 公式結果表 {found['date']} / 月間予定 {cdate}")
                    if norm(found["opponent"]) != opp:
                        warnings.append(f"第{n}節: 対戦相手の公式情報が不一致（結果表 {found['opponent']} / 予定 {opp}）")
                    if not found["date"]:
                        found["date"], found["time"] = cdate, tm
                else:
                    warnings.append(f"月間予定にある第{n}節が公式結果表に見つかりません")
    return warnings, calendar_checked

def escape_ics(s):
    return str(s or "").replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")

def folded(line):
    """RFC5545 75-octet folding, UTF-8 safe."""
    out, piece, size = [], "", 0
    for ch in line:
        n = len(ch.encode("utf-8"))
        if size + n > 73 and piece:
            out.append(piece)
            piece, size = " ", 1
        piece += ch
        size += n
    out.append(piece)
    return "\r\n".join(out)

def make_ics(events, generated_at):
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WASEDA CALENDAR//JP",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:早稲田大学ア式蹴球部 男子TOP",
        "X-WR-TIMEZONE:Asia/Tokyo",
        "BEGIN:VTIMEZONE", "TZID:Asia/Tokyo", "BEGIN:STANDARD",
        "DTSTART:19700101T000000", "TZOFFSETFROM:+0900", "TZOFFSETTO:+0900",
        "TZNAME:JST", "END:STANDARD", "END:VTIMEZONE",
    ]
    stamp = generated_at.astimezone(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    for e in events:
        if not e["date"]:
            continue
        day = dt.date.fromisoformat(e["date"])
        title = f"早稲田大学 vs {e['opponent']}｜{e['competition']}"
        desc = f"{e['competition']} {e['round']}\n会場: {e['venue']}\n公式日程: {e['source']}"
        if e["result"]:
            r = e["result"]
            desc += f"\n結果: {r['for']}–{r['against']}"
        lines.extend(["BEGIN:VEVENT", f"UID:{e['id']}@waseda-calendar",
                      f"DTSTAMP:{stamp}", f"SUMMARY:{escape_ics(title)}",
                      f"DESCRIPTION:{escape_ics(desc)}",
                      f"LOCATION:{escape_ics(e['venue'])}",
                      f"URL:{e['source']}"])
        if e["time"]:
            start = dt.datetime.strptime(e["date"] + " " + e["time"], "%Y-%m-%d %H:%M")
            end = start + dt.timedelta(hours=2)
            lines.extend([f"DTSTART;TZID=Asia/Tokyo:{start:%Y%m%dT%H%M%S}",
                          f"DTEND;TZID=Asia/Tokyo:{end:%Y%m%dT%H%M%S}"])
        else:
            lines.extend([f"DTSTART;VALUE=DATE:{day:%Y%m%d}",
                          f"DTEND;VALUE=DATE:{day + dt.timedelta(days=1):%Y%m%d}"])
        lines.extend(["END:VEVENT"])
    lines.append("END:VCALENDAR")
    return "\r\n".join(folded(x) for x in lines) + "\r\n"

def main():
    now = dt.datetime.now(JST)
    year = now.year
    doc = fetch(RESULTS_URL)
    events = parse_results(doc, year)
    warnings, checked = audit_calendar(year, events)
    events.sort(key=lambda e: (e["date"] is None, e["date"] or "9999", e["time"] or "99:99", e["competition"], e["round"]))
    data = {
        "name": SOURCE_NAME,
        "year": year,
        "updatedAt": now.isoformat(timespec="seconds"),
        "pastWindowDays": 14,
        "futureWindowDays": 60,
        "events": events,
        "sourceUrls": [RESULTS_URL, CALENDAR_URL],
        "audit": {"calendarItemsChecked": checked, "warnings": warnings},
    }
    encoded_json = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    encoded_ics = make_ics(events, now)
    # Everything is validated in memory BEFORE publication.
    assert len(events) >= 23
    assert "BEGIN:VEVENT" in encoded_ics
    assert sum(bool(e["date"]) for e in events) >= 20
    (ROOT / "schedule.json").write_text(encoded_json, encoding="utf-8")
    (ROOT / "all.ics").write_bytes(encoded_ics.encode("utf-8"))
    print(json.dumps({"events": len(events), "dated": sum(bool(e["date"]) for e in events),
                      "calendarAudits": checked, "warnings": warnings[:10]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
