//meals and snacks (entries): add, edit, delete, a day's total, search, and the chart data
import express from "express";
import { randomUUID } from "node:crypto";
import db, { inTransaction } from "./db.js";
import { getCalories } from "./foods.js";
import { check, entrySchema, dateSchema, filterSchema, trendSchema } from "./validate.js";

const MAX_SEARCH_RESULTS = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function ownsEntry(userId, entryId) {
  const row = db.prepare('SELECT 1 FROM entry WHERE entry_id = ? AND user_id = ?').get(entryId, userId);
  return row !== undefined;
}

// --- Entry methods (used inside transactions, so these are sync) ---

// stores the item with its calories worked out from the food.
// someone else's custom food counts as not existing
function addItem(userId, entryId, foodId, portion) {
  const food = db
    .prepare('SELECT * FROM food_item WHERE food_id = ? AND (created_by IS NULL OR created_by = ?)')
    .get(foodId, userId);
  if (!food) {
    const err = new Error('That food no longer exists.');
    err.status = 400;
    throw err;
  }
  const calories = getCalories({ caloriesPerServing: food.calories_per_serving }, portion);
  db.prepare('INSERT INTO entry_item (entry_id, food_id, portion, calories) VALUES (?, ?, ?, ?)').run(
    entryId, foodId, portion, calories
  );
}

function edit(entryId, { date, time, mealType }) {
  db.prepare('UPDATE entry SET entry_date = ?, entry_time = ?, meal_type = ? WHERE entry_id = ?').run(
    date, time, mealType, entryId
  );
}

function setContext(entryId, { mood, location, activity }) {
  db.prepare('UPDATE entry SET mood = ?, location = ?, activity = ? WHERE entry_id = ?').run(
    mood ?? null, location ?? null, activity ?? null, entryId
  );
}

function calculateCalories(items) {
  let total = 0;
  for (const item of items) total += item.calories;
  return round1(total);
}

// builds the object the frontend gets for one entry
function toEntry(row) {
  const itemRows = db
    .prepare(
      `SELECT i.food_id, i.portion, i.calories, f.name, f.serving_unit, f.calories_per_serving
       FROM entry_item i JOIN food_item f ON f.food_id = i.food_id
       WHERE i.entry_id = ? ORDER BY f.name`
    )
    .all(row.entry_id);

  const items = itemRows.map((i) => ({
    foodId: i.food_id,
    name: i.name,
    servingUnit: i.serving_unit,
    caloriesPerServing: i.calories_per_serving,
    portion: i.portion,
    calories: i.calories
  }));

  return {
    entryId: row.entry_id,
    date: row.entry_date,
    time: row.entry_time,
    mealType: row.meal_type,
    mood: row.mood,
    location: row.location,
    activity: row.activity,
    items,
    totalCalories: calculateCalories(items)
  };
}

// --- User methods ---

// returns the new entry's id
export function addEntry(userId, entry) {
  const entryId = randomUUID();
  inTransaction(db, () => {
    db.prepare(
      'INSERT INTO entry (entry_id, user_id, meal_type, entry_date, entry_time) VALUES (?, ?, ?, ?, ?)'
    ).run(entryId, userId, entry.mealType, entry.date, entry.time);
    setContext(entryId, entry);
    for (const item of entry.items) addItem(userId, entryId, item.foodId, item.portion);
  });
  return entryId;
}

export function getEntry(userId, entryId) {
  const row = db.prepare('SELECT * FROM entry WHERE entry_id = ? AND user_id = ?').get(entryId, userId);
  return row ? toEntry(row) : null;
}

export function getEntries(userId, date) {
  const rows = db
    .prepare('SELECT * FROM entry WHERE user_id = ? AND entry_date = ? ORDER BY entry_time')
    .all(userId, date);
  return rows.map(toEntry);
}

// saves the edit form. the list of foods sent replaces the old one
export function updateEntry(userId, entryId, data) {
  if (!ownsEntry(userId, entryId)) return false;
  inTransaction(db, () => {
    edit(entryId, data);
    setContext(entryId, data);
    db.prepare('DELETE FROM entry_item WHERE entry_id = ?').run(entryId);
    for (const item of data.items) addItem(userId, entryId, item.foodId, item.portion);
  });
  return true;
}

