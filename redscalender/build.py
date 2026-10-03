"""Refresh official 2026/27 schedules and build static iCalendar feeds.
Run: python -m pip install lxml; python redscalender/build.py
No automatic schedule is configured. Failed fetch/parse leaves published files intact.
"""
import datetime as dt
import hashlib
import html
import json
from pathlib import Path
import re
import urllib.request
import unicodedata
from lxml import html as dom
ROOT = Path(__file__).resolve().parent
SOURCES = {'ladies': 'https://www.urawa-reds.co.jp/redsladies/gameresults/2026.html', 'u21':'https://www.urawa-reds.co.jp/game/'}
NAMES = {'ladies':'三菱重工浦和レッズレディース', 'u21':'浦和レッズ U-21'}
BASE = 'https://silovar-uk.github.io/worksportfolio/redscalender/'
JST = dt.timezone(dt.timedelta(hours=9))
def norm(s): return ' '.join(unicodedata.normalize('NFKC', s).split())
def txt(el): return norm(el.text_content())
def cls(el, name): return el.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," '+name+' ")]')
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'RedsCalendar/1.0 (public fixture calendar)'})
    with urllib.request.urlopen(req,timeout=40) as r: return dom.fromstring(r.read())
def parse(team, doc):
    rows=[]
    if team=='ladies':
        for block in cls(doc,'gameresult_list'):
            heading=cls(block,'gameresult_h5')[0]; comp=txt(heading)
            opponent=txt(cls(block,'gameresult_team-name')[0]); raw=txt(cls(block,'gameresult_date')[0])
            datepart,venue=raw.rsplit('・',1)
            d=re.search(r'(\d{4})/(\d{1,2})/(\d{1,2})',datepart)
            t=re.search(r'\b(\d{1,2}:\d{2})\b',datepart)
            side='HOME' if 'home' in heading.get('class','').split() else 'AWAY'
            rows.append(make(team,comp,opponent,side,d.groups() if d else None,t.group(1) if t else None,venue,raw,'or' in datepart))
    else:
        for block in doc.xpath('//*[@data-category="u-21"]'):
            comp=txt(block.xpath('./p')[0])
            dates=cls(block,'bs-text-35'); datepart=' '.join(txt(x) for x in dates)
            d=re.search(r'(\d{1,2})/(\d{1,2})',datepart)
            d=(2026 if int(d[1])>=7 else 2027, d[1],d[2]) if d else None
            full=txt(block);t=re.search(r'KICK OFF\s*(\d{1,2}:\d{2})',full)
            venue=txt(cls(block,'bs-text-md-16')[0])
            opponents=block.xpath('.//p[contains(@class,"bs-mx-10")]')
            opponent=txt(opponents[0]) if opponents else '対戦相手未定'
            side='HOME' if re.search(r'\bHOME\b',full) else 'AWAY' if re.search(r'\bAWAY\b',full) else 'NEUTRAL'
            rows.append(make(team,comp,opponent,side,d,t[1] if t else None,venue,datepart,' or ' in full))
    if len(rows)<10: raise ValueError(f'{team}: unexpected fixture count {len(rows)}')
    return rows

def make(team,comp,opp,side,date,time,venue,raw,ambiguous):
    date=dt.date(*map(int,date)).isoformat() if date and not ambiguous and '対戦相手未定' not in opp else None
    # Identity does not depend on date/time/venue, so rescheduling preserves UID.
    comp=re.sub(r'【.*?】', '', comp).strip()
    key=f'{team}|{comp}|{opp}|{side}'
    time=time.zfill(5) if time else None
    return dict(uid=hashlib.sha256(key.encode()).hexdigest()[:24]+'@redscalender',team=team,competition=comp,opponent=opp,side=side,date=date,time=time,venue=venue,raw_date=raw,source=SOURCES[team])
def escape(s): return str(s).replace('\\','\\\\').replace('\n','\\n').replace(';','\\;').replace(',','\\,')
def fold(s):
    result=[]; line=''
    for ch in s:
        if len((line+ch).encode())>75: result.append(line); line=' '
        line+=ch
    return '\r\n'.join(result+[line])
