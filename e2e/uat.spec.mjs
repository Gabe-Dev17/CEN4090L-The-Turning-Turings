// browser tests for the whole app (cases A-T), done in addition to the team's test plan.
// each test is one case from the plan and they run in order, like a tester going down the plan:
// later cases use the account and entries made by earlier ones, so a failure stops the rest
import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { BASE as B, DB_FILE, AUTH_SECRET, resetDb, startServer, stopServer, usdaKey } from './server.mjs';

test.describe.configure({ mode: 'serial' });

// dates in local time, same as the app
const pad = (n) => String(n).padStart(2, '0');
const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const TODAY = ds(now);
const YDAY = ds(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12));
const TMRW = ds(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12));

let ctx;
let page;
const errors = [];
let dialogAnswer = true;
let lastDialog = '';

function check(cond, msg) {
  expect(cond, msg).toBeTruthy();
}

// counts rows straight from the test database
function count(sql, ...params) {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const n = db.prepare(sql).get(...params).n;
  db.close();
  return n;
}

test.beforeAll(async ({ browser }) => {
  resetDb();
  await startServer();
  ctx = await browser.newContext({ baseURL: B, viewport: { width: 1280, height: 900 } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => {
    lastDialog = d.message();
    dialogAnswer ? d.accept() : d.dismiss();
  });
});

test.afterAll(async () => {
  await ctx?.close();
  await stopServer();
});

// ---- helpers ----
const settle = async () => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
};
const nav = async (name) => {
  await page.locator('nav').getByRole('link', { name, exact: true }).click();
  await settle();
};
const txt = async (sel) => (await page.locator(sel).textContent())?.trim();
const see = (s, timeout = 5000) => page.getByText(s, { exact: false }).first().waitFor({ timeout });
const card = (label) => page.locator('section').filter({ has: page.locator('header', { hasText: new RegExp(`^${label}$`) }) });
const bigTotal = async () => Number((await page.locator('section p.text-4xl').textContent()).replace(/,/g, ''));
const water = async () => (await page.locator('p.text-blue-600').textContent()).trim();
const saveBtn = () => page.getByRole('button', { name: /^Save$|Saving/ });

async function register(name, email, pw = 'Testpass1') {
  await page.goto(B + '/login/index.html');
  await page.click('#tab-register');
  await page.fill('#reg-name', name);
  await page.fill('#reg-email', email);
  await page.fill('#reg-password', pw);
  await page.fill('#reg-confirm', pw);
  await page.click('#register-form .primary');
}

async function login(email = 'uat1@test.com', pw = 'Testpass1') {
  await page.goto(B + '/login/index.html');
  if (!page.url().includes('/login/')) return;
  await page.fill('#login-email', email);
  await page.fill('#login-password', pw);
  await page.click('#login-form .primary');
  await page.waitForURL(B + '/');
  await see('Welcome');
}

async function logout() {
  await page.getByLabel('Log out').click();
  await page.waitForURL('**/login/index.html');
}

async function search(q) {
  await page.getByLabel('Search for a food').fill(q);
  await page.waitForTimeout(700); // the search waits for typing to stop
}

async function addFood(name) {
  await page.getByLabel(`Add ${name}`, { exact: true }).first().click();
  await page.getByLabel(`Portion of ${name}`).waitFor();
}

// ---------------- A. Register ----------------
async function regCase(fields, errId, expected) {
  await page.goto(B + '/login/index.html');
  await page.click('#tab-register');
  for (const [k, v] of Object.entries(fields)) await page.fill(k, v);
  await page.click('#register-form .primary');
  await expect(page.locator(errId)).toContainText(expected);
}
const good = { '#reg-name': 'David Gaitros', '#reg-email': 'new@test.com', '#reg-password': 'Testpass1', '#reg-confirm': 'Testpass1' };

test('A1 register: accepted input', async () => {
  await page.goto(B);
  await page.waitForURL('**/login/index.html');
  await register('David Gaitros', 'uat1@test.com');
  await page.locator('#login-form:not([hidden])').waitFor();
  await expect(page.locator('#login-message')).toHaveText('Account created. Log in to continue.');
  await expect(page.locator('#login-email')).toHaveValue('uat1@test.com');
  const token = await page.evaluate(() => localStorage.getItem('token'));
  check(token === null, 'logged in after registering, but the page says to log in');
});

test('A2 register: rejected blank name', async () => {
  await regCase({ ...good, '#reg-name': '' }, '#reg-name-error', 'Enter your name.');
  check(count('SELECT count(*) n FROM user WHERE email = ?', 'new@test.com') === 0, 'an account was made');
});

test('A3 register: rejected invalid email', async () => {
  await regCase({ ...good, '#reg-email': 'uat1test.com' }, '#reg-email-error', 'Enter an email like name@example.com.');
});

test('A4 register: rejected weak password', async () => {
  for (const pw of ['password', 'abc123']) {
    await regCase({ ...good, '#reg-password': pw, '#reg-confirm': pw }, '#reg-password-error', 'Use 8+ characters with a letter and a number.');
  }
});

test("A5 register: rejected passwords don't match", async () => {
  await regCase({ ...good, '#reg-confirm': 'Testpass2' }, '#reg-confirm-error', 'match');
});

test('A6 register: rejected email already used', async () => {
  await regCase({ ...good, '#reg-email': 'UAT1@test.com' }, '#reg-email-error', 'already exists');
  check(count("SELECT count(*) n FROM user WHERE lower(email) = 'uat1@test.com'") === 1, 'more than one account for uat1');
});

