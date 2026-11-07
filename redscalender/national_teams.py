"""JFA national-team fixtures. Times are Japan Standard Time.
Source: JFA 2026 schedule pages and 2027 Kirin Challenge announcement.
Do not publish postponed Asian Cup dates.
"""
import hashlib

SOURCES = {
 "japan": "https://www.jfa.jp/samuraiblue/schedule_result/2026.html",
 "japan_u21": "https://www.jfa.jp/national_team/u21/schedule_result/2026.html",
}
NAMES = {"japan":"SAMURAI BLUE（日本代表）","japan_u21":"U-21日本代表"}
LABELS = {"japan":"JAPAN","japan_u21":"JAPAN U-21"}
# date, JST kickoff (None = not announced), opponent, competition, venue, source
FIXTURES = {
 "japan": [
  ("2026-11-14","19:15","ブラジル","MIZUHO BLUE CHALLENGE","シンガポールナショナルスタジアム","https://www.jfa.jp/samuraiblue/20261117/about.html"),
  ("2026-11-17","22:10","パラグアイ","MIZUHO BLUE CHALLENGE","シンガポールナショナルスタジアム","https://www.jfa.jp/samuraiblue/20261117/about.html"),
  ("2026-12-30",None,"対戦相手未定","キリンチャレンジカップ2026","パナソニック スタジアム 吹田",SOURCES["japan"]),
  ("2027-03-25",None,"対戦相手未定","キリンチャレンジカップ2027","エディオンピースウイング広島","https://jfa.jp/samuraiblue_2026/news/00036981/"),
  ("2027-03-30",None,"対戦相手未定","キリンチャレンジカップ2027","国立競技場","https://jfa.jp/samuraiblue_2026/news/00036981/"),
 ],
 "japan_u21": [
  ("2026-11-14","03:00","U-21スペイン代表","国際親善試合","Estadio Francisco de la Hera（スペイン）","https://www.jfa.jp/national_team/mens_all_2026/news/00036989/"),
  ("2026-11-18","01:00","U-21エジプト代表","国際親善試合","Petro Sport Stadium（エジプト）","https://www.jfa.jp/national_team/mens_all_2026/news/00036989/"),
 ],
}

def fixtures():
    result={}
    for team, games in FIXTURES.items():
        rows=[]
        for date,time,opponent,competition,venue,source in games:
            key=f"{team}|{date}|{competition}|{opponent}"
            rows.append({
                "uid":hashlib.sha256(key.encode()).hexdigest()[:24]+"@redscalender",
                "team":team,"competition":competition,"opponent":opponent,
                "side":"NEUTRAL","date":date,"time":time,"venue":venue,
                "raw_date":date,"source":source
            })
        result[team]=rows
    return result
