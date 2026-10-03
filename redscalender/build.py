"""Build REDS CALENDAR from official schedules.

Targets
- men: Urawa Reds top team
- ladies: Mitsubishi Heavy Industries Urawa Reds Ladies
- u21: Urawa Reds U-21
- youth: Urawa Reds Youth, Prince League only

Run:
    python -m pip install lxml
    python redscalender/build.py

The script writes files only after every source has fetched and parsed successfully.
A failed fetch/parse therefore leaves the currently published calendar intact.
"""

import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import urllib.request
import unicodedata

from lxml import html as dom

ROOT = Path(__file__).resolve().parent
JST = dt.timezone(dt.timedelta(hours=9))
MATCH_DURATION = dt.timedelta(hours=2)

SOURCES = {
    "men": "https://www.urawa-reds.co.jp/game/",
    "ladies": "https://www.urawa-reds.co.jp/redsladies/gameresults/2026.html",
    "u21": "https://www.urawa-reds.co.jp/game/",
    "youth": "https://www.urawa-reds.co.jp/reds_ikusei/youth_games/2026.html",
}
NAMES = {
    "men": "浦和レッズ",
    "ladies": "三菱重工浦和レッズレディース",
    "u21": "浦和レッズ U-21",
    "youth": "浦和レッズユース",
}
LABELS = {
    "men": "MEN",
    "ladies": "LADIES",
    "u21": "U-21",
    "youth": "YOUTH",
}
TEAM_ORDER = ("men", "ladies", "u21", "youth")
PRINCE_NAME = "高円宮杯 JFA U-18サッカープリンスリーグ 2026関東1部"


def norm(value):
    return " ".join(unicodedata.normalize("NFKC", str(value or "")).split())


def txt(el):
    return norm(el.text_content())


def cls(el, name):
    return el.xpath(
        './/*[contains(concat(" ", normalize-space(@class), " "), " ' + name + ' ")]'
    )


def fetch(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "RedsCalendar/2.0 (+https://silovar-uk.github.io/worksportfolio/redscalender/)"
        },
    )
    with urllib.request.urlopen(req, timeout=40) as response:
        return dom.fromstring(response.read())


def infer_season_year(month):
    return 2026 if int(month) >= 7 else 2027


def make(team, comp, opp, side, date_parts, time, venue, raw_date, ambiguous=False):
    date = None
    if date_parts and not ambiguous:
        date = dt.date(*map(int, date_parts)).isoformat()

    comp = re.sub(r"【.*?】", "", norm(comp)).strip()
    opp = norm(opp) or "対戦相手未定"
    side = norm(side) or "UNSPECIFIED"
    venue = norm(venue) or "会場未定"
    time = time.zfill(5) if time else None

    key = f"{team}|{comp}|{opp}|{side}"
    return {
        "uid": hashlib.sha256(key.encode()).hexdigest()[:24] + "@redscalender",
        "team": team,
        "competition": comp,
        "opponent": opp,
        "side": side,
        "date": date,
        "time": time,
        "venue": venue,
        "raw_date": norm(raw_date),
        "source": SOURCES[team],
    }


def parse_ladies(doc):
    rows = []
    for block in cls(doc, "gameresult_list"):
        headings = cls(block, "gameresult_h5")
        opponents = cls(block, "gameresult_team-name")
        dates = cls(block, "gameresult_date")
        if not headings or not opponents or not dates:
            continue
        heading = headings[0]
        comp = txt(heading)
        opponent = txt(opponents[0])
        raw = txt(dates[0])
        if "・" in raw:
            datepart, venue = raw.rsplit("・", 1)
        else:
            datepart, venue = raw, "会場未定"
        d = re.search(r"(\d{4})/(\d{1,2})/(\d{1,2})", datepart)
        t = re.search(r"\b(\d{1,2}:\d{2})\b", datepart)
        side = "HOME" if "home" in heading.get("class", "").split() else "AWAY"
        ambiguous = bool(re.search(r"\bor\b", datepart, re.I))
        rows.append(
            make(
                "ladies",
                comp,
                opponent,
                side,
                d.groups() if d else None,
                t.group(1) if t else None,
                venue,
                raw,
                ambiguous,
            )
        )
    return rows