test('A7 register: show/hide password', async () => {
  await page.goto(B + '/login/index.html');
  await page.click('#tab-register');
  await page.fill('#reg-password', 'Testpass1');
  const btn = page.locator('.show-btn[data-target="reg-password"]');
  await btn.click();
  await expect(page.locator('#reg-password')).toHaveAttribute('type', 'text');
  await expect(btn).toHaveText('Hide');
  await btn.click();
  await expect(page.locator('#reg-password')).toHaveAttribute('type', 'password');
  await expect(btn).toHaveText('Show');
});

// ---------------- B/C. Log in and out ----------------
async function badLogin(email, pw) {
  await page.goto(B + '/login/index.html');
  await page.fill('#login-email', email);
  await page.fill('#login-password', pw);
  await page.click('#login-form .primary');
  await page.waitForFunction(() => document.querySelector('#login-message').textContent.trim());
  check(page.url().includes('/login/'), 'left the login page');
  return txt('#login-message');
}
let wrongPwMessage = '';

test('B1 log in: accepted input', async () => {
  await login();
  await expect(page.getByText('Welcome, David Gaitros')).toBeVisible();
});

test('C1 log out', async () => {
  await logout();
});

test('B2 log in: rejected wrong password', async () => {
  wrongPwMessage = await badLogin('uat1@test.com', 'Wrongpass1');
  expect(wrongPwMessage).toBe('Email or password is incorrect.');
});

test('B3 log in: rejected unknown email (same message as B2)', async () => {
  expect(await badLogin('nobody@test.com', 'Testpass1')).toBe(wrongPwMessage);
});

test('B4 log in: rejected blank fields', async () => {
  await page.goto(B + '/login/index.html');
  await page.click('#login-form .primary');
  await expect(page.locator('#login-email-error')).toHaveText('Enter your email.');
  await expect(page.locator('#login-password-error')).toHaveText('Enter your password.');
});

test('B5 log in: email capitals and spaces', async () => {
  await login(' UAT1@Test.com ', 'Testpass1');
});

test('B6 log in: already logged in goes to Home', async () => {
  await page.goto(B + '/login/index.html');
  await page.waitForURL(B + '/');
});

test('C2 log out: pages locked after log out', async () => {
  await logout();
  for (const p of ['/diary', '/progress']) {
    await page.goto(B + p);
    await page.waitForURL('**/login/index.html');
  }
});

