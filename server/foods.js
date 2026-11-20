//food search (our database first, then usda), custom foods, and picking a usda food
import express from "express";
import { randomUUID } from "node:crypto";
import db from "./db.js";
import { NutritionApiAdapter } from "./usda.js";
import { check, customFoodSchema } from "./validate.js";

const MAX_RESULTS = 10;
const MIN_LOCAL_RESULTS = 5; //ask usda only when our search finds fewer than this
const MIN_API_SEARCH_LENGTH = 3;
const MAX_REMEMBERED = 500;

//usda is only used when an api key is set
let api = process.env.FDC_API_KEY ? new NutritionApiAdapter(process.env.FDC_API_KEY) : null;

//for tests
export function setApiProvider(adapter) {
  api = adapter;
}

//usda results that haven't been picked yet, by usda id. saving from this copy
//means the calories always come from usda, not from the browser
const recentApiFoods = new Map();

function rememberApiFood(food) {
  recentApiFoods.delete(food.externalId);
  recentApiFoods.set(food.externalId, food);
  if (recentApiFoods.size > MAX_REMEMBERED) recentApiFoods.delete(recentApiFoods.keys().next().value);
}

function toFood(row) {
  return {
    foodId: row.food_id,
    externalId: row.external_id,
    name: row.name,
    caloriesPerServing: row.calories_per_serving,
    servingUnit: row.serving_unit,
    custom: row.created_by !== null,
  };
}

function findByExternalId(externalId) {
  const row = db.prepare("SELECT * FROM food_item WHERE external_id = ?").get(externalId);
  return row ? toFood(row) : null;
}

//LocalFoodDatabase.searchFoods (the local INutritionProvider in the class diagram):
//shared foods (starter + usda) plus this user's custom foods. Order: custom ones first,
//then names that start with the search, then a word that starts with it, then the rest.
//% and _ are escaped so they're matched as normal characters
function searchLocal(keyword, userId) {
  const kw = keyword.replace(/[\\%_]/g, (c) => "\\" + c);
  return db
    .prepare(
      `SELECT * FROM food_item
       WHERE name LIKE ? ESCAPE '\\' AND (created_by IS NULL OR created_by = ?)
       ORDER BY created_by IS NULL,
                CASE WHEN name LIKE ? ESCAPE '\\' THEN 0 WHEN name LIKE ? ESCAPE '\\' THEN 1 ELSE 2 END,
                name
       LIMIT 10`
    )
    .all(`%${kw}%`, userId, `${kw}%`, `% ${kw}%`)
    .map(toFood);
}

//usda foods that aren't saved yet have foodId: null
export async function searchFoods(keyword, userId = null) {
  const results = searchLocal(keyword, userId);
  const askApi = api && keyword.length >= MIN_API_SEARCH_LENGTH && results.length < MIN_LOCAL_RESULTS;
  if (!askApi) return results.slice(0, MAX_RESULTS);

  try {
    for (const food of await api.searchFoods(keyword)) {
      const saved = findByExternalId(food.externalId);
      if (saved) {
        if (!results.some((r) => r.foodId === saved.foodId)) results.push(saved);
      } else {
        rememberApiFood(food);
        results.push({ ...food, foodId: null });
      }
    }
  } catch (err) {
    //usda down or rate limited, so just use our results
    console.warn("nutrition api search failed, using local foods only:", err.message);
  }
  return results.slice(0, MAX_RESULTS);
}

//adds the usda food, or updates it if that usda id is already saved
export function saveExternal(food) {
  const row = db
    .prepare(
      `INSERT INTO food_item (food_id, external_id, name, calories_per_serving, serving_unit)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (external_id) DO UPDATE SET
         name = excluded.name, calories_per_serving = excluded.calories_per_serving, serving_unit = excluded.serving_unit
       RETURNING *`
    )
    .get(randomUUID(), food.externalId, food.name, food.caloriesPerServing, food.servingUnit);
  return toFood(row);
}

//saves the usda food the user picked. null if it wasn't in a recent search
export function pickExternal(externalId) {
  const saved = findByExternalId(externalId);
  if (saved) return saved;
  const food = recentApiFoods.get(externalId);
  return food ? saveExternal(food) : null;
}

//calories for a portion, rounded to 1 decimal
export function getCalories(food, portion) {
  return Math.round(food.caloriesPerServing * portion * 10) / 10;
}

const router = express.Router();

router.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) return res.json([]);
  res.json(await searchFoods(q.slice(0, 50), req.userId));
});

router.post("/external", (req, res) => {
  const externalId = String(req.body?.externalId ?? "").trim();
  if (!/^\d{1,12}$/.test(externalId)) return res.status(400).json({ error: "That food id isn't valid." });
  const food = pickExternal(externalId);
  if (!food) return res.status(404).json({ error: "That food isn't available anymore. Search for it again." });
  res.json(food);
});

//a custom food from the Add page, only this user can see it
router.post("/", (req, res) => {
  const food = check(customFoodSchema, req.body);
  const row = db
    .prepare(
      `INSERT INTO food_item (food_id, name, calories_per_serving, serving_unit, created_by)
       VALUES (?, ?, ?, ?, ?) RETURNING *`
    )
    .get(randomUUID(), food.name, food.caloriesPerServing, food.servingUnit, req.userId);
  res.status(201).json(toFood(row));
});

export default router;
