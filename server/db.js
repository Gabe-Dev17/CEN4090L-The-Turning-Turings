//the database. same tables as the SRS (section 6) and the ER diagram
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DB_FILE || path.join(dir, "data.db");

//bump this when a table changes, and add an upgrade step below
export const SCHEMA_VERSION = 3;

const schema = `
  CREATE TABLE IF NOT EXISTS user (
    user_id       TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    created_at    TEXT NOT NULL
  ) STRICT;

  -- external_id is only filled in for usda foods.
  -- created_by is only filled in for custom foods, which only that user can see
  CREATE TABLE IF NOT EXISTS food_item (
    food_id              TEXT PRIMARY KEY,
    external_id          TEXT UNIQUE,
    name                 TEXT NOT NULL,
    calories_per_serving REAL NOT NULL CHECK (calories_per_serving >= 0),
    serving_unit         TEXT NOT NULL,
    created_by           TEXT REFERENCES user (user_id) ON DELETE CASCADE
  ) STRICT;

  -- one meal or snack
  CREATE TABLE IF NOT EXISTS entry (
    entry_id   TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES user (user_id) ON DELETE CASCADE,
    meal_type  TEXT NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
    entry_date TEXT NOT NULL CHECK (date(entry_date) IS entry_date),
    entry_time TEXT NOT NULL CHECK (entry_time GLOB '[0-2][0-9]:[0-5][0-9]'),
    mood       TEXT,
    location   TEXT,
    activity   TEXT
  ) STRICT;

  CREATE INDEX IF NOT EXISTS entry_user_date ON entry (user_id, entry_date);

  -- one row per food in an entry. calories are saved so old entries keep their totals
  CREATE TABLE IF NOT EXISTS entry_item (
    entry_id TEXT NOT NULL REFERENCES entry (entry_id) ON DELETE CASCADE,
    food_id  TEXT NOT NULL REFERENCES food_item (food_id),
    portion  REAL NOT NULL CHECK (portion > 0),
    calories REAL NOT NULL CHECK (calories >= 0),
    PRIMARY KEY (entry_id, food_id)
  ) STRICT;

  -- one calorie goal (and reminder time) per user
  CREATE TABLE IF NOT EXISTS goal (
    user_id         TEXT PRIMARY KEY REFERENCES user (user_id) ON DELETE CASCADE,
    target_calories REAL NOT NULL CHECK (target_calories > 0),
    reminder_time   TEXT CHECK (reminder_time IS NULL OR reminder_time GLOB '[0-2][0-9]:[0-5][0-9]')
  ) STRICT;

  CREATE TABLE IF NOT EXISTS water_log (
    user_id  TEXT NOT NULL REFERENCES user (user_id) ON DELETE CASCADE,
    log_date TEXT NOT NULL CHECK (date(log_date) IS log_date),
    ounces   INTEGER NOT NULL CHECK (ounces BETWEEN 0 AND 400),
    PRIMARY KEY (user_id, log_date)
  ) STRICT;

  -- one weigh-in per day
  CREATE TABLE IF NOT EXISTS weight_log (
    user_id  TEXT NOT NULL REFERENCES user (user_id) ON DELETE CASCADE,
    log_date TEXT NOT NULL CHECK (date(log_date) IS log_date),
    pounds   REAL NOT NULL CHECK (pounds > 0 AND pounds <= 1000),
    PRIMARY KEY (user_id, log_date)
  ) STRICT;

  -- one note per day, an empty note is deleted instead of saved
  CREATE TABLE IF NOT EXISTS diary_note (
    user_id   TEXT NOT NULL REFERENCES user (user_id) ON DELETE CASCADE,
    note_date TEXT NOT NULL CHECK (date(note_date) IS note_date),
    note      TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 10000),
    PRIMARY KEY (user_id, note_date)
  ) STRICT;
`;

//starter foods (approximate usda calories)
const starterFoods = [
  ["Apple", 95, "medium apple"],
  ["Banana", 105, "medium banana"],
  ["Orange", 62, "medium orange"],
  ["Strawberries", 49, "cup"],
  ["Blueberries", 84, "cup"],
  ["Oatmeal, cooked", 166, "cup"],
  ["Cheerios", 100, "cup"],
  ["Whole wheat bread", 80, "slice"],
  ["White rice, cooked", 205, "cup"],
  ["Brown rice, cooked", 218, "cup"],
  ["Pasta, cooked", 220, "cup"],
  ["Egg, large", 72, "egg"],
  ["Chicken breast, grilled", 165, "100 g"],
  ["Salmon, baked", 206, "100 g"],
  ["Ground beef, 85% lean", 215, "100 g"],
  ["Black beans, cooked", 227, "cup"],
  ["Broccoli, steamed", 55, "cup"],
  ["Carrots, raw", 52, "cup"],
  ["Spinach, raw", 7, "cup"],
  ["Milk, 2%", 122, "cup"],
  ["Greek yogurt, plain", 100, "170 g container"],
  ["Cheddar cheese", 113, "oz"],
  ["Peanut butter", 94, "tbsp"],
  ["Almonds", 164, "oz"],
  ["Avocado", 240, "medium avocado"],
  ["Pizza, cheese", 285, "slice"],
  ["Hamburger", 354, "burger"],
  ["French fries", 365, "medium order"],
  ["Potato chips", 152, "oz"],
  ["Chocolate chip cookie", 78, "cookie"],
  ["Coffee, black", 2, "cup"],
  ["Orange juice", 112, "cup"],
  ["Soda, cola", 140, "12 oz can"],
];

