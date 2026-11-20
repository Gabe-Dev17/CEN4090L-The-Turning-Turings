// starts and stops the express server for the browser tests.
// it uses its own database file in the temp folder, so your real food-journal.db is never touched
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(here, '..', 'server');

// a fixed secret for test logins, so tokens survive the restart test and C6 can make an expired one
export const AUTH_SECRET = 'e2e-test-secret';

export const PORT = 3456;
export const BASE = `http://localhost:${PORT}`;
export const DB_FILE = path.join(os.tmpdir(), 'calorie-tracker-e2e.db');

let child = null;

// the usda key from server/.env (or the environment), if there is one
export function usdaKey() {
  if (process.env.FDC_API_KEY) return process.env.FDC_API_KEY;
  try {
    const line = fs.readFileSync(path.join(serverDir, '.env'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('FDC_API_KEY='));
    return line ? line.slice('FDC_API_KEY='.length).trim() : '';
  } catch {
    return '';
  }
}

export function resetDb() {
  for (const f of [DB_FILE, DB_FILE + '-wal', DB_FILE + '-shm']) fs.rmSync(f, { force: true });
}

// usda off by default so search results are the same every run.
// an empty FDC_API_KEY wins over server/.env (loadEnvFile doesn't overwrite it)
export async function startServer({ usda = false } = {}) {
  child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'index.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(PORT), DB_FILE, AUTH_SECRET, FDC_API_KEY: usda ? usdaKey() : '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(BASE + '/api/me');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('the server did not start (is dist built? run npm run build)');
}

export async function stopServer() {
  if (!child) return;
  const done = new Promise((r) => child.once('exit', r));
  child.kill();
  await done;
  child = null;
}
