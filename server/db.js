import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.DB_FILE || path.join(dir, "data.db");

const db = new DatabaseSync(dbFile);
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    calorie_goal INTEGER NOT NULL DEFAULT 2000,
    water_goal INTEGER NOT NULL DEFAULT 64,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- user_id null = built in food everyone can see
  CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    meal TEXT NOT NULL CHECK (meal IN ('Breakfast','Lunch','Dinner','Snacks')),
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS water_logs (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    oz INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  );

  CREATE TABLE IF NOT EXISTS weight_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    weight REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS diary_entries (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    note TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date)
  );
`);

//starter foods (same as the old mock list)
const count = db.prepare("SELECT COUNT(*) AS n FROM foods WHERE user_id IS NULL").get().n;
if (count === 0) {
  const insert = db.prepare("INSERT INTO foods (name, calories) VALUES (?, ?)");
  [
    ["Brown Egg", 60],
    ["Brown Egg (Large)", 80],
    ["White Egg", 55],
    ["Chicken Breast (100g)", 165],
    ["Banana", 105],
    ["Apple", 95],
    ["Oatmeal (1 cup)", 154],
    ["Milk (1 cup)", 60],
  ].forEach(([name, cal]) => insert.run(name, cal));
}

export default db;
