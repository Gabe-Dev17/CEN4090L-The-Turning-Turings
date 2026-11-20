import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// fresh in-memory db every run, has to be set before the app loads
process.env.DB_FILE = ':memory:';
// never call the real usda api from these tests, even if a key is set in the environment
process.env.FDC_API_KEY = '';
process.env.AUTH_SECRET = 'test-secret';
const { default: app } = await import('../index.js');

let server, base;

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

// tiny client that keeps its own login token, like the browser does in localStorage
function client() {
  let token = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (data?.token) token = data.token;
    return { status: res.status, body: data };
  };
}

const alice = client();
const bob = client();
const today = '2026-09-25';

test('register, log out, and log back in', async () => {
  let r = await alice('POST', '/auth/register', { name: 'Alice', email: 'alice@test.com', password: 'password123' });
  assert.equal(r.status, 201);
  assert.ok(r.body.token, 'signing up logs you in');
  assert.deepEqual(Object.keys(r.body.user).sort(), ['displayName', 'email', 'userId'], 'no password hash is sent');

  r = await client()('POST', '/auth/register', { name: 'Alice 2', email: 'ALICE@test.com', password: 'password123' });
  assert.equal(r.status, 409, 'same email with different caps is still taken');
  assert.equal(r.body.field, 'email');

  assert.equal((await alice('GET', '/me')).body.displayName, 'Alice');
  // logging out is the browser forgetting its token, so a fresh client is logged out
  assert.equal((await client()('GET', '/me')).status, 401);

  const again = client();
  r = await again('POST', '/auth/login', { email: 'alice@test.com', password: 'wrongpass' });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'Email or password is incorrect.');
  r = await again('POST', '/auth/login', { email: 'nobody@test.com', password: 'password123' });
  assert.equal(r.body.error, 'Email or password is incorrect.', 'same message, so it does not show who has an account');
  r = await again('POST', '/auth/login', { email: ' ALICE@test.com ', password: 'password123' });
  assert.equal(r.status, 200, 'email ignores caps and spaces');
  assert.equal(r.body.user.displayName, 'Alice');
});

