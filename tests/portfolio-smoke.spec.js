const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:4173/';

function installRuntimeGuards(page) {
  const issues = [];
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') issues.push(`console.error: ${message.text()}`); });
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(BASE_URL)) issues.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
  });
  return issues;
}

async function installPerformanceObservers(page) {
  await page.addInitScript(() => {
    window.__portfolioLongTasks = [];
    window.__portfolioShifts = [];
    try {
      const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__portfolioLongTasks.push(entry.duration); });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (_) {}
    try {
      const observer = new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__portfolioShifts.push(entry.value); });
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (_) {}
  });
}

async function boot(page, viewport, issues) {
  await page.setViewportSize(viewport);
  await installPerformanceObservers(page);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveClass(/home-redesign/);
  await expect(page.locator('[data-header-search-input]')).toBeVisible();
  await expect(page.locator('#home-start-title')).toBeVisible();
  await expect(page.locator('#home-frictions-title')).toBeVisible();
  await page.waitForFunction(() => document.documentElement.classList.contains('search-core-ready'), null, { timeout: 1000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('catalog-core-ready'), null, { timeout: 5000 });
  try {
    await page.waitForFunction(() => document.documentElement.classList.contains('project-detail-core-ready'), null, { timeout: 1500 });
  } catch (_) {
    const debug = await page.evaluate(() => ({
      readyState: document.readyState,
      hasCoreClass: document.documentElement.classList.contains('project-detail-core-ready'),
      hasApi: Boolean(window.WORKS_PORTFOLIO_PROJECT_DETAIL),
      scriptTags: [...document.scripts].map((script) => script.src).filter((src) => src.includes('project-detail')),
      resources: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('project-detail'))
    }));
    throw new Error(`project detail core did not start: ${JSON.stringify(debug)}; runtime issues: ${issues.join(' | ') || 'none'}`);
  }
}

async function staticLayoutSnapshot(page) {
  return page.evaluate(() => {
    const selectors = ['.site-header', '.hero', '.home-start', '.home-frictions', '.explorer'];
    return Object.fromEntries(selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return [selector, null];
      const rect = element.getBoundingClientRect();
      return [selector, { top: rect.top, left: rect.left, width: rect.width, height: rect.height }];
    }));
  });
}

async function findSearchableProject(page) {
  return page.evaluate(() => window.WORKS_PORTFOLIO_SEARCH?.search('')?.find((item) => item?.title && !item.summaryOnly) || null);
}

async function exerciseSearch(page) {
  const project = await findSearchableProject(page);
  expect(project).toBeTruthy();
  const query = project.title.slice(0, Math.max(2, Math.min(8, project.title.length)));
  const header = page.locator('[data-header-search-input]');

  await page.keyboard.press('/');
  await expect(header).toBeFocused();
  await header.dispatchEvent('compositionstart');
  await header.fill(query);
  await header.dispatchEvent('compositionend');
  await expect(page.locator('[data-header-search-panel]')).toBeVisible();
  await expect(page.locator('[data-home-search-project]').first()).toBeVisible();

  await header.press('ArrowDown');
  await header.press('Enter');
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('project') || '')).not.toBe('');
  await expect(page.locator('[data-project-dialog]')).toHaveAttribute('open', '');

  await page.goBack();
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('project') || '')).toBe('');
  await expect(page.locator('[data-project-dialog]')).not.toHaveAttribute('open', '');
  await page.goForward();
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('project') || '')).not.toBe('');
  await expect(page.locator('[data-project-dialog]')).toHaveAttribute('open', '');
  await page.locator('[data-dialog-close]').click();
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).get('project') || '')).toBe('');

  await header.fill(query);
  await expect(page.locator('[data-home-search-all]')).toBeVisible();
  await page.locator('[data-home-search-all]').click();
  await expect(page.locator('[data-cat-search]')).toHaveValue(query);
  await expect.poll(async () => page.locator('[data-cat-item]').count()).toBeGreaterThan(0);
  await header.focus();
  await header.press('Escape');
}