test('C3 log out: back button', async () => {
  await login();
  await logout();
  await page.goBack();
  await page.waitForURL('**/login/index.html');
  await settle();
  await expect(page.getByText('Welcome, David Gaitros')).toHaveCount(0);
  // Chrome can also show a saved copy of the page on Back (back/forward cache). Fake that:
  // log in, remove the token like logging out does, then fire the event Chrome sends for a saved copy
  await login();
  await page.evaluate(() => {
    localStorage.removeItem('token');
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForURL('**/login/index.html');
  // a saved copy of the login page must not still have the email and password in it
  await page.fill('#login-email', 'uat1@test.com');
  await page.fill('#login-password', 'Testpass1');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('#login-email')).toHaveValue('');
  await expect(page.locator('#login-password')).toHaveValue('');
  // and a page left open after logging out goes to the log in page on its first request
  await login();
  await page.evaluate(() => localStorage.removeItem('token'));
  await nav('History');
  await page.waitForURL('**/login/index.html');
});

// ---------------- K1/L1 before any goal ----------------
test('K1 goal: none yet', async () => {
  await login();
  await see('Set a daily goal');
});

test('L1 reminder: needs a goal', async () => {
  await nav('Progress');
  await see('Set a daily goal first');
  await expect(page.getByLabel('Remind me at')).toBeDisabled();
});

// ---------------- D/F. Add an entry ----------------
test('D1 add entry: Lookup opens with the meal and date', async () => {
  await nav('Home');
  await page.getByLabel('Add food to Dinner').click();
  await page.waitForURL(/meal=DINNER/);
  await expect(page.locator('button[aria-pressed="true"]')).toHaveText('Dinner');
  await expect(page.getByLabel('Date')).toHaveValue(TODAY);
  await search('chicken');
  await addFood('Chicken breast, grilled');
  await page.getByLabel('Portion of Chicken breast, grilled').fill('2');
});

test('D2 add entry: correct calorie math', async () => {
  const p = page.getByLabel('Portion of Chicken breast, grilled');
  await search('rice');
  await addFood('White rice, cooked');
  await p.fill('3');
  await see('495 cal');
  await see('700 cal');
  await p.fill('2');
  await see('330 cal');
  await see('535 cal');
});

test('F1 + D1 mood, location, activity saved; Dinner card correct', async () => {
  await page.getByLabel('Mood').fill('relaxed');
  await page.getByLabel('Location').fill('home');
  await page.getByLabel('Activity').fill('watching TV');
  await saveBtn().click();
  await page.waitForURL(B + '/');
  await settle();
  const dinner = card('Dinner');
  for (const s of ['Chicken breast, grilled', 'x2', '330 cal', 'White rice, cooked', '205 cal', 'Total: 535 cal', 'Mood: relaxed', 'At: home', 'Doing: watching TV']) {
    await expect(dinner).toContainText(s);
  }
});

test('D3 add entry: same food twice is one line', async () => {
  await nav('Lookup');
  await search('chicken');
  await addFood('Chicken breast, grilled');
  await search('chicken');
  await page.getByLabel('Add Chicken breast, grilled', { exact: true }).click();
  await expect(page.getByLabel('Portion of Chicken breast, grilled')).toHaveCount(1);
  await expect(page.getByLabel('Portion of Chicken breast, grilled')).toHaveValue('2');
});

test('D4 add entry: rejected no foods', async () => {
  await nav('Home');
  await nav('Lookup');
  await saveBtn().click();
  await see('Add at least one food.');
});

test('D5 add entry: rejected bad portion', async () => {
  await search('banana');
  await addFood('Banana');
  const p = page.getByLabel('Portion of Banana');
  for (const v of ['0', '']) {
    await p.fill(v);
    await saveBtn().click();
    await see('Every portion has to be more than 0.');
  }
});

test('D6 add entry: remove a food', async () => {
  await page.getByLabel('Portion of Banana').fill('1');
  await search('apple');
  await addFood('Apple');
  await see('200 cal');
  await page.getByLabel('Remove Apple').click();
  await expect(page.getByLabel('Portion of Apple')).toHaveCount(0);
  await see('105 cal');
});

test('D8 add entry: cancel saves nothing', async () => {
  await page.getByRole('link', { name: 'Cancel' }).click();
  await page.waitForURL(B + '/');
  await settle();
  await expect(page.locator('main')).not.toContainText('Banana');
});

test('D7 add entry: other meals and dates', async () => {
  await page.getByLabel('Add food to Breakfast').click();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveText('Breakfast');
  await search('banana');
  await addFood('Banana');
  await page.getByLabel('Date').fill(YDAY);
  await saveBtn().click();
  await page.waitForURL(`**/?date=${YDAY}`);
  await settle();
  await expect(card('Breakfast')).toContainText('Banana');
  await page.goto(B + '/');
  await settle();
  await expect(card('Breakfast')).not.toContainText('Banana');
});

// ---------------- E. Look up calories ----------------
test('E1 look up: local search', async () => {
  await nav('Lookup');
  await search('ban');
  await see('105 cal per medium banana');
});

test('E2 look up: too short or no match', async () => {
  await search('b');
  await expect(page.getByLabel('Search results')).toHaveCount(0);
  await search('zzzz');
  await see('No foods found');
  await expect(page.getByRole('link', { name: 'Add your own' })).toBeVisible();
});

test('E5 look up: USDA unavailable shows local results only', async () => {
  // the server runs without a usda key here
  await search('kimchi');
  await see('No foods found');
  expect(errors).toEqual([]);
});

// set by E3 when USDA actually answered, so E4 knows whether it can run
let usdaAnswered = false;

test('E3 look up: USDA search', async () => {
  test.skip(!usdaKey(), 'needs FDC_API_KEY in server/.env (or the environment)');
  await stopServer();
  await startServer({ usda: true }); // logins are saved in the database, so we stay logged in
  // USDA is sometimes slow, and the app gives up after 5 s and shows local foods only (that part is E5).
  // so try a few times; if USDA never answers, skip instead of failing, because that is USDA, not our app
  for (let i = 0; i < 3 && !usdaAnswered; i++) {
    // name the meal, otherwise Lookup picks one from the time of day
    await page.goto(B + '/lookup?meal=LUNCH');
    await search('kimchi');
    usdaAnswered = await see('per 100 g', 8000).then(() => true, () => false);
  }
  if (!usdaAnswered) {
    await stopServer();
    await startServer(); // back to no usda so the rest of the run is the same
    test.skip(true, 'USDA did not answer within 5 seconds, 3 tries in a row (USDA slow or down). Run again later.');
  }
});

test('E4 look up: only the picked USDA food is saved', async () => {
  test.skip(!usdaKey(), 'needs FDC_API_KEY in server/.env (or the environment)');
  test.skip(!usdaAnswered, 'skipped because USDA did not answer in E3');
  const name = (await page.getByLabel('Search results').locator('p.font-semibold').first().textContent()).trim();
  await addFood(name);
  await saveBtn().click();
  await page.waitForURL(B + '/');
  expect(count('SELECT count(*) n FROM food_item WHERE external_id IS NOT NULL')).toBe(1);
  await nav('Lookup');
  await search('kimchi');
  await expect(page.getByLabel('Search results').locator('p.font-semibold').first()).toHaveText(name);
  expect(count('SELECT count(*) n FROM food_item WHERE external_id IS NOT NULL')).toBe(1);
  // back to no usda, so the rest of the run is the same either way
  await stopServer();
  await startServer();
  // take the kimchi entry back out so totals match a run without a key
  await page.goto(B + '/');
  await settle();
  dialogAnswer = true;
  await page.locator('article', { hasText: name }).getByLabel('Delete entry').click();
  await settle();
  await expect(page.locator('article', { hasText: name })).toHaveCount(0);
});

// ---------------- F2/F3 ----------------
test('F2 context: optional fields', async () => {
  await page.goto(B + '/lookup?meal=SNACK');
  await search('apple');
  await addFood('Apple');
  await saveBtn().click();
  await page.waitForURL(B + '/');
  await settle();
  await expect(card('Snacks')).toContainText('Apple');
  await expect(card('Snacks')).not.toContainText('Mood:');
});

test('F3 context: rejected too long', async () => {
  await nav('Lookup');
  await page.getByLabel('Mood').fill('x'.repeat(150));
  expect((await page.getByLabel('Mood').inputValue()).length).toBe(100);
});

// ---------------- G. Edit ----------------
let dinnerEditUrl = '';

test('G1 edit: saved values load', async () => {
  await nav('Home');
  await card('Dinner').getByLabel('Edit entry').click();
  await see('Edit Entry');
  dinnerEditUrl = page.url();
  await expect(page.getByLabel('Portion of Chicken breast, grilled')).toHaveValue('2');
  await expect(page.getByLabel('Portion of White rice, cooked')).toHaveValue('1');
  await expect(page.locator('button[aria-pressed="true"]')).toHaveText('Dinner');
  await expect(page.getByLabel('Mood')).toHaveValue('relaxed');
});

test('G2 edit: accepted change', async () => {
  await nav('Home');
  const before = await bigTotal();
  await page.goto(dinnerEditUrl);
  await see('Edit Entry');
  await page.getByLabel('Portion of Chicken breast, grilled').fill('1');
  await page.getByRole('button', { name: 'Lunch', exact: true }).click();
  await saveBtn().click();
  await page.waitForURL(B + '/');
  await settle();
  await expect(card('Lunch')).toContainText('Total: 370 cal');
  expect(before - (await bigTotal())).toBe(165);
  await page.reload();
  await settle();
  await expect(card('Lunch')).toContainText('Total: 370 cal');
});

test('G3 edit: rejected empty entry', async () => {
  await page.goto(dinnerEditUrl);
  await see('Edit Entry');
  await page.getByLabel('Remove Chicken breast, grilled').click();
  await page.getByLabel('Remove White rice, cooked').click();
  await saveBtn().click();
  await see('Add at least one food.');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await settle();
  await expect(card('Lunch')).toContainText('Total: 370 cal');
});

test('G4 edit: cancel', async () => {
  await page.goto(dinnerEditUrl);
  await see('Edit Entry');
  await page.getByLabel('Portion of White rice, cooked').fill('5');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await settle();
  await expect(card('Lunch')).toContainText('Total: 370 cal');
});

// ---------------- H. Delete ----------------
test('H1 delete: confirm', async () => {
  const before = await bigTotal();
  dialogAnswer = true;
  await card('Snacks').getByLabel('Delete entry').click();
  await settle();
  await expect(card('Snacks')).not.toContainText('Apple');
  expect(before - (await bigTotal())).toBe(95);
});

test('H2 delete: cancel', async () => {
  dialogAnswer = false;
  await card('Lunch').getByLabel('Delete entry').click();
  await settle();
  dialogAnswer = true;
  await expect(card('Lunch')).toContainText('370');
});

test('H3 delete: from the edit page', async () => {
  await page.goto(B + '/lookup?meal=DINNER');
  await search('apple');
  await addFood('Apple');
  await saveBtn().click();
  await page.waitForURL(B + '/');
  await settle();
  await card('Dinner').getByLabel('Edit entry').click();
  await see('Edit Entry');
  await page.getByRole('button', { name: 'Delete entry' }).click();
  await page.waitForURL(B + '/');
  await settle();
  await expect(card('Dinner')).toContainText('Nothing added');
});

test('H4 delete: stays deleted', async () => {
  await page.reload();
  await settle();
  await logout();
  await login();
  await settle();
  await expect(card('Dinner')).toContainText('Nothing added');
  await expect(card('Snacks')).not.toContainText('Apple');
});

// ---------------- I. Custom food ----------------
async function addCustom(vals) {
  await page.goto(B + '/add');
  await settle();
  if (vals.name !== undefined) await page.getByLabel('Food Name').fill(vals.name);
  if (vals.cal !== undefined) await page.getByLabel('Calories per Serving').fill(vals.cal);
  if (vals.unit) await page.getByLabel('Serving Size').fill(vals.unit);
  if (vals.meal) await page.getByLabel('Meal').selectOption(vals.meal);
  if (vals.servings !== undefined) await page.getByLabel('Servings Eaten').fill(vals.servings);
  await page.getByRole('button', { name: 'Save' }).click();
}

test('I1 custom food: accepted input', async () => {
  await addCustom({ name: "Mom's empanada", cal: '300', unit: '1 empanada', meal: 'SNACK', servings: '2' });
  await page.waitForURL(B + '/');
  await settle();
  for (const s of ["Mom's empanada", 'x2', '600 cal']) await expect(card('Snacks')).toContainText(s);
});

test('I2 custom food: reused in search', async () => {
  await nav('Lookup');
  await search('empanada');
  await expect(page.getByLabel('Search results').locator('p.font-semibold').first()).toHaveText("Mom's empanada");
  await see('your food');
});

test('I3 custom food: rejected blank name', async () => {
  await addCustom({ cal: '300' });
  await see('Enter a food name.');
});

test('I4 custom food: rejected bad calories', async () => {
  for (const cal of [undefined, '-50']) {
    await addCustom({ name: 'Test', cal });
    await see('Enter the calories per serving (0 or more).');
    check(page.url().endsWith('/add'), 'it was saved');
  }
});

test('I5 custom food: rejected bad servings', async () => {
  await addCustom({ name: 'Test', cal: '100', servings: '0' });
  await see('Servings eaten has to be more than 0.');
  check(page.url().endsWith('/add'), 'it was saved');
});

// ---------------- J. Daily total ----------------
test('J1 daily total: equals the meal cards', async () => {
  await nav('Home');
  let sum = 0;
  for (const m of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
    const found = (await card(m).textContent()).match(/Total: ([\d,]+) cal/);
    if (found) sum += Number(found[1].replace(/,/g, ''));
  }
  expect(await bigTotal()).toBe(sum);
});

test('J2 daily total: other days', async () => {
  await page.getByLabel('Previous day').click();
  await settle();
  await expect(card('Breakfast')).toContainText('Banana');
  expect(await bigTotal()).toBe(105);
  await page.getByRole('button', { name: 'Today' }).click();
  await settle();
  expect(page.url()).toBe(B + '/');
});

test('J3 daily total: empty day', async () => {
  await page.getByLabel('Next day').click();
  await settle();
  expect(await bigTotal()).toBe(0);
  await expect(page.getByText('Nothing added')).toHaveCount(4);
  await page.goto(B + '/');
});

test('J4 daily total: saved after refresh and log in', async () => {
  await settle();
  const a = await bigTotal();
  await page.reload();
  await settle();
  expect(await bigTotal()).toBe(a);
  await logout();
  await login();
  await settle();
  expect(await bigTotal()).toBe(a);
});

// ---------------- K. Goal ----------------
test('K2 goal: accepted input', async () => {
  // typed as soon as the page opens, before the saved goal finishes loading
  await page.goto(B + '/progress');
  await page.getByLabel('Calories per day').fill('2000');
  await settle();
  await expect(page.getByLabel('Calories per day')).toHaveValue('2000');
  await page.getByRole('button', { name: 'Save goal' }).click();
  await see('Goal saved.');
  await nav('Home');
  const total = await bigTotal();
  await see('of 2,000 cal goal');
  await see(`${(2000 - total).toLocaleString('en-US')} cal left`);
});

test('K3 goal: over the goal', async () => {
  await page.goto(B + '/lookup?meal=DINNER');
  await search('chicken');
  await addFood('Chicken breast, grilled');
  await page.getByLabel('Portion of Chicken breast, grilled').fill('10');
  await saveBtn().click();
  await page.waitForURL(B + '/');
  await settle();
  const total = await bigTotal();
  await see(`${(total - 2000).toLocaleString('en-US')} cal over the goal`);
  await expect(page.getByRole('progressbar').locator('div')).toHaveAttribute('style', /100%/);
});

test('K4 goal: rejected out of range', async () => {
  await nav('Progress');
  const box = page.getByLabel('Calories per day');
  for (const [v, msg] of [['400', 'at least 500'], ['10001', '10,000 kcal or less']]) {
    await box.fill(v);
    await page.getByRole('button', { name: 'Save goal' }).click();
    await expect(page.getByRole('alert')).toContainText(msg);
    await expect(page.getByText('Goal saved.')).toHaveCount(0);
  }
  await page.reload();
  await settle();
  await expect(box).toHaveValue('2000');
});

test('K5 goal: update', async () => {
  await page.getByLabel('Calories per day').fill('1800');
  await page.getByRole('button', { name: 'Save goal' }).click();
  await see('Goal saved.');
  await expect(page.locator('.recharts-reference-line')).toHaveCount(1);
  await nav('Home');
  await see('of 1,800 cal goal');
});

// ---------------- M. Chart ----------------
test('M1 chart: last 7 days', async () => {
  await nav('Home');
  const home = await bigTotal();
  await nav('Progress');
  const trend = await page.evaluate(
    async (d) =>
      (await fetch(`/api/entries/trend?endDate=${d}&period=7`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })).json(),
    TODAY
  );
  await expect(page.locator('.recharts-line-dot')).toHaveCount(7);
  expect(Math.round(trend.totals[6])).toBe(home);
  await see('2 of 7 days logged');
});

