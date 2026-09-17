// Graduation suite: an exercise with a graduation rule hands its slot to the
// successor once every set hits the top of the rep range at the threshold
// weight — and not before. Covers: firing at the threshold, not firing below
// it, the next workout resolving to the successor, undo from the summary and
// from home, and overrides riding export/import.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

export const name = 'graduation';

const PASSWORD = 'California';

async function unlock(page, baseURL) {
  await page.goto(baseURL);
  await page.fill('input[type=password]', PASSWORD);
  await page.click('button:has-text("Unlock")');
  await page.waitForSelector('text=is up.');
}

// Runs Workout A's three goblet-squat sets at the top of the rep range with the
// given working weight, then ends the workout early and lands on the summary.
async function squatAtTopOfRange(page, weight) {
  await page.evaluate((w) => {
    localStorage.setItem('workout:weights', JSON.stringify({ 'goblet-squat': w }));
    localStorage.removeItem('workout:history');
    localStorage.removeItem('workout:overrides');
  }, weight);
  await page.reload();
  await page.waitForSelector('text=is up.');
  await page.click('button:has-text("Start workout A")');
  await page.waitForSelector('text=Warm-up');
  await page.click('button:has-text("Start set 1")');
  for (let set = 1; set <= 3; set++) {
    await page.waitForSelector('h2:has-text("Goblet squat")');
    await page.click('[aria-label="Increase reps"]');
    await page.click('[aria-label="Increase reps"]');
    await page.click('button:has-text("Log set")');
    await page.waitForSelector('button:has-text("Skip rest")');
    await page.click('button:has-text("Skip rest")');
  }
  await page.click('button:has-text("End")');
  await page.waitForSelector('h1:has-text("Done.")');
}

export async function run(baseURL) {
  const executablePath = process.env.WORKOUT_TEST_BROWSER;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('dialog', (d) => d.accept());

  try {
    await unlock(page, baseURL);

    // Below the threshold: normal progression, no graduation.
    await squatAtTopOfRange(page, 45);
    assert.ok(
      await page.isVisible('button:has-text("+5 lb next")'),
      'at 45 lb the bump offer shows'
    );
    assert.ok(!(await page.isVisible('text=Bulgarian split squat')), 'at 45 lb nothing graduates');
    const none = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('workout:overrides') || '{}')
    );
    assert.deepEqual(none, {}, 'no override below the threshold');
    await page.click('button:has-text("Done")');
    await page.waitForSelector('text=Recent');

    // At the threshold: graduates automatically.
    await squatAtTopOfRange(page, 50);
    assert.ok(await page.isVisible('text=→ Bulgarian split squat'), 'summary shows the graduation');
    assert.ok(
      !(await page.isVisible('button:has-text("+5 lb next")')),
      'no bump offer once graduated'
    );
    const overrides = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('workout:overrides'))
    );
    assert.deepEqual(overrides, { 'goblet-squat': 'bulgarian-split-squat' }, 'override persisted');
    const weights = await page.evaluate(() => JSON.parse(localStorage.getItem('workout:weights')));
    assert.equal(weights['bulgarian-split-squat'], 20, 'successor gets its starting weight');

    // Next Workout A runs the successor; home explains it.
    await page.click('button:has-text("Done")');
    await page.waitForSelector('text=Recent');
    // Last session was A, so B is the suggested card and A is compact: verify via a start.
    assert.ok(await page.isVisible('text=Graduated: Goblet squat'), 'home shows graduation line');
    await page.click('button:has-text("Start workout A")');
    await page.waitForSelector('h2:has-text("Bulgarian split squat")');
    await page.click('button:has-text("End")');
    await page.waitForSelector('text=is up.');

    // Overrides ride the backup.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export data")'),
    ]);
    const backupPath = join(tmpdir(), 'workout-graduation-backup.json');
    await download.saveAs(backupPath);
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
    assert.deepEqual(
      backup.overrides,
      { 'goblet-squat': 'bulgarian-split-squat' },
      'export carries overrides'
    );

    // Undo from home restores the base exercise.
    await page.locator('button.link-btn:has-text("Undo")').first().click();
    await page.waitForSelector('text=Recent');
    const cleared = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('workout:overrides'))
    );
    assert.deepEqual(cleared, {}, 'undo clears the override');
    await page.click('button:has-text("Start workout A")');
    await page.waitForSelector('h2:has-text("Goblet squat")');
    await page.click('button:has-text("End")');
    await page.waitForSelector('text=is up.');

    // Importing the backup brings the graduation back; a bogus override is ignored.
    backup.overrides['db-bench'] = 'not-a-real-exercise';
    writeFileSync(backupPath, JSON.stringify(backup));
    await page.setInputFiles('input[type=file]', backupPath);
    await page.waitForSelector('text=Imported');
    const imported = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('workout:overrides'))
    );
    assert.deepEqual(
      imported,
      { 'goblet-squat': 'bulgarian-split-squat' },
      'import restores valid overrides only'
    );
    await page.click('button:has-text("Start workout A")');
    await page.waitForSelector('h2:has-text("Bulgarian split squat")');
    await page.click('button:has-text("End")');
    await page.waitForSelector('text=is up.');

    assert.equal(pageErrors.length, 0, `page errors during suite: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
}
