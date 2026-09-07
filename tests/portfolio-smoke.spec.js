const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.PORTFOLIO_BASE_URL || 'http://127.0.0.1:4173/';

function installRuntimeGuards(page) {
  const issues = [];
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(BASE_URL)) {
      issues.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
    }
  });
  return issues;
}

async function boot(page) {
  await page.addInitScript(() => {
    window.__portfolioLongTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__portfolioLongTasks.push(entry.duration);
      });
      observer.observe({ entryTypes: ['longtask'] });
      window.__portfolioLongTaskObserver = observer;
    } catch (_) {}
  });

  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.locator('[data-catalog-toolbar]').waitFor({ state: 'attached' });
  await page.locator('[data-portfolio-showcase]').waitFor({ state: 'attached' });
  await page.waitForFunction(() => document.documentElement.dataset.portfolioEnhancements === 'ready', null, { timeout: 15000 });
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.__portfolioLongTasks = []; });
}

async function clickVisibleView(page, view) {
  const control = page.locator(`[data-view-button="${view}"]:visible`).first();
  await expect(control).toBeVisible({ timeout: 2500 });
  await control.click({ timeout: 2500 });
}

async function dispatchView(page, view) {
  await page.evaluate((targetView) => {
    const control = document.querySelector(`[data-view-button="${targetView}"]`);
    if (!control) throw new Error(`Missing view control: ${targetView}`);
    control.click();
  }, view);
}

async function exerciseCoreInteractions(page) {
  const familyButtons = page.locator('[data-showcase-family]');
  const familyCount = await familyButtons.count();
  expect(familyCount).toBeGreaterThanOrEqual(3);

  const totalItems = await page.locator('[data-cat-item]').count();
  expect(totalItems).toBeGreaterThan(5);

  for (let index = 0; index < 10; index += 1) {
    const button = familyButtons.nth(index % familyCount);
    const familyId = await button.getAttribute('data-showcase-family');
    expect(familyId).toBeTruthy();

    await button.click({ timeout: 2500 });
    await expect(page.locator(`[data-showcase-family-card="${familyId}"]`)).toHaveClass(/is-active/, { timeout: 2500 });
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    await expect.poll(async () => page.locator('[data-cat-item]:visible').count(), { timeout: 2500 }).toBeLessThan(totalItems);
    expect(await page.locator('[data-cat-item]:visible').count()).toBeGreaterThan(0);
  }

  const activeFamily = page.locator('[data-showcase-family][aria-pressed="true"]');
  await expect(activeFamily).toHaveCount(1);
  await activeFamily.click({ timeout: 2500 });
  await expect(page.locator('[data-showcase-family-card].is-active')).toHaveCount(0);
  await expect.poll(async () => page.locator('[data-cat-item]:visible').count(), { timeout: 2500 }).toBe(totalItems);

  const search = page.locator('[data-cat-search]');
  const firstProjectId = await page.evaluate(() => window.BUILD_DIARY_DATA?.projects?.find((project) => project?.id)?.id || '');
  expect(firstProjectId).toBeTruthy();
  await search.fill(firstProjectId);
  await expect.poll(async () => page.locator('[data-cat-item]:visible').count(), { timeout: 2500 }).toBeGreaterThan(0);
  await search.fill('');
  await expect.poll(async () => page.locator('[data-cat-item]:visible').count(), { timeout: 2500 }).toBe(totalItems);

  // Enter a different view through a real visible control. Returning to Shelf is dispatched
  // directly because the sticky header intentionally moves while scrolling and Playwright's
  // stability gate can reject that animation even though the view handler itself is healthy.
  await clickVisibleView(page, 'timeline');
  await expect(page.locator('[data-portfolio-showcase]')).toBeHidden();
  await dispatchView(page, 'shelf');
  await expect(page.locator('[data-portfolio-showcase]')).toBeVisible();
  await expect(page.locator('[data-cat-item]')).toHaveCount(totalItems, { timeout: 2500 });

  const longTasks = await page.evaluate(() => window.__portfolioLongTasks || []);
  const worstLongTask = Math.max(0, ...longTasks);
  expect(worstLongTask, `worst interaction long task was ${worstLongTask.toFixed(1)}ms`).toBeLessThan(1200);
}

for (const profile of [
  { name: 'desktop', viewport: { width: 1366, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } }
]) {
  test(`${profile.name}: repeated family switching stays responsive`, async ({ page }) => {
    await page.setViewportSize(profile.viewport);
    const issues = installRuntimeGuards(page);
    await boot(page);
    await exerciseCoreInteractions(page);
    expect(issues, issues.join('\n')).toEqual([]);
  });
}