def ics(team,rows,stamp):
    lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//redscalender//Urawa fixtures//JA','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+escape(NAMES[team]),'X-WR-TIMEZONE:Asia/Tokyo','X-PUBLISHED-TTL:PT12H']
    for r in rows:
        if not r['date']:continue
        title=f"[{r['side']}] {NAMES[team]} vs {r['opponent']}"
        lines+=['BEGIN:VEVENT','UID:'+r['uid'],'DTSTAMP:'+stamp,'LAST-MODIFIED:'+stamp,'SEQUENCE:'+str(r['sequence'])]
        if r['time']:
            start=dt.datetime.fromisoformat(r['date']+'T'+r['time']).replace(tzinfo=JST).astimezone(dt.timezone.utc)
            lines+=['DTSTART:'+start.strftime('%Y%m%dT%H%M%SZ'),'DTEND:'+(start+dt.timedelta(hours=2)).strftime('%Y%m%dT%H%M%SZ')]
            note='終了時刻はキックオフから2時間後の目安です。'
        else:
            date=dt.date.fromisoformat(r['date']);title='【時刻未定】'+title
            lines+=['DTSTART;VALUE=DATE:'+date.strftime('%Y%m%d'),'DTEND;VALUE=DATE:'+(date+dt.timedelta(days=1)).strftime('%Y%m%d')]
            note='開始時刻未定のため終日表示しています。'
        lines+=['SUMMARY:'+escape(title),'LOCATION:'+escape(r['venue']),'DESCRIPTION:'+escape(r['competition']+'\n'+note+'\n非公式カレンダー。来場前に公式情報をご確認ください。\n'+r['source']),'URL:'+r['source'],'STATUS:CONFIRMED','TRANSP:TRANSPARENT','END:VEVENT']
    return '\r\n'.join(fold(x) for x in lines+['END:VCALENDAR'])+'\r\n'
def main():
    now=dt.datetime.now(JST); stamp=now.astimezone(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    allrows={team:parse(team,fetch(url)) for team,url in SOURCES.items()}
    old=json.loads((ROOT/'schedule.json').read_text()) if (ROOT/'schedule.json').exists() else {'teams':{}}
    for team,rows in allrows.items():
        previous={r['uid']:r for r in old['teams'].get(team,[])}
        if len({r['uid'] for r in rows})!=len(rows):raise ValueError('Duplicate UID')
        for r in rows:
            p=previous.get(r['uid']);r['sequence']=(p.get('sequence',0)+(any(p.get(k)!=v for k,v in r.items()))) if p else 0
    outputs={team+'.ics':ics(team,rows,stamp) for team,rows in allrows.items()}
    data={'updated':now.isoformat(timespec='seconds'),'season':'2026/27','teams':allrows}
    outputs['schedule.json']=json.dumps(data,ensure_ascii=False,indent=2)+'\n'
    template=(ROOT/'template.html').read_text()
    cards=[]
    for team,rows in allrows.items():
        confirmed=[r for r in rows if r['date']];pending=[r for r in rows if not r['date']]
        url=BASE+team+'.ics'
        from urllib.parse import quote
        items=''.join('<li><strong>'+html.escape((r['date'] or '開催日未定')+' '+(r['time'] or '時刻未定'))+'</strong><br>'+html.escape(r['side']+' · '+r['opponent'])+'<br><span>'+html.escape(r['venue']+' / '+r['competition'])+'</span></li>' for r in sorted(confirmed,key=lambda r:r['date']) if r['date']>=now.date().isoformat())
        pendingitems=''.join('<li>'+html.escape(r['opponent']+' / '+r['raw_date']+' / '+r['competition'])+'</li>' for r in pending)
        cards.append(f'''<section class="team"><p class="eyebrow">{'LADIES' if team=='ladies' else 'MEN’S U-21'}</p><h2>{NAMES[team]}</h2><p class="meta">日付確定 {len(confirmed)}試合 · 開催日未定 {len(pending)}件</p><div class="actions"><a class="primary" href="{url.replace('https:','webcal:')}">iPhone・Appleで購読</a><a href="https://calendar.google.com/calendar/render?cid={quote(url,safe='')}">Googleカレンダーに追加</a><a href="{team}.ics" download>iCalをダウンロード</a></div><label>購読用URL<input readonly value="{url}" aria-label="{NAMES[team]}の購読用URL"></label><button type="button" data-copy="{team}">URLをコピー</button><details><summary>収録した今後の試合</summary><ul>{items or '<li>日付確定の今後の試合はありません。</li>'}</ul></details><details><summary>開催日未定（iCalには未収録）</summary><ul>{pendingitems or '<li>なし</li>'}</ul></details><a class="source" href="{SOURCES[team]}">公式試合日程</a></section>''')
    outputs['index.html']=template.replace('{{CARDS}}','\n'.join(cards)).replace('{{UPDATED}}',now.strftime('%Y-%m-%d %H:%M JST'))
    for name,content in outputs.items(): (ROOT/name).write_bytes(content.encode())
    print({t:{'included':sum(bool(r['date']) for r in rows),'pending':sum(not r['date'] for r in rows)} for t,rows in allrows.items()})
if __name__=='__main__':main()
