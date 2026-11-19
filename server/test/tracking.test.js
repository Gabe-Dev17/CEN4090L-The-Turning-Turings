import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// custom foods, water, weight, and the diary (the pages the team frontend added)
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

async function newUser(name) {
  const c = client();
  await c('POST', '/auth/register', { name: name, email: `${name}@test.com`, password: 'password123' });
  return c;
}

const day = '2026-11-03';

test('custom foods can be logged but only their owner sees them', async () => {
  const dana = await newUser('dana');
  const eli = await newUser('eli');

  let r = await dana('POST', '/foods', { name: "Grandma's lasagna", caloriesPerServing: 410 });
  assert.equal(r.status, 201);
  const lasagna = r.body;
  assert.equal(lasagna.servingUnit, 'serving', 'blank serving size defaults to serving');
  assert.equal(lasagna.custom, true);

  assert.equal((await dana('POST', '/foods', { name: 'Bad', caloriesPerServing: -5 })).status, 400);
  assert.equal((await dana('POST', '/foods', { name: '', caloriesPerServing: 5 })).status, 400);

  r = await dana('GET', '/foods?q=lasagna');
  assert.equal(r.body[0].foodId, lasagna.foodId, 'own custom foods show up first');
  r = await eli('GET', '/foods?q=lasagna');
  assert.ok(!r.body.some((f) => f.foodId === lasagna.foodId), 'other users can\'t find it');

  r = await dana('POST', '/entries', { date: day, time: '18:00', mealType: 'DINNER', items: [{ foodId: lasagna.foodId, portion: 2 }] });
  assert.equal(r.status, 201);
  assert.equal(r.body.totalCalories, 820);

  r = await eli('POST', '/entries', { date: day, time: '18:00', mealType: 'DINNER', items: [{ foodId: lasagna.foodId, portion: 1 }] });
  assert.equal(r.status, 400, 'someone else\'s custom food can\'t be logged');
});

test('water is saved per day', async () => {
  const fay = await newUser('fay');
  assert.equal((await fay('GET', `/water?date=${day}`)).body.ounces, 0);
  await fay('PUT', '/water', { date: day, ounces: 16 });
  let r = await fay('PUT', '/water', { date: day, ounces: 24 });
  assert.equal(r.body.ounces, 24);
  assert.equal((await fay('GET', `/water?date=${day}`)).body.ounces, 24);
  assert.equal((await fay('GET', '/water?date=2026-11-04')).body.ounces, 0, 'a new day starts at 0');
  assert.equal((await fay('PUT', '/water', { date: day, ounces: -8 })).status, 400);
  assert.equal((await (await newUser('gus'))('GET', `/water?date=${day}`)).body.ounces, 0, 'water is per user');
  assert.equal((await client()('GET', `/water?date=${day}`)).status, 401);
});

test('weight log keeps one weigh-in per day in date order', async () => {
  const hana = await newUser('hana');
  await hana('PUT', '/weight', { date: '2026-11-03', pounds: 180 });
  await hana('PUT', '/weight', { date: '2026-10-20', pounds: 184.5 });
  let r = await hana('PUT', '/weight', { date: '2026-11-03', pounds: 179 });
  assert.deepEqual(r.body, [
    { date: '2026-10-20', pounds: 184.5 },
    { date: '2026-11-03', pounds: 179 }
  ]);
  assert.equal((await hana('PUT', '/weight', { date: '7/21/2027', pounds: 170 })).status, 400, 'dates have to be real dates');
  assert.equal((await hana('PUT', '/weight', { date: day, pounds: 0 })).status, 400);

  r = await hana('DELETE', '/weight/2026-10-20');
  assert.equal(r.body.length, 1);
  assert.equal((await hana('DELETE', '/weight/2026-10-20')).status, 404);
});

test('diary notes save, list newest first, and blank deletes', async () => {
  const ivy = await newUser('ivy');
  await ivy('PUT', '/diary/2026-11-01', { note: 'Felt good after lunch.' });
  await ivy('PUT', `/diary/${day}`, { note: 'x'.repeat(50) });
  let r = await ivy('GET', '/diary');
  assert.deepEqual(r.body.map((n) => n.date), [day, '2026-11-01']);
  assert.equal(r.body[0].preview, 'x'.repeat(40) + '...');
  assert.equal(r.body[1].preview, 'Felt good after lunch.');

  assert.equal((await ivy('GET', '/diary/2026-11-01')).body.note, 'Felt good after lunch.');
  assert.equal((await ivy('GET', '/diary/2026-01-01')).body.note, '');

  await ivy('PUT', '/diary/2026-11-01', { note: '   ' });
  assert.equal((await ivy('GET', '/diary')).body.length, 1, 'blank note removes the day');
  assert.equal((await (await newUser('jo'))('GET', '/diary')).body.length, 0, 'notes are per user');
});