test('M2 chart: last 30 days', async () => {
  await page.getByLabel('Period').selectOption('30');
  await settle();
  await expect(page.locator('.recharts-line-dot')).toHaveCount(30);
  await see('2 of 30 days logged');
});

// ---------------- L. Reminder (a page with a fake clock) ----------------
let lp;
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
async function setReminderIn(mins) {
  const cur = await lp.evaluate(() => Date.now());
  await lp.getByLabel('Remind me at').fill(hhmm(new Date(cur + mins * 60000)));
  await lp.getByRole('button', { name: 'Save reminder' }).click();
  await lp.getByText('Reminder set for').waitFor();
}

test('L2 reminder: accepted input', async () => {
  lp = await ctx.newPage();
  // noon today, so "2 minutes from now" never rolls past midnight
  await lp.clock.install({ time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0) });
  await lp.goto(B + '/progress');
  await lp.getByText('Your Progress').waitFor();
  await setReminderIn(2);
});

test('L3 reminder: banner appears', async () => {
  await lp.clock.runFor(3 * 60000);
  await expect(lp.getByText('Time to log your meals.')).toBeVisible();
  await lp.getByRole('button', { name: 'Dismiss' }).click();
});

test('L4 reminder: dismiss', async () => {
  await lp.reload();
  await lp.getByText('Your Progress').waitFor();
  await lp.clock.runFor(60000);
  await expect(lp.getByText('Time to log your meals.')).toHaveCount(0);
});