//runs fn inside BEGIN/COMMIT, rolls back if it throws
export function inTransaction(db, fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

const hasTable = (db, name) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

//moves data from the first backend's tables (users, foods, meal_entries, water_logs,
//weight_logs, diary_entries) into the new ones, then drops the old tables.
//nothing is lost: each old meal becomes an entry with one food, at 12:00
function upgradeFromFirstBackend(db) {
  const userIds = new Map();
  const foodIds = new Map();
  const meals = { Breakfast: "BREAKFAST", Lunch: "LUNCH", Dinner: "DINNER", Snacks: "SNACK" };
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

  for (const u of db.prepare("SELECT * FROM users").all()) {
    const id = randomUUID();
    userIds.set(u.id, id);
    db.prepare(
      "INSERT INTO user (user_id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(id, u.email.toLowerCase(), u.password_hash, u.name.slice(0, 50), new Date(String(u.created_at).replace(" ", "T") + "Z").toISOString());
    //the old calorie goal had a default of 2000, so only keep it if it was changed
    if (u.calorie_goal !== 2000) {
      db.prepare("INSERT INTO goal (user_id, target_calories) VALUES (?, ?)").run(id, u.calorie_goal);
    }
  }

  //shared foods become starter-style foods, custom ones keep their owner
  for (const f of db.prepare("SELECT * FROM foods").all()) {
    const id = randomUUID();
    foodIds.set(f.id, id);
    db.prepare(
      "INSERT INTO food_item (food_id, name, calories_per_serving, serving_unit, created_by) VALUES (?, ?, ?, 'serving', ?)"
    ).run(id, f.name, Math.max(0, f.calories), f.user_id === null ? null : userIds.get(f.user_id));
  }

  for (const m of db.prepare("SELECT * FROM meal_entries").all()) {
    const userId = userIds.get(m.user_id);
    if (!userId || !isDate(m.date)) continue;
    //meals added without a food (or whose food was deleted) get a private food with the same name
    let foodId = m.food_id === null ? null : foodIds.get(m.food_id);
    if (!foodId) {
      foodId = randomUUID();
      db.prepare(
        "INSERT INTO food_item (food_id, name, calories_per_serving, serving_unit, created_by) VALUES (?, ?, ?, 'serving', ?)"
      ).run(foodId, m.name, Math.max(0, m.calories), userId);
    }
    const entryId = randomUUID();
    db.prepare(
      "INSERT INTO entry (entry_id, user_id, meal_type, entry_date, entry_time) VALUES (?, ?, ?, ?, '12:00')"
    ).run(entryId, userId, meals[m.meal], m.date);
    db.prepare("INSERT INTO entry_item (entry_id, food_id, portion, calories) VALUES (?, ?, 1, ?)").run(
      entryId, foodId, Math.max(0, m.calories)
    );
  }

  for (const w of db.prepare("SELECT * FROM water_logs").all()) {
    if (!userIds.has(w.user_id) || !isDate(w.date)) continue;
    db.prepare("INSERT INTO water_log (user_id, log_date, ounces) VALUES (?, ?, ?)").run(
      userIds.get(w.user_id), w.date, Math.min(400, Math.max(0, w.oz))
    );
  }

  //the old table allowed several weigh-ins a day, the newest one wins
  for (const w of db.prepare("SELECT * FROM weight_logs ORDER BY id").all()) {
    if (!userIds.has(w.user_id) || !isDate(w.date) || !(w.weight > 0 && w.weight <= 1000)) continue;
    db.prepare(
      `INSERT INTO weight_log (user_id, log_date, pounds) VALUES (?, ?, ?)
       ON CONFLICT (user_id, log_date) DO UPDATE SET pounds = excluded.pounds`
    ).run(userIds.get(w.user_id), w.date, w.weight);
  }

  for (const d of db.prepare("SELECT * FROM diary_entries").all()) {
    if (!userIds.has(d.user_id) || !isDate(d.date) || !d.note.trim()) continue;
    db.prepare("INSERT INTO diary_note (user_id, note_date, note) VALUES (?, ?, ?)").run(
      userIds.get(d.user_id), d.date, d.note.slice(0, 10000)
    );
  }

  db.exec(`
    DROP TABLE meal_entries; DROP TABLE water_logs; DROP TABLE weight_logs;
    DROP TABLE diary_entries; DROP TABLE foods; DROP TABLE users;
  `);
}

function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = OFF"); //off while upgrading, so tables can be dropped in any order
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (version > SCHEMA_VERSION) {
    db.close();
    throw new Error(`${file} was made by a newer version of the app. Pull the latest code, or delete the file to start over.`);
  }

  inTransaction(db, () => {
    db.exec(schema);
    if (hasTable(db, "users")) upgradeFromFirstBackend(db);
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
  db.exec("PRAGMA foreign_keys = ON");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL");

  //adds any starter food that isn't there yet (by name), so an upgraded database gets them too
  const exists = db.prepare("SELECT 1 FROM food_item WHERE created_by IS NULL AND name = ? COLLATE NOCASE");
  const insert = db.prepare("INSERT INTO food_item (food_id, name, calories_per_serving, serving_unit) VALUES (?, ?, ?, ?)");
  inTransaction(db, () => {
    for (const [name, cal, unit] of starterFoods) if (!exists.get(name)) insert.run(randomUUID(), name, cal, unit);
  });
  return db;
}

const db = openDb(dbFile);

export default db;
