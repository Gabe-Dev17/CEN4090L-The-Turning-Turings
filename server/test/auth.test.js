import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// login tokens: they expire, can't be faked, and stop working if the user is gone
process.env.DB_FILE = ':memory:';
process.env.FDC_API_KEY = '';
process.env.AUTH_SECRET = 'test-secret';
const { default: app } = await import('../index.js');
const { default: db } = await import('../db.js');

let server, base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

const me = (token) => fetch(base + '/me', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.status);

// makes a token the same way auth.js does, signed with any secret
function token(secret, id, exp) {
  const payload = Buffer.from(JSON.stringify({ id, exp })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
}

async function register(email) {
  const res = await fetch(base + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Tess', email, password: 'password123' })
  });
  return res.json();
}

test('a token lasts 7 days', async () => {
  const { token: t, user } = await register('tess@test.com');
  assert.equal(await me(t), 200);
  const { exp } = JSON.parse(Buffer.from(t.split('.')[0], 'base64url').toString());
  const days = (exp - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(days > 6.99 && days <= 7, `lasts ${days} days`);
  assert.equal(await me(token('test-secret', user.userId, Date.now() - 1000)), 401, 'an expired token is refused');
});

test("tokens can't be faked or changed", async () => {
  const { token: t, user } = await register('tom@test.com');
  assert.equal(await me(token('dev-secret-change-me', user.userId, Date.now() + 1e9)), 401, 'the old default secret does nothing');
  assert.equal(await me(token('wrong', user.userId, Date.now() + 1e9)), 401);
  const [payload, sig] = t.split('.');
  const changed = Buffer.from(JSON.stringify({ id: 'someone-else', exp: Date.now() + 1e9 })).toString('base64url');
  assert.equal(await me(`${changed}.${sig}`), 401, 'changing the user id breaks the signature');
  assert.equal(await me(`${payload}.`), 401);
  assert.equal(await me('nonsense'), 401);
});

test('a token stops working when its user is gone', async () => {
  const { token: t, user } = await register('gone@test.com');
  db.prepare('DELETE FROM user WHERE user_id = ?').run(user.userId);
  assert.equal(await me(t), 401);
});

test('passwords are stored hashed with a salt', async () => {
  await register('hash1@test.com');
  await register('hash2@test.com');
  const rows = db.prepare("SELECT password_hash FROM user WHERE email LIKE 'hash%'").all();
  for (const r of rows) {
    assert.ok(!r.password_hash.includes('password123'));
    assert.match(r.password_hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/, 'scrypt salt:hash');
  }
  assert.notEqual(rows[0].password_hash, rows[1].password_hash, 'same password, different hashes');
});