// entry_item rows are removed by ON DELETE CASCADE
export function deleteEntry(userId, entryId) {
  const result = db.prepare('DELETE FROM entry WHERE entry_id = ? AND user_id = ?').run(entryId, userId);
  return result.changes > 0;
}

export function getDailyTotal(userId, date) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(i.calories), 0) AS total
       FROM entry_item i JOIN entry e ON e.entry_id = i.entry_id
       WHERE e.user_id = ? AND e.entry_date = ?`
    )
    .get(userId, date);
  return round1(row.total);
}

// LIKE pattern for "contains", with % and _ escaped
function containsPattern(text) {
  return '%' + text.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
}

// every filter field is optional. newest first
export function searchEntries(userId, filter) {
  const conditions = ['e.user_id = ?'];
  const params = [userId];

  if (filter.startDate) {
    conditions.push('e.entry_date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push('e.entry_date <= ?');
    params.push(filter.endDate);
  }
  // fixed list of column names, so nothing from the user goes into the sql text
  for (const column of ['mood', 'location', 'activity']) {
    if (filter[column]) {
      conditions.push(`e.${column} LIKE ? ESCAPE '\\'`);
      params.push(containsPattern(filter[column]));
    }
  }
  if (filter.food) {
    conditions.push(
      `EXISTS (SELECT 1 FROM entry_item i JOIN food_item f ON f.food_id = i.food_id
               WHERE i.entry_id = e.entry_id AND f.name LIKE ? ESCAPE '\\')`
    );
    params.push(containsPattern(filter.food));
  }

  const rows = db
    .prepare(
      `SELECT e.* FROM entry e WHERE ${conditions.join(' AND ')}
       ORDER BY e.entry_date DESC, e.entry_time DESC LIMIT ${MAX_SEARCH_RESULTS}`
    )
    .all(...params);
  return rows.map(toEntry);
}

// the last `period` dates up to endDate, oldest first (YYYY-MM-DD)
export function lastDays(endDate, period) {
  const end = Date.parse(endDate + 'T00:00:00Z');
  const days = [];
  for (let i = period - 1; i >= 0; i--) {
    days.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10));
  }
  return days;
}

// one total per day for the chart, 0 for days with nothing logged
export function getTrend(userId, endDate, period) {
  const days = lastDays(endDate, period);
  const rows = db
    .prepare(
      `SELECT e.entry_date AS day, SUM(i.calories) AS total
       FROM entry e JOIN entry_item i ON i.entry_id = e.entry_id
       WHERE e.user_id = ? AND e.entry_date BETWEEN ? AND ?
       GROUP BY e.entry_date`
    )
    .all(userId, days[0], endDate);

  const totals = {};
  for (const row of rows) totals[row.day] = row.total;
  return days.map((day) => round1(totals[day] ?? 0));
}

const router = express.Router();

//a whole day: the entries plus the daily total
router.get("/", (req, res) => {
  const date = check(dateSchema, req.query.date);
  res.json({ date, total: getDailyTotal(req.userId, date), entries: getEntries(req.userId, date) });
});

//has to come before /:id or "search" would be read as an id
router.get("/search", (req, res) => {
  const filter = check(filterSchema, req.query);
  res.json(searchEntries(req.userId, filter));
});

//daily totals for the progress chart
router.get("/trend", (req, res) => {
  const { endDate, period } = check(trendSchema, req.query);
  res.json({ days: lastDays(endDate, period), totals: getTrend(req.userId, endDate, period) });
});

router.get("/:id", (req, res) => {
  const entry = getEntry(req.userId, req.params.id);
  if (!entry) return res.status(404).json({ error: "That entry doesn't exist." });
  res.json(entry);
});

router.post("/", (req, res) => {
  const id = addEntry(req.userId, check(entrySchema, req.body));
  res.status(201).json(getEntry(req.userId, id));
});

router.put("/:id", (req, res) => {
  const ok = updateEntry(req.userId, req.params.id, check(entrySchema, req.body));
  if (!ok) return res.status(404).json({ error: "That entry doesn't exist." });
  res.json(getEntry(req.userId, req.params.id));
});

router.delete("/:id", (req, res) => {
  if (!deleteEntry(req.userId, req.params.id)) return res.status(404).json({ error: "That entry doesn't exist." });
  res.status(204).end();
});

export default router;