test('L3 reminder: Log food opens Lookup', async () => {
  await setReminderIn(2);
  await lp.clock.runFor(3 * 60000);
  await expect(lp.getByText('Time to log your meals.')).toBeVisible();
  await lp.getByRole('link', { name: 'Log food' }).click();
  await lp.waitForURL('**/lookup');
});

test('L5 reminder: turn off', async () => {
  await lp.goto(B + '/progress');
  await lp.getByText('Your Progress').waitFor();
  await setReminderIn(2);
  await lp.getByRole('button', { name: 'Turn off' }).click();
  await expect(lp.getByText('Reminder turned off.')).toBeVisible();
  await lp.clock.runFor(4 * 60000);
  await expect(lp.getByText('Time to log your meals.')).toHaveCount(0);
  await lp.close();
});

// a fresh page with the fake clock at noon today
async function clockPage(init) {
  const p = await ctx.newPage();
  if (init) await p.addInitScript(init);
  await p.clock.install({ time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0) });
  await p.goto(B + '/progress');
  await p.getByText('Your Progress').waitFor();
  return p;
}

test('L6 reminder: a time that already passed waits until tomorrow', async () => {
  lp = await clockPage();
  await setReminderIn(-5); // 11:55, and it's noon
  await lp.clock.runFor(2 * 60000);
  await expect(lp.getByText('Time to log your meals.')).toHaveCount(0);
  // jump to tomorrow just after 11:55
  await lp.clock.fastForward(24 * 60 * 60000 - 6 * 60000);
  await lp.clock.runFor(2 * 60000);
  await expect(lp.getByText('Time to log your meals.')).toBeVisible();
});