test('bad input gets a clear 400', async () => {
  let r = await bob('POST', '/auth/register', { name: 'Bob', email: 'not-an-email', password: 'password123' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /email/i);

  r = await bob('POST', '/auth/register', { name: 'Bob', email: 'bob@test.com', password: 'short' });
  assert.equal(r.status, 400);
  assert.equal(r.body.field, 'password', 'the error says which field so the login page can show it there');
  r = await bob('POST', '/auth/register', { name: 'Bob', email: 'bob@test.com', password: 'longbutnonumber' });
  assert.equal(r.status, 400, 'passwords need a number too');
  r = await bob('POST', '/auth/register', { name: '', email: 'bob@test.com', password: 'password123' });
  assert.equal(r.body.field, 'name');
});

test('entries need a login', async () => {
  const stranger = client();
  assert.equal((await stranger('GET', `/entries?date=${today}`)).status, 401);
});

test('picking a usda food checks the id', async () => {
  const carol = client();
  await carol('POST', '/auth/register', { name: 'Carol', email: 'carol@test.com', password: 'password123' });
  assert.equal((await carol('POST', '/foods/external', { externalId: 'abc' })).status, 400);
  assert.equal((await carol('POST', '/foods/external', { externalId: '12345' })).status, 404, 'not in a recent search');
  assert.equal((await client()('POST', '/foods/external', { externalId: '12345' })).status, 401, 'needs a login');
});

test('add, total, edit, and delete an entry', async () => {
  const foods = (await alice('GET', '/foods?q=ban')).body;
  const banana = foods.find((f) => f.name === 'Banana');
  const oats = (await alice('GET', '/foods?q=oat')).body[0];
  assert.ok(banana && oats);

  let r = await alice('POST', '/entries', {
    date: today,
    time: '08:15',
    mealType: 'BREAKFAST',
    mood: 'calm',
    location: '',
    items: [
      { foodId: banana.foodId, portion: 1 },
      { foodId: oats.foodId, portion: 1.5 }
    ]
  });
  assert.equal(r.status, 201);
  const entry = r.body;
  assert.equal(entry.items.length, 2);
  assert.equal(entry.location, null, 'blank optional fields are stored as empty');
  assert.equal(entry.totalCalories, banana.caloriesPerServing + oats.caloriesPerServing * 1.5);

  r = await alice('GET', `/entries?date=${today}`);
  assert.equal(r.body.total, entry.totalCalories);

  r = await alice('PUT', `/entries/${entry.entryId}`, {
    date: today,
    time: '09:00',
    mealType: 'BREAKFAST',
    items: [{ foodId: banana.foodId, portion: 2 }]
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.items.length, 1);
  assert.equal(r.body.totalCalories, banana.caloriesPerServing * 2);
  assert.equal(r.body.mood, null);

  assert.equal((await alice('DELETE', `/entries/${entry.entryId}`)).status, 204);
  r = await alice('GET', `/entries?date=${today}`);
  assert.equal(r.body.total, 0);
  assert.equal(r.body.entries.length, 0);
});

test('the same food can only be listed once per entry', async () => {
  const c = client();
  await c('POST', '/auth/register', { name: 'Ivy', email: 'ivy@test.com', password: 'password123' });
  const banana = (await c('GET', '/foods?q=banana')).body[0];
  const r = await c('POST', '/entries', {
    date: today, time: '09:00', mealType: 'SNACK',
    items: [{ foodId: banana.foodId, portion: 1 }, { foodId: banana.foodId, portion: 2 }]
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /only be listed once/);
});

test('entries are rejected when the data is wrong', async () => {
  const food = (await alice('GET', '/foods?q=apple')).body[0];
  const good = { date: today, time: '12:00', mealType: 'LUNCH', items: [{ foodId: food.foodId, portion: 1 }] };

  for (const bad of [
    { ...good, items: [] },
    { ...good, mealType: 'BRUNCH' },
    { ...good, date: '2026-13-45' },
    { ...good, time: '25:00' },
    { ...good, items: [{ foodId: food.foodId, portion: 0 }] },
    { ...good, items: [{ foodId: 'made-up-id', portion: 1 }] }
  ]) {
    const r = await alice('POST', '/entries', bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
});

test("users can't see or change each other's entries", async () => {
  await bob('POST', '/auth/register', { name: 'Bob', email: 'bob@test.com', password: 'password123' });
  const food = (await alice('GET', '/foods?q=egg')).body[0];
  const mine = (
    await alice('POST', '/entries', { date: today, time: '07:00', mealType: 'BREAKFAST', items: [{ foodId: food.foodId, portion: 2 }] })
  ).body;

  assert.equal((await bob('GET', `/entries/${mine.entryId}`)).status, 404);
  assert.equal((await bob('DELETE', `/entries/${mine.entryId}`)).status, 404);
  assert.equal((await bob('GET', `/entries?date=${today}`)).body.entries.length, 0);
  assert.equal((await alice('GET', `/entries/${mine.entryId}`)).status, 200);
});

// helpers for the stretch goal tests: a new user with a few entries on different days
async function userWithEntries(name) {
  const c = client();
  await c('POST', '/auth/register', { name: name, email: `${name}@test.com`, password: 'password123' });
  const food = async (q) => (await c('GET', `/foods?q=${q}`)).body[0];
  const banana = await food('banana');
  const rice = await food('brown rice');
  const add = (date, mealType, foodId, portion, extra = {}) =>
    c('POST', '/entries', { date, time: '12:00', mealType, items: [{ foodId, portion }], ...extra });
  await add('2026-09-20', 'BREAKFAST', banana.foodId, 1, { mood: 'Happy', location: 'Home' });
  await add('2026-09-22', 'LUNCH', rice.foodId, 2, { mood: 'stressed', location: 'Campus', activity: 'studying' });
  await add('2026-09-22', 'SNACK', banana.foodId, 2, { activity: '100% focused_on_work' });
  return { c, banana, rice };
}

test('search and filter entries', async () => {
  const { c } = await userWithEntries('dana');
  const search = async (q) => (await c('GET', `/entries/search?${new URLSearchParams(q)}`)).body;

  assert.equal((await search({})).length, 3, 'no filters returns everything');
  assert.equal((await search({ food: 'BANANA' })).length, 2, 'food match ignores case');
  assert.equal((await search({ mood: 'happy' }))[0].date, '2026-09-20');
  assert.equal((await search({ location: 'camp', activity: 'study' })).length, 1, 'filters combine');
  assert.deepEqual((await search({ startDate: '2026-09-21', endDate: '2026-09-22' })).map((e) => e.date), ['2026-09-22', '2026-09-22']);
  assert.equal((await search({ startDate: '2026-09-21', endDate: '' })).length, 2, 'blank end date is ignored');
  assert.equal((await search({ activity: '100%' })).length, 1, '% is searched literally');
  assert.equal((await search({ activity: 'focused_on' })).length, 1, '_ is searched literally');
  assert.equal((await search({ activity: 'o_w' })).length, 0, '_ is not a wildcard');

  const r = await c('GET', '/entries/search?startDate=2026-09-22&endDate=2026-09-20');
  assert.equal(r.status, 400, 'start after end is rejected');
});

test('search returns at most the 100 newest entries', async () => {
  const c = client();
  await c('POST', '/auth/register', { name: 'max', email: 'max100@test.com', password: 'password123' });
  const banana = (await c('GET', '/foods?q=banana')).body[0];
  // 101 entries, one a day starting 2026-01-01
  for (let i = 0; i < 101; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    const r = await c('POST', '/entries', { date: d, time: '12:00', mealType: 'SNACK', items: [{ foodId: banana.foodId, portion: 1 }] });
    assert.equal(r.status, 201);
  }
  const found = (await c('GET', '/entries/search')).body;
  assert.equal(found.length, 100, 'capped at 100');
  assert.equal(found[0].date, '2026-04-11', 'newest first');
  assert.equal(found.at(-1).date, '2026-01-02', 'the oldest one is left out');
});

test('trend gives one total per day, zeros included', async () => {
  const { c, banana, rice } = await userWithEntries('erin');
  const r = await c('GET', '/entries/trend?endDate=2026-09-22&period=3');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.days, ['2026-09-20', '2026-09-21', '2026-09-22']);
  const lunch = Math.round(rice.caloriesPerServing * 2 * 10) / 10;
  const snack = Math.round(banana.caloriesPerServing * 2 * 10) / 10;
  assert.deepEqual(r.body.totals, [banana.caloriesPerServing, 0, Math.round((lunch + snack) * 10) / 10]);

  assert.equal((await c('GET', '/entries/trend?endDate=2026-09-22&period=91')).status, 400);
  assert.equal((await c('GET', '/entries/trend?endDate=bad&period=7')).status, 400);
  const month = await c('GET', '/entries/trend?endDate=2026-03-01&period=3');
  assert.deepEqual(month.body.days, ['2026-02-27', '2026-02-28', '2026-03-01'], 'crosses month ends correctly');
});

test('goals, progress, and reminders', async () => {
  const { c } = await userWithEntries('finn');
  let r = await c('GET', '/goal?date=2026-09-22');
  assert.equal(r.body, null, 'no goal yet');

  r = await c('PUT', '/goal/reminder', { reminderTime: '08:00' });
  assert.equal(r.status, 400, 'reminder needs a goal first');

  r = await c('PUT', '/goal/target', { targetCalories: 2000 });
  assert.deepEqual(r.body, { targetCalories: 2000, reminderTime: null });
  r = await c('PUT', '/goal/target', { targetCalories: 400 });
  assert.equal(r.status, 400, 'too-low goals are rejected');
  r = await c('PUT', '/goal/target', { targetCalories: 300 + 200 });
  assert.equal(r.body.targetCalories, 500, 'updating keeps one goal row');

  r = await c('GET', '/goal?date=2026-09-22');
  assert.equal(r.body.onTrack, r.body.total <= 500);
  assert.equal(r.body.onTrack, false, 'the 22nd is over 500 kcal');
  assert.equal((await c('GET', '/goal?date=2026-09-21')).body.onTrack, true, 'an empty day is on track');

  r = await c('PUT', '/goal/reminder', { reminderTime: '19:30' });
  assert.equal(r.body.reminderTime, '19:30');
  assert.equal((await c('PUT', '/goal/reminder', { reminderTime: '25:00' })).status, 400);
  r = await c('PUT', '/goal/reminder', { reminderTime: '' });
  assert.equal(r.body.reminderTime, null, 'blank turns reminders off');
});

test("search, trend, and goals only show your own data", async () => {
  await userWithEntries('gail');
  const stranger = client();
  await stranger('POST', '/auth/register', { name: 'Hal', email: 'hal@test.com', password: 'password123' });
  assert.equal((await stranger('GET', '/entries/search')).body.length, 0);
  assert.deepEqual((await stranger('GET', '/entries/trend?endDate=2026-09-22&period=3')).body.totals, [0, 0, 0]);
  assert.equal((await stranger('GET', '/goal?date=2026-09-22')).body, null);
  assert.equal((await client()('GET', '/goal?date=2026-09-22')).status, 401, 'needs a login');
});
