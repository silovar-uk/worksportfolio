/* Browser smoke: real static files + real iCalendar in Chromium and WebKit.
 * Run at repo root: node waseda-calendar/smoke.mjs
 * Requires: npm install playwright; npx playwright install chromium webkit
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium, webkit } from "playwright";

const BASE = process.env.WASEDA_BASE_URL || "http://127.0.0.1:4173/waseda-calendar/";
const cases = [
  ["Chromium desktop", chromium, { viewport: { width: 1280, height: 850 } }],
  ["WebKit iPhone viewport", webkit, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 3,
    hasTouch: true,
  }],
];
const results = [];
const dataRes = await fetch(new URL("schedule.json", BASE));
assert.equal(dataRes.status, 200, "schedule.json should load");
const fixtureData = await dataRes.json();
assert.ok(fixtureData.events.length >= 23, "expected full men's TOP official-season data");
assert.ok(fixtureData.events.every(e => e.source.includes("waseda-afc.jp/game-men")));
const icsRes = await fetch(new URL("all.ics", BASE));
assert.equal(icsRes.status, 200, "all.ics should load");
const ics = await icsRes.text();
assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, fixtureData.events.filter(e => e.date).length);
if (fixtureData.year === 2026) {
  const r17 = fixtureData.events.find(e => e.competition === "関東大学サッカーリーグ" && e.round === "第17節");
  assert.deepEqual(r17?.result, { for: 3, against: 0 }, "Oct 21 3-0 should be in JSON");
  assert.match(r17.resultSource, /^https://www.jufa-kanto.jp/news/detail/4306/);
  assert.ok(ics.includes("結果: 3–0") || ics.replace(/\r?\n /g,"").includes("結果: 3–0"),
    "The certified score must be included in iCal event description");
}
for (const [browserName, launcher, opts] of cases) {
  const browser = await launcher.launch({ headless: true });
  try {
    const context = await browser.newContext({
      ...opts, locale: "ja-JP", timezoneId: "Asia/Tokyo",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    const resp = await page.goto(BASE, { waitUntil: "domcontentloaded" });
    assert.equal(resp.status(), 200);
    await page.locator("#updated b").waitFor({ timeout: 20000 });
    assert.match(await page.title(), /WASEDA CALENDAR/);
    assert.ok((await page.locator("#nextMatch").innerText()).includes("NEXT MATCH"));
    assert.ok((await page.locator("#latestResult").innerText()).includes("LATEST RESULT"));
    assert.ok((await page.locator(".event").count()) >= 1, "timeline should show events");
    const initialAll = await page.locator(".event").count();
    await page.locator("[data-filter=league]").click();
    assert.equal(await page.locator("[data-filter=league]").getAttribute("aria-pressed"), "true");
    const text = await page.locator("#timeline").innerText();
    assert.ok(!text.includes("vs 高麗大学校"), "league filter should exclude exchange games");
    await page.locator("[data-filter=all]").click();
    await page.locator("#more").click();
    const seasonTotal = await page.locator(".event").count();
    assert.ok(seasonTotal >= initialAll && seasonTotal >= 23, "full-season toggle should reveal all fixtures");
    if (fixtureData.year === 2026) {
      const r17Panel = page.locator("#d-2026-10-21");
      await r17Panel.waitFor();
      assert.ok((await r17Panel.innerText()).includes("3 – 0"), "The Oct 21 result must be visible in the timeline");
      assert.ok((await r17Panel.locator("a.src").getAttribute("href")).includes("jufa-kanto.jp"),
        "The result details should cite JUFA's official score");
      const nowTokyo = new Date(Date.now() + 9 * 3600000).toISOString().slice(0,10);
      if (nowTokyo >= "2026-10-22" && nowTokyo <= "2026-11-04") {
        assert.ok((await page.locator("#results").innerText()).includes("3 – 0"),
          "The recent result panel must show Oct 21 score");
      }
    }
    await page.locator("[data-filter=undated]").click();
    assert.ok((await page.locator("#timeline").innerText()).includes("日時未定"), "undated filter");
    await page.locator("[data-filter=all]").click();
    await page.locator("#reload").click();
    await page.locator("#reloadStatus").filter({ hasText: /最新|更新|取得/ }).waitFor({ timeout: 20000 });
    assert.deepEqual(errors, [], "no uncaught page errors");
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(horizontalOverflow < 3, "no unwanted horizontal page overflow: " + horizontalOverflow);
    await page.screenshot({ path: "waseda-calendar/qa-" + browserName.toLowerCase().replace(/[^a-z]+/g, "-") + ".png", fullPage: true });
    results.push({ browser: browserName, passed: true, seasonMatches: seasonTotal,
                   visibleInitially: initialAll, horizontalOverflow });
    await context.close();
  } finally {
    await browser.close();
  }
}
const report = {
  checkedAt: new Date().toISOString(),
  officialMatches: fixtureData.events.length,
  datedMatches: fixtureData.events.filter(e => e.date).length,
  calendarItems: (ics.match(/BEGIN:VEVENT/g) || []).length,
  certifiedRound17: fixtureData.year === 2026 ? { score: "3-0", source: "JUFA Kanto" } : null,
  tests: results,
};
fs.writeFileSync("waseda-calendar/qa-status.json", JSON.stringify(report, null, 2) + "\n");
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