test('L7 reminder: shows only once a day', async () => {
  await lp.getByRole('button', { name: 'Dismiss' }).click();
  await lp.clock.runFor(10 * 60000);
  await expect(lp.getByText('Time to log your meals.')).toHaveCount(0);
  await lp.reload();
  await lp.getByText('Your Progress').waitFor();
  await lp.clock.runFor(2 * 60000);
  await expect(lp.getByText('Time to log your meals.')).toHaveCount(0);
  await lp.getByRole('button', { name: 'Turn off' }).click();
  await expect(lp.getByText('Reminder turned off.')).toBeVisible();
  await lp.close();
});

test('L8 reminder: browser notification', async () => {
  // a stand-in for the browser's Notification, so the test can see what the app sends
  lp = await clockPage(() => {
    // forget reminders already shown today by the earlier L tests (same noon clock, possibly the same time)
    for (const k of Object.keys(localStorage)) if (k.startsWith('reminder-shown-')) localStorage.removeItem(k);
    window.__notes = [];
    function FakeNotification(title, opts) {
      window.__notes.push(opts?.body);
    }
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission = async () => (FakeNotification.permission = 'granted');
    window.Notification = FakeNotification;
  });
  await setReminderIn(2);
  const allow = lp.getByRole('button', { name: 'Also show reminders as browser notifications' });
  await allow.click();
  await expect(allow).toHaveCount(0);
  await lp.clock.runFor(3 * 60000);
  await expect(lp.getByText('Time to log your meals.')).toBeVisible();
  const notes = await lp.evaluate(() => window.__notes);
  expect(notes.length).toBe(1);
  expect(notes[0]).toContain('Time to log your meals.');
  // turn it back off so it can't pop up during the rest of the run
  await lp.getByRole('button', { name: 'Dismiss' }).click();
  await lp.getByRole('button', { name: 'Turn off' }).click();
  await expect.poll(() => count('SELECT COUNT(*) AS n FROM goal WHERE reminder_time IS NOT NULL')).toBe(0);
  await lp.close();
});

// ---------------- N. History ----------------
const histRows = () => page.locator('section[aria-live] li');
async function hist(filter) {
  await nav('History');
  for (const [k, v] of Object.entries(filter)) await page.getByLabel(k, { exact: true }).fill(v);
  await page.getByRole('button', { name: 'Search' }).click();
  await settle();
}

