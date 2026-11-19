//the calorie goal and reminder, water, weight and the diary
import express from "express";
import db from "./db.js";
import { getDailyTotal } from "./entries.js";
import { check, dateSchema, targetSchema, reminderSchema, waterSchema, weightSchema, noteSchema } from "./validate.js";

//---- goal and reminder ----
function getGoal(userId) {
  const row = db.prepare("SELECT * FROM goal WHERE user_id = ?").get(userId);
  return row ? { targetCalories: row.target_calories, reminderTime: row.reminder_time } : null;
}

export const goalRoutes = express.Router();

//the goal plus how a day is going against it (null if no goal yet)
goalRoutes.get("/", (req, res) => {
  const date = check(dateSchema, req.query.date);
  const goal = getGoal(req.userId);
  if (!goal) return res.json(null);
  const total = getDailyTotal(req.userId, date);
  res.json({ ...goal, date, total, onTrack: total <= goal.targetCalories });
});

goalRoutes.put("/target", (req, res) => {
  const { targetCalories } = check(targetSchema, req.body);
  db.prepare(
    `INSERT INTO goal (user_id, target_calories) VALUES (?, ?)
     ON CONFLICT (user_id) DO UPDATE SET target_calories = excluded.target_calories`
  ).run(req.userId, targetCalories);
  res.json(getGoal(req.userId));
});

//null turns the reminder off. needs a goal first
goalRoutes.put("/reminder", (req, res) => {
  const { reminderTime } = check(reminderSchema, req.body);
  const { changes } = db.prepare("UPDATE goal SET reminder_time = ? WHERE user_id = ?").run(reminderTime, req.userId);
  if (!changes) return res.status(400).json({ error: "Set a daily calorie goal first." });
  res.json(getGoal(req.userId));
});

//---- water, one amount per day ----
export const waterRoutes = express.Router();

waterRoutes.get("/", (req, res) => {
  const date = check(dateSchema, req.query.date);
  const row = db.prepare("SELECT ounces FROM water_log WHERE user_id = ? AND log_date = ?").get(req.userId, date);
  res.json({ date, ounces: row ? row.ounces : 0 });
});

//the +/- buttons send the new total, not the change
waterRoutes.put("/", (req, res) => {
  const { date, ounces } = check(waterSchema, req.body);
  db.prepare(
    `INSERT INTO water_log (user_id, log_date, ounces) VALUES (?, ?, ?)
     ON CONFLICT (user_id, log_date) DO UPDATE SET ounces = excluded.ounces`
  ).run(req.userId, date, ounces);
  res.json({ date, ounces });
});

//---- weight, one weigh-in per day ----
//oldest first, so the chart reads left to right
function getWeights(userId) {
  return db
    .prepare("SELECT log_date, pounds FROM weight_log WHERE user_id = ? ORDER BY log_date")
    .all(userId)
    .map((r) => ({ date: r.log_date, pounds: r.pounds }));
}

export const weightRoutes = express.Router();

weightRoutes.get("/", (req, res) => res.json(getWeights(req.userId)));

//logging the same day again replaces it. sends back the whole list so the chart can redraw
weightRoutes.put("/", (req, res) => {
  const { date, pounds } = check(weightSchema, req.body);
  //a day of slack for time zones ahead of the server
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");
  if (date > tomorrow) return res.status(400).json({ error: "You can't log a weight for a future date.", field: "date" });
  db.prepare(
    `INSERT INTO weight_log (user_id, log_date, pounds) VALUES (?, ?, ?)
     ON CONFLICT (user_id, log_date) DO UPDATE SET pounds = excluded.pounds`
  ).run(req.userId, date, pounds);
  res.json(getWeights(req.userId));
});

weightRoutes.delete("/:date", (req, res) => {
  const date = check(dateSchema, req.params.date);
  const { changes } = db.prepare("DELETE FROM weight_log WHERE user_id = ? AND log_date = ?").run(req.userId, date);
  if (!changes) return res.status(404).json({ error: "There's no weight logged for that day." });
  res.json(getWeights(req.userId));
});

//---- diary, one note per day ----
const PREVIEW_LENGTH = 40;
export const diaryRoutes = express.Router();

//the list on the side of the diary page, newest first
diaryRoutes.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT note_date, substr(note, 1, ?) AS preview, length(note) AS len
       FROM diary_note WHERE user_id = ? ORDER BY note_date DESC`
    )
    .all(PREVIEW_LENGTH, req.userId);
  res.json(rows.map((r) => ({ date: r.note_date, preview: r.len > PREVIEW_LENGTH ? r.preview + "..." : r.preview })));
});

diaryRoutes.get("/:date", (req, res) => {
  const date = check(dateSchema, req.params.date);
  const row = db.prepare("SELECT note FROM diary_note WHERE user_id = ? AND note_date = ?").get(req.userId, date);
  res.json({ date, note: row ? row.note : "" });
});

//an empty note deletes the day
diaryRoutes.put("/:date", (req, res) => {
  const date = check(dateSchema, req.params.date);
  const { note } = check(noteSchema, req.body);
  if (!note.trim()) {
    db.prepare("DELETE FROM diary_note WHERE user_id = ? AND note_date = ?").run(req.userId, date);
    return res.json({ date, note: "" });
  }
  db.prepare(
    `INSERT INTO diary_note (user_id, note_date, note) VALUES (?, ?, ?)
     ON CONFLICT (user_id, note_date) DO UPDATE SET note = excluded.note`
  ).run(req.userId, date, note);
  res.json({ date, note });
});