def parse_game_block(team, block):
    paragraphs = block.xpath("./p")
    date_nodes = cls(block, "bs-text-35")
    venue_nodes = cls(block, "bs-text-md-16")
    if not paragraphs or not date_nodes or not venue_nodes:
        return None

    full = txt(block)
    if "KICK OFF" not in full:
        return None

    comp = txt(paragraphs[0])
    if team == "men" and "U-21Jリーグ" in comp:
        return None
    if team == "u21" and "U-21Jリーグ" not in comp:
        return None

    datepart = " ".join(txt(node) for node in date_nodes)
    d = re.search(r"(\d{1,2})/(\d{1,2})", datepart)
    date_parts = None
    if d:
        year = infer_season_year(d.group(1))
        date_parts = (year, d.group(1), d.group(2))

    t = re.search(r"KICK OFF\s*(\d{1,2}:\d{2})", full)
    venue = txt(venue_nodes[0])
    opponents = block.xpath('.//p[contains(@class,"bs-mx-10")]')
    opponent = txt(opponents[0]) if opponents else "対戦相手未定"
    side = (
        "HOME"
        if re.search(r"\bHOME\b", full)
        else "AWAY"
        if re.search(r"\bAWAY\b", full)
        else "NEUTRAL"
    )
    ambiguous = bool(re.search(r"\bor\b", datepart, re.I)) or datepart == "未定"
    return make(
        team,
        comp,
        opponent,
        side,
        date_parts,
        t.group(1) if t else None,
        venue,
        datepart,
        ambiguous,
    )


def parse_game_page(team, doc):
    rows = []
    for block in doc.xpath('//*[@data-category]'):
        category = norm(block.get("data-category", "")).lower()
        if team == "u21" and category != "u-21":
            continue
        if team == "men" and category == "u-21":
            continue
        row = parse_game_block(team, block)
        if row:
            rows.append(row)

    deduped = {}
    for row in rows:
        deduped[row["uid"]] = row
    return list(deduped.values())


def parse_youth(doc):
    # The youth page repeats competition names in its navigation and body, and its
    # HTML text-node boundaries are not stable. Parse the normalized competition
    # section as text rather than depending on presentation markup.
    page = txt(doc)
    starts = [match.start() for match in re.finditer(re.escape(PRINCE_NAME), page)]
    if not starts:
        raise ValueError("youth: Prince League heading not found")

    start = starts[-1] + len(PRINCE_NAME)
    end = page.find("2026Jユースカップ", start)
    section = page[start : end if end >= 0 else len(page)]

    round_matches = list(re.finditer(r"第(\\d+)節", section))
    rows = []
    for index, round_match in enumerate(round_matches):
        chunk_end = round_matches[index + 1].start() if index + 1 < len(round_matches) else len(section)
        chunk = section[round_match.end() : chunk_end]

        date_match = re.search(
            r"(2026)\\s*/\\s*(\\d{1,2})\\s*/\\s*(\\d{1,2})\\s*\\([^)]*\\)\\s*(\\d{1,2}:\\d{2})\\s*キックオフ",
            chunk,
        )
        if not date_match:
            continue

        tail = chunk[date_match.end() :]
        fixture_match = re.search(
            r"(.+?)\\s+vs\\s+(.+?)(?=\\s+[△○●■]\\s*\\d|\\s+[△○●■]\\d|$)",
            tail,
        )
        if not fixture_match:
            continue

        venue = norm(fixture_match.group(1))
        opponent = norm(fixture_match.group(2))
        # Defensive cleanup for optional links/labels that may sit immediately
        # after an opponent in the official page.
        opponent = re.sub(r"\\s+(公式記録|大会公式サイト).*$", "", opponent).strip()
        round_label = f"第{round_match.group(1)}節"
        raw_date = (
            f"{date_match.group(1)}/{date_match.group(2)}/{date_match.group(3)} "
            f"{date_match.group(4)}"
        )
        rows.append(
            make(
                "youth",
                f"{PRINCE_NAME} {round_label}",
                opponent,
                "UNSPECIFIED",
                date_match.groups()[:3],
                date_match.group(4),
                venue,
                raw_date,
                False,
            )
        )
    if not rows:
        raise ValueError(f"youth: parsed 0 fixtures; section sample={section[:1400]!r}")
    return rows

def parse(team, doc):
    if team == "ladies":
        rows = parse_ladies(doc)
    elif team in {"men", "u21"}:
        rows = parse_game_page(team, doc)
    elif team == "youth":
        rows = parse_youth(doc)
    else:
        raise ValueError(team)

    minimum = {"men": 20, "ladies": 20, "u21": 10, "youth": 18}[team]
    if len(rows) < minimum:
        raise ValueError(f"{team}: unexpected fixture count {len(rows)} < {minimum}")
    if len({row["uid"] for row in rows}) != len(rows):
        raise ValueError(f"{team}: duplicate UID")
    return rows


def escape(value):
    return (
        str(value)
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace(";", "\\;")
        .replace(",", "\\,")
    )


def fold(line):
    result = []
    current = ""
    for ch in line:
        if len((current + ch).encode()) > 75:
            result.append(current)
            current = " "
        current += ch
    return "\r\n".join(result + [current])


