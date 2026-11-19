import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dbModule = new URL('../db.js', import.meta.url).href;

// in-memory db for the last test
process.env.DB_FILE = ':memory:';
const { default: db, SCHEMA_VERSION } = await import(dbModule);
const dir = mkdtempSync(path.join(tmpdir(), 'ct-'));
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

// opens a db file in a separate process, like the server would
function open(file) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', `await import(${JSON.stringify(dbModule)})`], {
    env: { ...process.env, DB_FILE: file },
    encoding: 'utf8'
  });
}

test('a new database gets the current version and the 33 starter foods', () => {
  const file = path.join(dir, 'new.db');
  assert.equal(open(file).status, 0);
  const made = new DatabaseSync(file);
  assert.equal(made.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
  assert.equal(made.prepare('SELECT COUNT(*) AS n FROM food_item').get().n, 33);
  made.close();
  assert.equal(open(file).status, 0, 'reopening a current database works');
  const again = new DatabaseSync(file);
  assert.equal(again.prepare('SELECT COUNT(*) AS n FROM food_item').get().n, 33, 'starter foods are not added twice');
  again.close();
});

test('a database from a newer version of the app is refused', () => {
  const file = path.join(dir, 'newer.db');
  const newer = new DatabaseSync(file);
  newer.exec(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
  newer.close();
  const run = open(file);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /newer version of the app/);
});

test("a database from the first backend is upgraded and keeps its data", () => {
  const file = path.join(dir, 'first.db');
  const old = new DatabaseSync(file);
  // the first backend's tables (server/db.js before the SRS schema)
  old.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
      name TEXT NOT NULL, calorie_goal INTEGER NOT NULL DEFAULT 2000, water_goal INTEGER NOT NULL DEFAULT 64,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE foods (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, calories INTEGER NOT NULL);
    CREATE TABLE meal_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, date TEXT NOT NULL,
      meal TEXT NOT NULL, name TEXT NOT NULL, calories INTEGER NOT NULL, food_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE water_logs (user_id INTEGER NOT NULL, date TEXT NOT NULL, oz INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, date));
    CREATE TABLE weight_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, date TEXT NOT NULL, weight REAL NOT NULL);
    CREATE TABLE diary_entries (user_id INTEGER NOT NULL, date TEXT NOT NULL, note TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, date));
    INSERT INTO users (email, password_hash, name, calorie_goal) VALUES ('Old@Test.com', 'salt:hash', 'Old User', 1800);
    INSERT INTO foods (user_id, name, calories) VALUES (NULL, 'Brown Egg', 60), (1, 'Grandma soup', 250);
    INSERT INTO meal_entries (user_id, date, meal, name, calories, food_id) VALUES
      (1, '2026-11-17', 'Lunch', 'Grandma soup', 250, 2), (1, '2026-11-17', 'Snacks', 'Mystery bar', 200, NULL);
    INSERT INTO water_logs VALUES (1, '2026-11-17', 32);
    INSERT INTO weight_logs (user_id, date, weight) VALUES (1, '2026-11-17', 180), (1, '2026-11-17', 179);
    INSERT INTO diary_entries (user_id, date, note) VALUES (1, '2026-11-17', 'old note');
  `);
  old.close();

  const run = open(file);
  assert.equal(run.status, 0, run.stderr);
  const up = new DatabaseSync(file);
  assert.equal(up.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
  const tables = up.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
  for (const t of ['users', 'foods', 'meal_entries', 'water_logs', 'weight_logs', 'diary_entries']) assert.ok(!tables.includes(t), `${t} is gone`);

  const user = up.prepare('SELECT * FROM user').get();
  assert.equal(user.email, 'old@test.com');
  assert.equal(user.password_hash, 'salt:hash', 'passwords still work');
  assert.equal(up.prepare('SELECT target_calories FROM goal').get().target_calories, 1800);
  const meals = up
    .prepare(`SELECT e.meal_type, f.name, i.calories FROM entry e JOIN entry_item i ON i.entry_id = e.entry_id
              JOIN food_item f ON f.food_id = i.food_id ORDER BY e.meal_type`)
    .all()
    .map((r) => `${r.meal_type} ${r.name} ${r.calories}`);
  assert.deepEqual(meals, ['LUNCH Grandma soup 250', 'SNACK Mystery bar 200'], 'meals without a food get one');
  assert.equal(up.prepare('SELECT ounces FROM water_log').get().ounces, 32);
  assert.equal(up.prepare('SELECT pounds FROM weight_log').get().pounds, 179, 'one weigh-in a day, the newest');
  assert.equal(up.prepare('SELECT note FROM diary_note').get().note, 'old note');
  assert.equal(up.prepare("SELECT COUNT(*) AS n FROM food_item WHERE name = 'Brown Egg'").get().n, 1, 'old shared foods stay');
  assert.ok(up.prepare('SELECT COUNT(*) AS n FROM food_item WHERE created_by IS NULL').get().n >= 34, 'starter foods are added');
  up.close();
});

test('the database itself refuses the same food twice in an entry', () => {
  const food = db.prepare('SELECT food_id FROM food_item LIMIT 1').get().food_id;
  db.prepare("INSERT INTO user (user_id, email, password_hash, display_name, created_at) VALUES ('u', 'u@t.com', 'x', 'U', '2026-09-26T12:00:00Z')").run();
  db.prepare("INSERT INTO entry (entry_id, user_id, meal_type, entry_date, entry_time) VALUES ('e', 'u', 'LUNCH', '2026-09-26', '12:00')").run();
  const add = db.prepare("INSERT INTO entry_item (entry_id, food_id, portion, calories) VALUES ('e', ?, 1, 100)");
  add.run(food);
  assert.throws(() => add.run(food), /UNIQUE|PRIMARY KEY/);
});
