import express from "express";
import db from "./db.js";
import { hashPassword, checkPassword, makeToken, requireAuth } from "./auth.js";

const router = express.Router();
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const today = () => new Date().toLocaleDateString("en-CA");

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
export const isStrongPassword = (s) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(s || "");

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, calorieGoal: u.calorie_goal, waterGoal: u.water_goal };
}

//auth
router.post("/auth/register", (req, res) => {
  const { email, password, name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Enter your name." });
  if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email." });
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: "Use 8+ characters with a letter and a number." });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim());
  if (exists) return res.status(409).json({ error: "An account with this email already exists." });

  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)")
    .run(email.trim(), hashPassword(password), name.trim());
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(lastInsertRowid);
  res.status(201).json({ token: makeToken(user.id), user: publicUser(user) });
});

router.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email." });
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim());
  if (!user || !checkPassword(password || "", user.password_hash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  res.json({ token: makeToken(user.id), user: publicUser(user) });
});

//everything below needs a token
router.use(requireAuth);

router.get("/me", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

//change daily calorie goal
router.put("/me/calorie-goal", (req, res) => {
  const goal = Number(req.body?.calorieGoal);
  if (!Number.isInteger(goal) || goal < 500 || goal > 10000) {
    return res.status(400).json({ error: "Goal must be a whole number from 500 to 10000." });
  }
  db.prepare("UPDATE users SET calorie_goal = ? WHERE id = ?").run(goal, req.userId);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  res.json(publicUser(user));
});

//foods
router.get("/foods", (req, res) => {
  const q = `%${req.query.q || ""}%`;
  const foods = db
    .prepare(
      `SELECT id, name, calories, user_id IS NOT NULL AS custom FROM foods
       WHERE (user_id IS NULL OR user_id = ?) AND name LIKE ? ORDER BY name`
    )
    .all(req.userId, q);
  res.json(foods.map((f) => ({ ...f, custom: !!f.custom })));
});

router.post("/foods", (req, res) => {
  const { name, calories } = req.body || {};
  if (!name || !(Number(calories) >= 0)) return res.status(400).json({ error: "Name and calories required" });
  const { lastInsertRowid } = db
    .prepare("INSERT INTO foods (user_id, name, calories) VALUES (?, ?, ?)")
    .run(req.userId, name.trim(), Number(calories));
  res.status(201).json({ id: Number(lastInsertRowid), name: name.trim(), calories: Number(calories), custom: true });
});

//meals, grouped the same way App.jsx had them
router.get("/meals", (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : today();
  const rows = db
    .prepare("SELECT id, meal, name, calories, food_id AS foodId FROM meal_entries WHERE user_id = ? AND date = ? ORDER BY id")
    .all(req.userId, date);
  const meals = Object.fromEntries(MEALS.map((m) => [m, []]));
  rows.forEach((r) => meals[r.meal].push(r));
  res.json(meals);
});

router.post("/meals", (req, res) => {
  const { meal, name, calories, foodId = null } = req.body || {};
  const date = isDate(req.body?.date) ? req.body.date : today();
  if (!MEALS.includes(meal)) return res.status(400).json({ error: "Bad meal name" });
  if (!name || !(Number(calories) >= 0)) return res.status(400).json({ error: "Name and calories required" });
  const { lastInsertRowid } = db
    .prepare("INSERT INTO meal_entries (user_id, date, meal, name, calories, food_id) VALUES (?, ?, ?, ?, ?, ?)")
    .run(req.userId, date, meal, name, Number(calories), foodId);
  res.status(201).json({ id: Number(lastInsertRowid), meal, name, calories: Number(calories), foodId, date });
});

router.delete("/meals/:id", (req, res) => {
  const { changes } = db.prepare("DELETE FROM meal_entries WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  if (!changes) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

//water
router.get("/water", (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : today();
  const row = db.prepare("SELECT oz FROM water_logs WHERE user_id = ? AND date = ?").get(req.userId, date);
  res.json({ date, oz: row ? row.oz : 0 });
});

router.put("/water", (req, res) => {
  const date = isDate(req.body?.date) ? req.body.date : today();
  const oz = Math.max(0, Number(req.body?.oz) || 0);
  db.prepare(
    `INSERT INTO water_logs (user_id, date, oz) VALUES (?, ?, ?)
     ON CONFLICT (user_id, date) DO UPDATE SET oz = excluded.oz`
  ).run(req.userId, date, oz);
  res.json({ date, oz });
});

//weight
router.get("/weight", (req, res) => {
  const rows = db.prepare("SELECT id, date, weight FROM weight_logs WHERE user_id = ? ORDER BY date, id").all(req.userId);
  res.json(rows);
});

router.post("/weight", (req, res) => {
  const { date, weight } = req.body || {};
  if (!isDate(date) || !(Number(weight) > 0)) return res.status(400).json({ error: "Date and weight required" });
  const { lastInsertRowid } = db
    .prepare("INSERT INTO weight_logs (user_id, date, weight) VALUES (?, ?, ?)")
    .run(req.userId, date, Number(weight));
  res.status(201).json({ id: Number(lastInsertRowid), date, weight: Number(weight) });
});

router.delete("/weight/:id", (req, res) => {
  const { changes } = db.prepare("DELETE FROM weight_logs WHERE id = ? AND user_id = ?").run(req.params.id, req.userId);
  if (!changes) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

//diary, returns { "2026-11-17": "note", ... }
router.get("/diary", (req, res) => {
  const rows = db.prepare("SELECT date, note FROM diary_entries WHERE user_id = ?").all(req.userId);
  res.json(Object.fromEntries(rows.map((r) => [r.date, r.note])));
});

router.put("/diary/:date", (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: "Bad date" });
  const note = req.body?.note || "";
  //empty note deletes it
  if (!note.trim()) {
    db.prepare("DELETE FROM diary_entries WHERE user_id = ? AND date = ?").run(req.userId, date);
    return res.json({ date, note: "" });
  }
  db.prepare(
    `INSERT INTO diary_entries (user_id, date, note) VALUES (?, ?, ?)
     ON CONFLICT (user_id, date) DO UPDATE SET note = excluded.note, updated_at = CURRENT_TIMESTAMP`
  ).run(req.userId, date, note);
  res.json({ date, note });
});

export default router;