def display_opponent(row):
    if row["team"] == "u21":
        return re.sub(r"^U-21\s+", "", row["opponent"])
    return row["opponent"]


def event_title(row):
    side = "" if row["side"] == "UNSPECIFIED" else f"[{row['side']}] "
    return f"{side}{NAMES[row['team']]} vs {display_opponent(row)}"


def ics(calendar_name, rows, stamp):
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//redscalender//Urawa fixtures//JA",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:" + escape(calendar_name),
        "X-WR-TIMEZONE:Asia/Tokyo",
        "X-PUBLISHED-TTL:PT12H",
    ]
    for row in sorted(rows, key=lambda r: (r["date"] or "9999", r["time"] or "99:99", r["team"])):
        if not row["date"]:
            continue
        title = event_title(row)
        lines += [
            "BEGIN:VEVENT",
            "UID:" + row["uid"],
            "DTSTAMP:" + stamp,
            "LAST-MODIFIED:" + stamp,
            "SEQUENCE:" + str(row["sequence"]),
        ]
        if row["time"]:
            start = dt.datetime.fromisoformat(row["date"] + "T" + row["time"]).replace(tzinfo=JST)
            start_utc = start.astimezone(dt.timezone.utc)
            end_utc = (start + MATCH_DURATION).astimezone(dt.timezone.utc)
            lines += [
                "DTSTART:" + start_utc.strftime("%Y%m%dT%H%M%SZ"),
                "DTEND:" + end_utc.strftime("%Y%m%dT%H%M%SZ"),
            ]
            note = "終了時刻はキックオフから2時間後の目安です。"
        else:
            date = dt.date.fromisoformat(row["date"])
            title = "【時刻未定】" + title
            lines += [
                "DTSTART;VALUE=DATE:" + date.strftime("%Y%m%d"),
                "DTEND;VALUE=DATE:" + (date + dt.timedelta(days=1)).strftime("%Y%m%d"),
            ]
            note = "開始時刻未定のため終日表示しています。"
        lines += [
            "SUMMARY:" + escape(title),
            "LOCATION:" + escape(row["venue"]),
            "DESCRIPTION:"
            + escape(
                row["competition"]
                + "\n"
                + note
                + "\n非公式カレンダー。来場前に公式情報をご確認ください。\n"
                + row["source"]
            ),
            "URL:" + row["source"],
            "STATUS:CONFIRMED",
            "TRANSP:TRANSPARENT",
            "END:VEVENT",
        ]
    return "\r\n".join(fold(line) for line in lines + ["END:VCALENDAR"]) + "\r\n"


def apply_sequences(all_rows, old):
    previous_rows = {}
    for rows in old.get("teams", {}).values():
        for row in rows:
            previous_rows[row.get("uid")] = row

    tracked = ("date", "time", "venue", "opponent", "side", "competition")
    for rows in all_rows.values():
        for row in rows:
            previous = previous_rows.get(row["uid"])
            if not previous:
                row["sequence"] = 0
                continue
            changed = any(previous.get(key) != row.get(key) for key in tracked)
            row["sequence"] = previous.get("sequence", 0) + (1 if changed else 0)


def main():
    now = dt.datetime.now(JST)
    stamp = now.astimezone(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    docs = {}
    for url in sorted(set(SOURCES.values())):
        docs[url] = fetch(url)

    all_rows = {team: parse(team, docs[url]) for team, url in SOURCES.items()}

    old_path = ROOT / "schedule.json"
    old = json.loads(old_path.read_text()) if old_path.exists() else {"teams": {}}
    apply_sequences(all_rows, old)

    data = {
        "updated": now.isoformat(timespec="seconds"),
        "season": "2026/27",
        "windowDays": 60,
        "matchDurationMinutes": int(MATCH_DURATION.total_seconds() // 60),
        "teams": all_rows,
        "meta": {
            "teamOrder": list(TEAM_ORDER),
            "names": NAMES,
            "labels": LABELS,
            "youthScope": "prince-league-only",
            "youthCompetition": PRINCE_NAME,
        },
    }

    outputs = {
        "schedule.json": json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        "index.html": (ROOT / "template.html").read_text(),
    }
    for team in TEAM_ORDER:
        outputs[team + ".ics"] = ics(NAMES[team], all_rows[team], stamp)
    merged = [row for team in TEAM_ORDER for row in all_rows[team]]
    outputs["all.ics"] = ics("REDS CALENDAR｜4カテゴリー", merged, stamp)

    for name, content in outputs.items():
        (ROOT / name).write_bytes(content.encode())

    summary = {
        team: {
            "dated": sum(bool(row["date"]) for row in rows),
            "pending": sum(not row["date"] for row in rows),
        }
        for team, rows in all_rows.items()
    }
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
