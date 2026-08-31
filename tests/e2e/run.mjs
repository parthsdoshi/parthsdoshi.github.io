// Orchestrates the workout tracker e2e suites: serves the built site with
// `astro preview`, runs each suite, and exits non-zero on any failure.
// Run via `pnpm test:e2e` (builds first). Needs a Chromium for Playwright:
// `npx playwright install chromium`, or point WORKOUT_TEST_BROWSER at an
// existing Chrome/Chromium binary.
import { spawn } from 'node:child_process';

const PORT = 4399;
const BASE = `http://localhost:${PORT}/workout/`;

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server never came up at ${url}`);
}

const server = spawn('pnpm', ['preview', '--port', String(PORT)], { stdio: 'ignore' });
let failed = false;
try {
  await waitForServer(BASE);
  for (const suite of ['./migration.mjs']) {
    const { run, name } = await import(suite);
    process.stdout.write(`suite: ${name}\n`);
    await run(BASE);
    process.stdout.write(`suite: ${name} passed\n`);
  }
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