test('N1 history: default list, newest first', async () => {
  await nav('History');
  expect(await histRows().count()).toBeGreaterThanOrEqual(3);
  const todayLabel = new Date(TODAY + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  await expect(histRows().first()).toContainText(todayLabel);
});

test('N2 history: filter by mood', async () => {
  await hist({ Mood: 'RELAX' });
  await expect(histRows()).toHaveCount(1);
  await expect(histRows().first()).toContainText('Mood: relaxed');
});

test('N3 history: food and date range', async () => {
  await hist({ Food: 'rice', From: TODAY, To: TODAY });
  expect(await histRows().count()).toBeGreaterThanOrEqual(1);
  for (const row of await histRows().allTextContents()) expect(row).toContain('rice');
});

test('N4 history: no match, then clear', async () => {
  await hist({ Food: 'pizza' });
  await see('No entries match');
  await page.getByRole('button', { name: 'Clear' }).click();
  await settle();
  expect(await histRows().count()).toBeGreaterThanOrEqual(3);
});

test('N5 history: rejected bad date range', async () => {
  await hist({ From: TODAY, To: YDAY });
  await see('The start date has to be on or before the end date.');
});

test('N6 history: open a result', async () => {
  await nav('Home');
  await nav('History');
  await histRows().first().getByLabel('Edit entry').click();
  await see('Edit Entry');
});

// ---------------- O. Water ----------------
test('O1 water: add', async () => {
  await nav('Home');
  await page.getByLabel('Add 8 oz').click();
  await page.getByLabel('Add 8 oz').click();
  await settle();
  expect(await water()).toBe('16');
});

test('O2 water: saved per day', async () => {
  await page.reload();
  await settle();
  expect(await water()).toBe('16');
  await page.getByLabel('Previous day').click();
  await settle();
  expect(await water()).toBe('0');
  await page.goto(B + '/');
});

test("O3 water: can't go below 0", async () => {
  await settle();
  for (let i = 0; i < 2; i++) {
    await page.getByLabel('Remove 8 oz').click();
    await settle();
  }
  expect(await water()).toBe('0');
  await expect(page.getByLabel('Remove 8 oz')).toBeDisabled();
});

// ---------------- P. Weight ----------------
const wBox = () => page.getByLabel('Weight (lbs)');
const wDate = () => page.locator('input[type="date"]').last();
const wAdd = () => page.getByRole('button', { name: 'Add', exact: true });
const wRows = () => page.locator('ul li').filter({ hasText: 'lbs' });

test('P1 weight: accepted input', async () => {
  await nav('Progress');
  for (const [lbs, d] of [['182.4', '2026-10-20'], ['180', TODAY]]) {
    await wBox().fill(lbs);
    await wDate().fill(d);
    await wAdd().click();
    await settle();
  }
  await expect(wRows()).toHaveCount(2);
  await expect(wRows().nth(0)).toContainText('180');
  await expect(wRows().nth(1)).toContainText('182.4');
  // 7 calorie points + 2 weight points
  expect(await page.locator('.recharts-line-dot').count()).toBeGreaterThanOrEqual(9);
});

test('P2 weight: one weigh-in per day', async () => {
  await wBox().fill('179');
  await wDate().fill(TODAY);
  await wAdd().click();
  await settle();
  await expect(wRows()).toHaveCount(2);
  await expect(wRows().nth(0)).toContainText('179');
});

test('P3 weight: rejected blank or 0', async () => {
  for (const v of ['', '0']) {
    await wBox().fill(v);
    await wAdd().click();
    await see('Enter your weight in pounds.');
  }
  await expect(wRows()).toHaveCount(2);
});

test('P4 weight: rejected future date', async () => {
  await expect(wDate()).toHaveAttribute('max', TODAY);
  await wBox().fill('170');
  await wDate().fill(TMRW);
  await wAdd().click();
  await see("You can't log a weight for a future date.");
  await expect(wRows()).toHaveCount(2);
  await wDate().fill(TODAY);
});

test('P5 weight: delete', async () => {
  await page.getByLabel('Delete weight for 2026-10-20').click();
  await settle();
  await expect(wRows()).toHaveCount(1);
});

// ---------------- Q. Diary ----------------
const note = () => page.getByLabel('Diary entry');

test('Q1 diary: accepted input', async () => {
  await nav('Diary');
  await note().fill('Felt full after dinner but good overall.');
  await page.getByRole('button', { name: 'Save Entry' }).click();
  await see('Saved!');
  await see('Felt full after dinner');
  await page.reload();
  await settle();
  await expect(note()).toHaveValue(/^Felt full/);
});

test('Q2 diary: unsaved changes warning', async () => {
  await note().fill('changed text');
  dialogAnswer = false;
  await page.locator('#diary-date').fill(YDAY);
  await settle();
  dialogAnswer = true;
  expect(lastDialog).toMatch(/unsaved/i);
  await expect(note()).toHaveValue('changed text');
});

test('Q3 diary: another day is empty', async () => {
  await note().fill('Felt full after dinner but good overall.');
  await page.locator('#diary-date').fill(YDAY);
  await settle();
  await expect(note()).toHaveValue('');
});

test('Q4 diary: delete by clearing', async () => {
  await page.locator('#diary-date').fill(TODAY);
  await settle();
  await note().fill('');
  await page.getByRole('button', { name: 'Save Entry' }).click();
  await see('Entry removed.');
  await see('No entries yet');
});

test('Q5 diary: nothing to save', async () => {
  await note().fill('Note two');
  await page.getByRole('button', { name: 'Save Entry' }).click();
  await see('Saved!');
  await page.reload();
  await settle();
  await expect(page.getByRole('button', { name: 'Save Entry' })).toBeDisabled();
});

// ---------------- R. Privacy and security (+ M3) ----------------
let entryId = '';

test('R1 privacy: a second user sees none of the first user\'s data', async () => {
  await nav('Home');
  await card('Lunch').getByLabel('Edit entry').first().click();
  await see('Edit Entry');
  entryId = page.url().split('/entries/')[1].split('/')[0];

  await nav('Home');
  await logout();
  await register('Second User', 'uat2@test.com');
  await page.locator('#login-form:not([hidden])').waitFor();
  await page.fill('#login-password', 'Testpass1');
  await page.click('#login-form .primary');
  await page.waitForURL(B + '/');
  await settle();
  await see('Welcome, Second User');
  expect(await bigTotal()).toBe(0);
  await expect(page.getByText('Nothing added')).toHaveCount(4);
  expect(await water()).toBe('0');
  await nav('Progress');
  await see('Set a daily goal first');
  await see('Log a weight to start your chart.');
  await nav('History');
  await see('No entries yet');
  await nav('Diary');
  await see('No entries yet');
});

test('M3 chart: no data', async () => {
  await nav('Progress');
  await see('Nothing logged in this period yet.');
});

test('R2 privacy: custom foods are private', async () => {
  await nav('Lookup');
  await search('empanada');
  await see('No foods found');
});

test('R3 privacy: no access by link', async () => {
  await page.goto(`${B}/entries/${entryId}/edit`);
  await settle();
  await see("That entry doesn't exist.");
  await expect(saveBtn()).toHaveCount(0);
});

test('R4 security: passwords are hashed', async () => {
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  const rows = db.prepare('SELECT password_hash FROM user').all();
  db.close();
  expect(rows.length).toBe(2);
  for (const r of rows) {
    expect(r.password_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/); // scrypt salt:hash
    expect(r.password_hash).not.toContain('Testpass1');
  }
});

test('R5 data and login survive a restart', async () => {
  await logout();
  await login();
  await settle();
  await stopServer();
  await startServer();
  await page.goto(B);
  await settle();
  expect(page.url()).toBe(B + '/');
  await expect(page.getByText('Welcome, David Gaitros')).toBeVisible();
  await expect(card('Lunch')).toContainText('370');
  await see('of 1,800 cal goal');
});

// ---------------- S. Phone ----------------
test('S1 phone layout', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const p of ['/', '/lookup', '/add', '/progress', '/history', '/diary']) {
    await page.goto(B + p);
    await settle();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(!sideways, `sideways scrolling on ${p}`);
  }
  await page.goto(B + '/');
  await settle();
  await expect(page.locator('nav a span').first()).toBeHidden();
  const lefts = await page.locator('main section').evaluateAll((els) => els.slice(2, 4).map((e) => e.getBoundingClientRect().left));
  expect(lefts[0]).toBe(lefts[1]);
  await logout();
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!sideways, 'sideways scrolling on the login page');
});

