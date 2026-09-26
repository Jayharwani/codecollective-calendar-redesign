import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Zero serious or critical axe violations across the agenda, the month grid,
 * the open detail sheet and the open filters sheet, in both themes.
 */
const SERIOUS = new Set(['serious', 'critical']);

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const bad = results.violations.filter((v) => SERIOUS.has(v.impact ?? ''));
  if (bad.length > 0) {
    const detail = bad
      .map(
        (v) =>
          `${v.impact}: ${v.id} — ${v.help}\n   ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join('\n   ')}`,
      )
      .join('\n');
    throw new Error(`${label} has ${bad.length} serious/critical violations:\n${detail}`);
  }
  expect(bad, label).toEqual([]);
}

async function ready(page: Page) {
  // The agenda is the last thing to render, and it needs the live feed.
  await expect(page.locator('[data-day]').first()).toBeVisible({ timeout: 45_000 });
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.dataset['theme'] = t;
  }, theme);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test('agenda', async ({ page }) => {
      await page.goto('/?city=baltimore&map=0');
      await ready(page);
      await setTheme(page, theme);
      await scan(page, `agenda (${theme})`);
    });

    test('month view', async ({ page }) => {
      await page.goto('/?city=baltimore&map=0&view=month');
      await expect(page.getByRole('grid')).toBeVisible({ timeout: 45_000 });
      await setTheme(page, theme);
      await scan(page, `month (${theme})`);
    });

    test('event detail sheet', async ({ page }) => {
      await page.goto('/?city=baltimore&map=0');
      await ready(page);
      await setTheme(page, theme);
      await page.locator('[data-event-key]').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await scan(page, `event sheet (${theme})`);
    });

    test('filters sheet', async ({ page }) => {
      await page.goto('/?city=baltimore&map=0');
      await ready(page);
      await setTheme(page, theme);
      await page.getByRole('button', { name: 'Filters' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await scan(page, `filters (${theme})`);
    });
  });
}

test('map view', async ({ page }) => {
  // Below 1280 the map replaces the list, so there are no day sections to
  // wait for; the canvas is the readiness signal either way.
  await page.goto('/?city=baltimore&map=1');
  await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible({ timeout: 45_000 });
  await scan(page, 'map');
});