async function exerciseCatalog(page) {
  await expect(page.locator('[data-catalog-toolbar]')).toBeVisible();
  const catalogSearch = page.locator('[data-cat-search]');
  expect((await catalogSearch.inputValue()).length).toBeGreaterThan(0);
  await catalogSearch.fill('');
  await expect.poll(async () => page.locator('[data-cat-item]').count(), { timeout: 2500 }).toBeGreaterThan(5);
  await page.locator('[data-cat-quick-value="recent"]').click();
  await expect(page.locator('[data-cat-quick-value="recent"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => page.locator('[data-cat-item]').count(), { timeout: 2500 }).toBeGreaterThan(0);
  await page.locator('[data-cat-quick-value="all"]').click();
  await expect(page.locator('[data-cat-quick-value="all"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => page.locator('[data-cat-item]').count(), { timeout: 2500 }).toBeGreaterThan(5);
  const sort = page.locator('[data-cat-sort]');
  await sort.selectOption('title-asc');
  await expect(sort).toHaveValue('title-asc');
}

for (const profile of [
  { name: 'desktop', viewport: { width: 1366, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } }
]) {
  test(`${profile.name}: progressive search, catalog, and detail`, async ({ page }) => {
    const issues = installRuntimeGuards(page);
    await boot(page, profile.viewport, issues);
    const architecture = await page.evaluate(() => ({
      hasSearchIndex: Array.isArray(window.WORKS_PORTFOLIO_SEARCH_INDEX),
      searchCount: window.WORKS_PORTFOLIO_SEARCH_INDEX?.length || 0,
      hasLegacyDiary: 'BUILD_DIARY_DATA' in window,
      catalogResources: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('data/catalog-projects.json')).length
    }));
    expect(architecture.hasSearchIndex).toBe(true);
    expect(architecture.searchCount).toBeGreaterThan(5);
    expect(architecture.hasLegacyDiary).toBe(false);
    expect(architecture.catalogResources).toBe(1);

    const before = await staticLayoutSnapshot(page);
    await page.waitForTimeout(900);
    const after = await staticLayoutSnapshot(page);
    for (const selector of Object.keys(before)) {
      if (!before[selector] || !after[selector]) continue;
      expect(Math.abs(before[selector].top - after[selector].top), `${selector} top shifted`).toBeLessThan(2);
      expect(Math.abs(before[selector].height - after[selector].height), `${selector} height shifted`).toBeLessThan(2);
    }

    await exerciseSearch(page);
    await exerciseCatalog(page);
    const legacyAssets = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name).filter((url) => /live-index|friction-atlas|random-three|catalog-list-first|catalog-visibility|showcase\.js|private-source\.js/.test(url)));
    expect(legacyAssets).toEqual([]);
    const metrics = await page.evaluate(() => ({ worstLongTask: Math.max(0, ...(window.__portfolioLongTasks || [])), cls: (window.__portfolioShifts || []).reduce((sum, value) => sum + value, 0) }));
    expect(metrics.worstLongTask, `worst long task ${metrics.worstLongTask.toFixed(1)}ms`).toBeLessThan(150);
    expect(metrics.cls, `CLS ${metrics.cls}`).toBeLessThan(0.03);
    expect(issues, issues.join('\n')).toEqual([]);
  });
}

test('Header Search remains usable when catalog data fails', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.route('**/data/catalog-projects.json', (route) => route.abort());
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.classList.contains('search-core-ready'), null, { timeout: 1000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('catalog-core-failed'), null, { timeout: 3000 });
  const project = await findSearchableProject(page);
  expect(project).toBeTruthy();
  const header = page.locator('[data-header-search-input]');
  await header.fill(project.title.slice(0, Math.max(2, Math.min(8, project.title.length))));
  await expect(page.locator('[data-header-search-panel]')).toBeVisible();
  await expect(page.locator('[data-home-search-project]').first()).toBeVisible();
  await expect(page.locator('[data-view-panel]')).toContainText('上の検索はそのまま利用できます');
});
