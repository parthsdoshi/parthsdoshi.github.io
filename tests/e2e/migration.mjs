// Data-migration suite: data written by OLDER versions of the tracker must
// keep working against the current plan. Covers: weights with retired
// exercise ids, pre-notes history sessions, a stale in-progress snapshot
// (missing fields, out-of-range stepIdx), editing an old session, and
// importing an old-format backup file.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

export const name = 'data migration';

const PASSWORD = 'California';

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

    // Seed old-shape data: retired exercise ids ('cable-crunch', 'db-curl'),
    // sessions without note fields, and an active snapshot missing
    // exerciseNotes with a stepIdx beyond the current plan's step count.
    await page.evaluate(() => {
      localStorage.setItem(
        'workout:weights',
        JSON.stringify({ 'cable-crunch': 25, 'db-curl': 25, 'db-bench': 47.5 })
      );
      localStorage.setItem(
        'workout:history',
        JSON.stringify([
          {
            date: '2026-08-24T17:00:00Z',
            workout: 'B',
            durationSec: 2100,
            sets: [
              { exerciseId: 'db-curl', name: 'Strict DB curl', blockLabel: '4a', setNumber: 1, weight: 20, reps: 12 },
            ],
          },
          {
            date: '2026-08-26T17:00:00Z',
            workout: 'A',
            durationSec: 2000,
            sets: [
              { exerciseId: 'cable-crunch', name: 'Cable crunch', blockLabel: '4', setNumber: 1, weight: 25, reps: 14 },
            ],
          },
        ])
      );
      localStorage.setItem(
        'workout:active',
        JSON.stringify({
          workoutId: 'B',
          stepIdx: 999,
          phase: 'work',
          sets: [
            { exerciseId: 'db-curl', name: 'Strict DB curl', blockLabel: '4a', setNumber: 1, weight: 20, reps: 11 },
          ],
          startedAt: Date.now() - 20 * 60 * 1000,
          restEndsAt: 0,
          restTotal: 0,
        })
      );
    });
    await page.reload();
    await page.waitForSelector('text=Recent');
    assert.equal(pageErrors.length, 0, `page errors on load: ${pageErrors.join('; ')}`);

    // Old weights preserved; current-plan defaults seeded alongside them.
    const weights = await page.evaluate(() => JSON.parse(localStorage.getItem('workout:weights')));
    assert.equal(weights['cable-crunch'], 25, 'retired weight key must be preserved');
    assert.equal(weights['db-curl'], 25, 'retired weight key must be preserved');
    assert.equal(weights['db-bench'], 47.5, 'existing weight must not be reset');
    assert.equal(weights['incline-hammer-curl'], 15, 'new exercise default must be seeded');
    assert.equal(weights['farmers-carry'], 50, 'new exercise default must be seeded');
    assert.equal(weights['wrist-curl'], 10, 'new exercise default must be seeded');
    assert.equal(weights['pallof-press'], 0, 'new exercise default must be seeded');

    // Stale snapshot resumes: stepIdx clamps to the last current step.
    assert.ok(await page.isVisible('text=in progress'), 'resume banner must show');
    await page.click('button:has-text("Resume")');
    await page.waitForSelector('button:has-text("Log set")');
    await page.click('button:has-text("Log set")');
    await page.waitForSelector('h1:has-text("Done.")');
    await page.click('button:has-text("Done")');
    await page.waitForSelector('text=Recent');

    // Old-shape session opens in the editor and saves without inventing fields.
    await page.locator('button.ses-row').last().click();
    await page.waitForSelector('text=Edit session');
    const oldWeight = page.locator('[aria-label="Weight for Strict DB curl set 1"]');
    assert.equal(await oldWeight.count(), 1, 'retired exercise must be editable');
    await oldWeight.fill('22.5');
    await page.click('button:has-text("Save changes")');
    await page.waitForSelector('text=Recent');
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('workout:history')));
    const oldSession = history.find((s) => s.sets.some((x) => x.exerciseId === 'db-curl'));
    assert.equal(oldSession.sets[0].weight, 22.5, 'edit to old session must persist');
    assert.ok(!('note' in oldSession), 'editor must not add empty note to old session');
    assert.ok(!('exerciseNotes' in oldSession), 'editor must not add empty exerciseNotes');

    // Old-format backup (pre-notes, retired ids, no app/version keys) imports.
    const backupPath = join(tmpdir(), 'workout-old-backup.json');
    writeFileSync(
      backupPath,
      JSON.stringify({
        weights: { 'cable-crunch': 30, 'db-bench': 40 },
        history: [
          {
            date: '2026-08-20T17:00:00Z',
            workout: 'A',
            durationSec: 1900,
            sets: [
              { exerciseId: 'cable-crunch', name: 'Cable crunch', blockLabel: '4', setNumber: 1, weight: 30, reps: 12 },
            ],
          },
        ],
      })
    );
    await page.getByText('Backup', { exact: true }).scrollIntoViewIfNeeded();
    await page.setInputFiles('input[type=file]', backupPath);
    await page.waitForSelector('text=Imported 1 session.');
    const weights2 = await page.evaluate(() => JSON.parse(localStorage.getItem('workout:weights')));
    assert.equal(weights2['cable-crunch'], 30, 'imported retired weight must be kept');
    assert.equal(weights2['farmers-carry'], 50, 'defaults must be re-seeded after import');
    const history2 = await page.evaluate(() => JSON.parse(localStorage.getItem('workout:history')));
    assert.equal(history2.length, 1, 'imported history must replace current');
    assert.equal(history2[0].sets[0].exerciseId, 'cable-crunch', 'retired ids must survive import');

    assert.equal(pageErrors.length, 0, `page errors during suite: ${pageErrors.join('; ')}`);
  } finally {
    await browser.close();
  }
}
