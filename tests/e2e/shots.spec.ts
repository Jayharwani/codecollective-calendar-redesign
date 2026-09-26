import { expect, test, type Page } from '@playwright/test';

/**
 * Verification screenshots at the four widths the brief asks for, plus the
 * states that only exist after an interaction. Run with:
 *   npx playwright test --project=desktop tests/e2e/shots.spec.ts
 */
const WIDTHS = [390, 768, 1280, 1440];

async function ready(page: Page) {
  await expect(page.locator('[data-day]').first()).toBeVisible({ timeout: 45_000 });
  // Let the images and the load animation settle.
  await page.waitForTimeout(2500);
}

for (const width of WIDTHS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`agenda ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/?city=baltimore${width >= 1280 ? '' : '&map=0'}`);
      await ready(page);
      if (width >= 1280) {
        // Wait for the map to actually paint, not just mount.
        await page.locator('canvas.maplibregl-canvas').waitFor({ timeout: 45_000 });
        await page.waitForTimeout(6000);
      }
      await page.screenshot({ path: `shots/agenda-${width}-${theme}.png`, fullPage: false });
    });
  }
}

test('month view 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?city=baltimore&map=0&view=month');
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shots/month-1280.png' });
});

test('event sheet 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?city=baltimore&map=1');
  await ready(page);
  await page.locator('canvas.maplibregl-canvas').waitFor({ timeout: 45_000 });
  await page.waitForTimeout(6000);
  await page.locator('[data-event-key]').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shots/event-sheet-1440.png' });
});

test('filters sheet 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?city=baltimore&map=0');
  await ready(page);
  await page.getByRole('button', { name: 'Filters' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/filters-1280.png' });
});

test('phone search sheet 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?city=baltimore&map=0');
  await ready(page);
  await page.getByRole('button', { name: /Search Baltimore events/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'shots/phone-search-390.png' });
});

test('phone map 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?city=baltimore&map=1');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'shots/phone-map-390.png' });
});

test('empty state with relaxations', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Finance, on a single quiet day, with a query that matches nothing.
  await page.goto('/?city=baltimore&map=0&lt=finance&when=today&q=zzzzqqq');
  await expect(page.getByText(/No events match/)).toBeVisible({ timeout: 45_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/empty-1280.png' });
});

test('loading skeleton', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Hold the feed so the skeleton is on screen long enough to capture.
  await page.route('**/upcoming_events.json', async (route) => {
    await new Promise((r) => setTimeout(r, 6000));
    await route.continue();
  });
  await page.goto('/?city=baltimore&map=0');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shots/loading-1280.png' });
});

test('error state', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/upcoming_events.json', (route) => route.abort('failed'));
  await page.goto('/?city=baltimore&map=0');
  await expect(page.getByText(/did not load/)).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: 'shots/error-1280.png' });
});
