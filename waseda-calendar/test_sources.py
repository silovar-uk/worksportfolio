"""Offline regression tests for federation result hydration and source conflicts."""
import datetime as dt
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from lxml import html

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import jufa
import build


class JufaChecks(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 10, 22, 9, 27,
                               tzinfo=dt.timezone(dt.timedelta(hours=9)))
        self.fixture = {
            "id": "17", "date": "2026-10-21", "time": "18:00",
            "competition": "関東大学サッカーリーグ", "round": "第17節",
            "opponent": "桐蔭横浜大学", "venue": "東伏見グラウンド",
            "result": None, "status": "scheduled", "source": build.RESULTS_URL,
        }
        self.archive = json.loads((ROOT / "verified-results.json").read_text(encoding="utf-8"))

    def test_parse_federation_listing(self):
        index = html.fromstring("""<html><body>
           <a href="/news/detail/4306/?path=path02">【結果】『JR東日本カップ2026 第100回関東大学サッカーリーグ戦』第17節1日目</a>
           <a href="/news/detail/4307">【結果】『Iリーグ2026』第17節1日目</a>
           <a href="https://evil.example/news/detail/4400">【結果】『JR東日本カップ2026 第100回関東大学サッカーリーグ戦』第17節</a>
           </body></html>""")
        self.assertEqual(
            jufa.candidate_articles(index, 2026),
            ["https://www.jufa-kanto.jp/news/detail/4306/?path=path02"]
        )

    def test_score_first_division(self):
        article = html.fromstring("""<html><h1>【結果】JR東日本カップ2026 第100回関東大学サッカーリーグ戦 第17節1日目</h1>
          <main><p>2026/10/21</p>
          <p>【1部リーグ】</p>
          <p>筑波大学 1(0-1)1 明治大学</p>
          <p>早稲田大学 3(1-0)0 桐蔭横浜大学</p>
          <p>得点者）【早大】伊藤(猛)×2、大西</p>
          <p>【2部リーグ】</p><p>早稲田大学 9(5-1)4 桐蔭横浜大学</p></main></html>""")
        self.assertEqual(jufa.article_round(article, 2026), "第17節")
        self.assertEqual(jufa.article_date(article), dt.date(2026, 10, 21))
        self.assertEqual(
            jufa.score_from_division(
                jufa.extract_first_division(article), "桐蔭横浜大学"
            ), {"for": 3, "against": 0})
        self.assertIsNone(jufa.score_from_division(
            jufa.extract_first_division(article), "日本体育大学"))

    def test_away_score_correct_orientation(self):
        self.assertEqual(jufa.score_from_division(
            "【1部リーグ】 日本体育大学 2(0-1)3 早稲田大学", "日本体育大学"
        ), {"for": 3, "against": 2})

    def test_archive_fills_blank(self):
        events = [dict(self.fixture)]
        report = jufa.merge_federation_results(
            events, 2026, self.now,
            lambda _url: (_ for _ in ()).throw(RuntimeError("offline")),
            [v for v in self.archive if v["round"] == "第17節"], []
        )
        self.assertEqual(report["archiveMatchesApplied"], 1)
        self.assertEqual(events[0]["result"], {"for": 3, "against": 0})
        self.assertEqual(events[0]["resultSource"], self.archive[0]["url"])
        self.assertEqual(jufa.result_gaps(events, self.now), [])

    def test_source_conflict_does_not_override(self):
        event = dict(self.fixture, result={"for": 2, "against": 0})
        warnings = []
        self.assertFalse(jufa.apply_result(
            event, {"for": 3, "against": 0}, self.archive[0]["url"],
            "jufa-report", warnings
        ))
        self.assertEqual(event["result"], {"for": 2, "against": 0})
        self.assertIn("RESULT CONFLICT", warnings[0])

    def test_previous_result_does_not_disappear(self):
        event = dict(self.fixture)
        previous = dict(self.fixture, result={"for": 3, "against": 0},
                        resultSource=self.archive[0]["url"])
        warnings = []
        self.assertEqual(jufa.apply_previous_results([event], [previous], warnings), 1)
        self.assertEqual(event["result"], {"for": 3, "against": 0})
        # No copying from a different opponent / different date.
        event2 = dict(self.fixture, opponent="法政大学")
        self.assertEqual(jufa.apply_previous_results([event2], [previous], warnings), 0)

    def test_pending_finished_flagged(self):
        missing = dict(self.fixture)
        self.assertEqual(len(jufa.result_gaps([missing], self.now)), 1)
        missing["result"] = {"for": 3, "against": 0}
        self.assertEqual(jufa.result_gaps([missing], self.now), [])

    def test_penalty_score_not_corrupted(self):
        # Waseda official site sometimes emits "1 – 14 PK 5" for 1-1 (PK 4-5).
        self.assertEqual(build.parse_result("1 – 14 PK 5"), {
            "for": 1, "against": 1, "pkFor": 4, "pkAgainst": 5
        })

    def test_ics_has_source_and_result(self):
        verified = dict(self.fixture, id="test", result={"for": 3, "against": 0},
                        resultSource=self.archive[0]["url"])
        feed = build.make_ics([verified], self.now)
        self.assertIn("結果: 3–0", feed.replace("\r\n ", ""))
        self.assertIn("URL:"+self.archive[0]["url"], feed.replace("\r\n ", ""))
        self.assertEqual(feed.count("BEGIN:VEVENT"), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