test('S2 phone use', async () => {
  await login();
  await settle();
  await page.getByLabel('Add food to Dinner').click();
  await search('banana');
  await addFood('Banana');
  await saveBtn().click();
  await page.waitForURL(B + '/');
  await settle();
  await expect(card('Dinner')).toContainText('Banana');
  await page.getByLabel('Add 8 oz').click();
  await settle();
  expect(await water()).toBe('8');
  await nav('Diary');
  await note().fill('From my phone');
  await page.getByRole('button', { name: 'Save Entry' }).click();
  await see('Saved!');
});

// ---------------- more log in checks ----------------
test('C4 unknown link goes to Home', async () => {
  await page.goto(B + '/no-such-page');
  await page.waitForURL(B + '/');
  await see('Welcome');
});

// the login token is saved in the browser (localStorage) and sent with every request
const savedToken = () => page.evaluate(() => localStorage.getItem('token'));

test('C5 login token lasts 7 days', async () => {
  const token = await savedToken();
  check(token, 'there is a login token');
  const { exp } = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
  const days = (exp - Date.now()) / (24 * 60 * 60 * 1000);
  check(days > 6.9 && days <= 7, `login token lasts ${days.toFixed(2)} days`);
});

test('C6 an expired login goes back to the log in page', async () => {
  await page.goto(B + '/');
  await settle();
  // waiting 7 days isn't an option, so swap in the same token with a time in the past
  const { id } = JSON.parse(Buffer.from((await savedToken()).split('.')[0], 'base64url').toString());
  const payload = Buffer.from(JSON.stringify({ id, exp: Date.now() - 1000 })).toString('base64url');
  const expired = `${payload}.${crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url')}`;
  await page.evaluate((t) => localStorage.setItem('token', t), expired);
  await page.goto(B + '/');
  await page.waitForURL('**/login/index.html');
  // the app may still be reloading onto the login page, so keep checking until it settles
  await expect.poll(() => savedToken().catch(() => 'navigating')).toBeNull();
  await settle();
  // and logging in again works
  await login();
});

// ---------------- dark mode and server errors (added after the Test Plan) ----------------
// how light a css color is, from 0 (black) to 255 (white). Tailwind 4 colors come back as oklch(), the rest as rgb()
function lightness(color) {
  const ok = color.match(/oklch\(([\d.]+)(%?)/);
  if (ok) return Math.round(Number(ok[1]) * (ok[2] ? 2.55 : 255));
  const [r, g, b] = color.match(/[\d.]+/g).map(Number);
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

// the background color behind a point on the page (skips see-through elements)
const backgroundAt = (x, y) => page.evaluate(([x, y]) => {
  let el = document.elementFromPoint(x, y);
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
    el = el.parentElement;
  }
  return null; // page not drawn yet
}, [x, y]);
const lightnessAt = async (x, y) => {
  const bg = await backgroundAt(x, y);
  check(bg, `found a background at ${x},${y}`);
  return lightness(bg);
};

test('T1 dark mode: every page follows the computer setting', async () => {
  await page.setViewportSize({ width: 1280, height: 900 }); // the phone tests leave it phone-sized
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const path of ['/', '/progress', '/add', '/lookup', '/history', '/diary']) {
    await page.goto(B + path);
    await settle();
    check((await lightnessAt(5, 300)) < 60, `${path} has a dark background in dark mode`);
    const title = await page.locator('h1').first().evaluate((el) => getComputedStyle(el).color);
    check(lightness(title) > 180, `${path} title is light text in dark mode`);
  }
  // the text on Home's green calorie card stays light in dark mode too
  await page.goto(B + '/');
  await settle();
  for (const text of [/cal goal/, /left|over the goal/]) {
    const color = await page.getByText(text).first().evaluate((el) => getComputedStyle(el).color);
    check(lightness(color) > 180, `"${text.source}" on the calorie card is light text in dark mode`);
  }
  // the open dropdown list gets dark colors too (Chrome on Windows draws it white otherwise)
  await page.goto(B + '/progress');
  await settle();
  const [optBg, optText] = await page.locator('select[name=period] option').first().evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
  check(lightness(optBg) < 60 && lightness(optText) > 180, 'dropdown options are light text on dark in dark mode');
  await logout();
  await settle();
  check((await lightnessAt(1000, 400)) < 60, 'login page form side is dark in dark mode');
  await page.emulateMedia({ colorScheme: 'light' });
  check((await lightnessAt(1000, 400)) > 200, 'login page goes back to light right away');
  await login();
  check((await lightnessAt(5, 300)) > 200, 'Home is light in light mode');
});

test('T2 log in: server not reachable', async () => {
  await logout();
  // in development Vite answers 500 with no body when the backend isn't running
  await page.route('**/api/auth/login', (r) => r.fulfill({ status: 500, body: '' }));
  await page.fill('#login-email', 'uat1@test.com');
  await page.fill('#login-password', 'Testpass1');
  await page.click('#login-form .primary');
  await see('reach the server');
  check(page.url().includes('/login/'), 'stays on the log in page');
  await page.unroute('**/api/auth/login');
  await login();
});

test('no browser errors during the run', async () => {
  expect(errors).toEqual([]);
});
