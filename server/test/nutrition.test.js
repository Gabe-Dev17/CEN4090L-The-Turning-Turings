import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NutritionApiAdapter, toFood } from '../usda.js';

process.env.DB_FILE = ':memory:';
const foods = await import('../foods.js');
const { default: db } = await import('../db.js');

const kcal = (value, nutrientId = 1008) => [{ nutrientId, unitName: 'KCAL', value }];

// shaped like real fdc search results, trimmed down
const generic = [
  { fdcId: 168917, description: 'Quinoa, cooked', dataType: 'SR Legacy', foodNutrients: kcal(120) },
  { fdcId: 2344803, description: 'Quinoa, cooked', dataType: 'Survey (FNDDS)', brandOwner: 'Not a branded item', foodNutrients: kcal(172, 2047) }
];
const branded = [
  { fdcId: 2058561, description: 'QUINOA', brandOwner: 'KROGER', foodNutrients: kcal(333) },
  { fdcId: 386410, description: 'QUINOA', brandOwner: 'IMG Holdings Inc.', foodNutrients: kcal(360) },
  { fdcId: 2757484, description: 'The Laughing Cow Cheese &#38; Go', brandName: 'La Vache qui rit', foodNutrients: kcal(250) },
  { fdcId: 999, description: 'No calories listed', foodNutrients: [] }
];

// fake fetch that answers generic or branded searches and records every call
function fakeFetch({ status = 200 } = {}) {
  const calls = [];
  const fn = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body);
    const list = body.dataType.includes('Branded') ? branded : generic;
    return { ok: status < 400, status, json: async () => ({ foods: list }) };
  };
  fn.calls = calls;
  return fn;
}

const countSaved = () => db.prepare('SELECT COUNT(*) AS n FROM food_item WHERE external_id IS NOT NULL').get().n;

test('names are cleaned up', () => {
  assert.equal(toFood(branded[0]).name, 'Quinoa (Kroger)', 'all-caps food and brand');
  assert.equal(toFood(branded[1]).name, 'Quinoa (IMG Holdings Inc.)', 'mixed-case brand left alone');
  assert.equal(toFood(branded[2]).name, 'The Laughing Cow Cheese & Go (La Vache qui rit)', 'html characters decoded');
  assert.equal(toFood(generic[1]).name, 'Quinoa, cooked', '"not a branded item" dropped');
  assert.equal(toFood(branded[3]), null, 'no kcal value means no food');

  const long = toFood({ fdcId: 1, description: 'word '.repeat(40), foodNutrients: kcal(1) }).name;
  assert.ok(long.length <= 100 && long.endsWith('word…'), 'long names cut at a space');
});

test('generic foods come first, branded ones fill the rest', async () => {
  const fetchFn = fakeFetch();
  const found = await new NutritionApiAdapter('test-key', fetchFn).searchFoods('quinoa');
  assert.equal(fetchFn.calls.length, 2);
  assert.ok(fetchFn.calls[0].dataType.includes('SR Legacy'));
  assert.deepEqual(fetchFn.calls[1].dataType, ['Branded']);
  assert.deepEqual(found.map((f) => f.externalId), ['168917', '2344803', '2058561', '386410', '2757484']);
  assert.equal(found[0].caloriesPerServing, 120);
  assert.equal(found[0].servingUnit, '100 g');
});

test('adapter reports rate limits and errors', async () => {
  await assert.rejects(new NutritionApiAdapter('k', fakeFetch({ status: 429 })).searchFoods('x'), /rate limit/);
  await assert.rejects(new NutritionApiAdapter('k', fakeFetch({ status: 500 })).searchFoods('x'), /500/);
});

test('searching saves nothing, picking saves just that food', async () => {
  foods.setApiProvider(new NutritionApiAdapter('k', fakeFetch()));

  const results = await foods.searchFoods('quinoa');
  const pick = results.find((f) => f.externalId === '168917');
  assert.equal(pick.foodId, null, 'not saved yet');
  assert.equal(countSaved(), 0, 'search alone stores nothing');

  const saved = await foods.pickExternal('168917');
  assert.ok(saved.foodId);
  assert.equal(saved.caloriesPerServing, 120, 'calories come from the server copy');
  assert.equal(countSaved(), 1, 'only the picked food is stored');

  assert.equal((await foods.pickExternal('168917')).foodId, saved.foodId, 'picking again reuses the row');
  const again = await foods.searchFoods('quinoa');
  assert.equal(again.filter((f) => f.externalId === '168917').length, 1, 'no duplicate in results');
  assert.equal(again.find((f) => f.externalId === '168917').foodId, saved.foodId, 'shows up as saved now');

  assert.equal(await foods.pickExternal('424242'), null, 'unknown ids are refused');
});

test('short searches never call the api', async () => {
  const fetchFn = fakeFetch();
  foods.setApiProvider(new NutritionApiAdapter('k', fetchFn));
  await foods.searchFoods('qu');
  assert.equal(fetchFn.calls.length, 0);
});

test('local results skip the api when there are enough of them', async () => {
  const fetchFn = fakeFetch();
  foods.setApiProvider(new NutritionApiAdapter('k', fetchFn));
  const results = await foods.searchFoods('cooked'); // 5 starter foods are "..., cooked"
  assert.ok(results.length >= 5);
  assert.equal(fetchFn.calls.length, 0);
});

test('best matches come first: name starts with it, then a word does, then the rest', async () => {
  // "Chocolate chip cookie" is a starter food and contains "ki"
  const add = db.prepare("INSERT INTO food_item (food_id, name, calories_per_serving, serving_unit) VALUES (?, ?, 100, '1 cup')");
  add.run('test-kidney', 'Spicy kidney beans');
  add.run('test-kimchi', 'Kimchi');
  const names = (await foods.searchFoods('ki')).map((f) => f.name);
  assert.deepEqual(
    names.filter((n) => ['Kimchi', 'Spicy kidney beans', 'Chocolate chip cookie'].includes(n)),
    ['Kimchi', 'Spicy kidney beans', 'Chocolate chip cookie']
  );
  // and a % in the search is still a plain character
  assert.deepEqual(await foods.searchFoods('k%'), []);
});

test('search still works when the api is down', async () => {
  foods.setApiProvider(new NutritionApiAdapter('k', fakeFetch({ status: 503 })));
  const results = await foods.searchFoods('banana');
  assert.ok(results.some((f) => f.name === 'Banana'));
});
