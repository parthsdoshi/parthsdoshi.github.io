// Bodyweight log suite: weekly weigh-ins on the home screen. Covers logging
// (one entry per day, latest overwrites), the trend nudge in its three states
// (stalled / on pace / gaining fast) plus the not-enough-data state, deleting
// an entry, the chart's hover readout, and export/import carrying entries.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

export const name = 'bodyweight log';

const PASSWORD = 'California';

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('en-CA');
}

// Weekly entries for `weeks` weeks ending today, starting at `start` lb and
// changing `perWeek` lb each week.
function series(start, perWeek, weeks) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    out.push({
      date: isoDaysAgo(w * 7),
      lb: Math.round((start + (weeks - 1 - w) * perWeek) * 10) / 10,
    });
  }
  return out;
}

async function seed(page, entries) {
  await page.evaluate(
    (e) => localStorage.setItem('workout:bodyweight', JSON.stringify(e)),
    entries
  );
  await page.reload();
  await page.waitForSelector('text=is up.');
}

async function trendKind(page) {
  return page.locator('[data-trend]').getAttribute('data-trend');
}

export async function run(baseURL) {
  const executablePath = process.env.WORKOUT_TEST_BROWSER;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('dialog', (d) => d.accept());

  try {
    await page.goto(baseURL);
    await page.fill('input[type=password]', PASSWORD);
    await page.click('button:has-text("Unlock")');
    await page.waitForSelector('text=is up.');

    // Log today, then overwrite today.
    await page.fill('[aria-label="Bodyweight in pounds"]', '131.4');
    await page.click('button:has-text("Log today")');
    await page.waitForSelector('button:has-text("Update today")');
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('workout:bodyweight')));
    assert.equal(stored.length, 1, 'one entry after first log');
    assert.equal(stored[0].lb, 131.4, 'logged value stored');
    assert.equal(stored[0].date, isoDaysAgo(0), 'entry dated today');
    await page.fill('[aria-label="Bodyweight in pounds"]', '131.8');
    await page.click('button:has-text("Update today")');
    await page.waitForTimeout(200);
    stored = await page.evaluate(() => JSON.parse(localStorage.getItem('workout:bodyweight')));
    assert.equal(stored.length, 1, 'same-day log overwrites, no duplicate');
    assert.equal(stored[0].lb, 131.8, 'overwritten value stored');
    assert.equal(await trendKind(page), 'none', 'no trend with a single entry');

    // Stalled: flat for 4 weeks -> eat more.
    await seed(page, series(130, 0, 5));
    assert.equal(await trendKind(page), 'stalled', 'flat series reads as stalled');
    assert.ok(await page.isVisible('text=Eat more'), 'stall nudge shown');

    // On pace: +0.6 lb/wk.
    await seed(page, series(130, 0.6, 5));
    assert.equal(await trendKind(page), 'pace', 'steady gain reads as on pace');
    assert.ok(await page.isVisible('text=on pace'), 'on-pace text shown');

    // Too fast: +2 lb/wk.
    await seed(page, series(130, 2, 5));
    assert.equal(await trendKind(page), 'fast', 'fast gain flagged');
    assert.ok(await page.isVisible('text=ease off'), 'ease-off text shown');

    // Chart renders with a hover readout, and the latest value is labeled.
    assert.ok(
      await page.isVisible('svg[aria-label="Bodyweight trend, last 12 weeks"]'),
      'chart present'
    );
    const svg = page.locator('svg[aria-label="Bodyweight trend, last 12 weeks"]');
    await svg.scrollIntoViewIfNeeded();
    const box = await svg.boundingBox();
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
    await page.waitForTimeout(100);
    const readout = await page.locator('[aria-live="polite"]').textContent();
    assert.match(readout, /lb/, 'hover readout shows a value');

    // Delete the newest entry from the table view.
    const before = (
      await page.evaluate(() => JSON.parse(localStorage.getItem('workout:bodyweight')))
    ).length;
    await page.locator('[aria-label^="Remove weigh-in"]').first().click();
    await page.waitForTimeout(200);
    const after = (
      await page.evaluate(() => JSON.parse(localStorage.getItem('workout:bodyweight')))
    ).length;
    assert.equal(after, before - 1, 'delete removes one entry');

    // Export carries entries; import restores them and drops junk.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export data")'),
    ]);
    const backupPath = join(tmpdir(), 'workout-bodyweight-backup.json');
    await download.saveAs(backupPath);
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
    assert.equal(backup.bodyweight.length, after, 'export carries bodyweight entries');
    backup.bodyweight.push({ date: 'not-a-date', lb: 5 }, { date: '2026-01-01', lb: -3 });
    writeFileSync(backupPath, JSON.stringify(backup));
    await page.evaluate(() => localStorage.removeItem('workout:bodyweight'));
    await page.reload();
    await page.waitForSelector('text=is up.');
    await page.setInputFiles('input[type=file]', backupPath);
    await page.waitForSelector('text=Imported');
    const imported = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('workout:bodyweight'))
    );
    assert.equal(imported.length, after, 'import restores valid entries and drops invalid ones');

    assert.equal(pageErrors.length, 0, `page errors during suite: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
}
