import { beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import speakeasy from 'speakeasy';

process.env.JWT_SECRET = 'access-secret';
process.env.JWT_REFRESH_SECRET = 'refresh-secret';

let users;
const updateUser = mock.fn(async (id, data) => Object.assign(users[id], data));
mock.module('../services/user.service.js', {
  namedExports: {
    getByEmail: async email => Object.values(users).find(u => u.email === email) ?? null,
    getById: async id => users[id] ?? null,
    updateUser,
  },
});
// Plain-text "hashes" keep the tests fast; bcrypt itself is not under test here.
mock.module('../utils/hash.js', {
  namedExports: { hashPassword: async p => `hashed:${p}`, comparePassword: async (p, h) => h === `hashed:${p}` },
});
const sendTemporaryPasswordEmail = mock.fn(async () => {});
mock.module('../utils/mailer.js', { namedExports: { sendTemporaryPasswordEmail } });

const auth = await import('../services/auth.service.js');
const { generateToken, generateTrustedDeviceToken } = await import('../utils/token.js');

const secret = speakeasy.generateSecret().base32;
const code = () => speakeasy.totp({ secret, encoding: 'base32' });

beforeEach(() => {
  updateUser.mock.resetCalls();
  sendTemporaryPasswordEmail.mock.resetCalls();
  users = {
    u1: { id: 'u1', email: 'a@example.invalid', name: 'A', password: 'hashed:pw', isActive: true, isTwoFactorEnabled: false, tableAccess: [] },
    u2: { id: 'u2', email: 'tfa@example.invalid', name: 'B', password: 'hashed:pw', isActive: true, isTwoFactorEnabled: true, twoFactorSecret: secret, tableAccess: [] },
    u3: { id: 'u3', email: 'off@example.invalid', name: 'C', password: 'hashed:pw', isActive: false, isTwoFactorEnabled: false, tableAccess: [] },
  };
});

// --- Password login ------------------------------------------------------------
test('correct credentials return tokens', async () => {
  const r = await auth.login('a@example.invalid', 'pw');
  assert.ok(r.accessToken && r.refreshToken);
  assert.equal(r.password, undefined, 'password hash never returned');
});
test('email is case-insensitive', async () => {
  assert.ok((await auth.login('A@Example.Invalid', 'pw')).accessToken);
});
test('unknown email and wrong password give the same message', async () => {
  await assert.rejects(auth.login('nobody@example.invalid', 'pw'), { message: 'Hibás email vagy jelszó' });
  await assert.rejects(auth.login('a@example.invalid', 'wrong'), { message: 'Hibás email vagy jelszó' });
});
test('inactive account with wrong password does not reveal that it is inactive', async () => {
  await assert.rejects(auth.login('off@example.invalid', 'wrong'), { message: 'Hibás email vagy jelszó' });
});
test('inactive account with correct password is refused', async () => {
  await assert.rejects(auth.login('off@example.invalid', 'pw'), { message: 'A fiók inaktív' });
});

// --- Two-factor ---------------------------------------------------------------
test('2FA user without code gets no tokens', async () => {
  const r = await auth.login('tfa@example.invalid', 'pw');
  assert.equal(r.requires2FA, true);
  assert.equal(r.accessToken, undefined);
});
test('2FA user with wrong password is refused before 2FA', async () => {
  await assert.rejects(auth.login('tfa@example.invalid', 'wrong'), { message: 'Hibás email vagy jelszó' });
});
test('2FA user with wrong code is refused', async () => {
  await assert.rejects(auth.login('tfa@example.invalid', 'pw', '000000'), { message: 'Hibás kétlépcsős kód' });
});
test('2FA user with correct code gets tokens', async () => {
  assert.ok((await auth.login('tfa@example.invalid', 'pw', code())).accessToken);
});
test('trusted device skips 2FA (password still required)', async () => {
  const trusted = generateTrustedDeviceToken(users.u2);
  assert.ok((await auth.login('tfa@example.invalid', 'pw', undefined, false, trusted)).accessToken);
  await assert.rejects(auth.login('tfa@example.invalid', 'wrong', undefined, false, trusted));
});
test("another user's trusted-device token does not skip 2FA", async () => {
  const r = await auth.login('tfa@example.invalid', 'pw', undefined, false, generateTrustedDeviceToken(users.u1));
  assert.equal(r.requires2FA, true);
});
test('a refresh token does not work as trusted-device token', async () => {
  const r = await auth.login('tfa@example.invalid', 'pw', undefined, false, generateToken(users.u2).refreshToken);
  assert.equal(r.requires2FA, true);
});
test('trustDevice after a correct code returns a trusted-device token', async () => {
  assert.ok((await auth.login('tfa@example.invalid', 'pw', code(), true)).trustedDeviceToken);
});

// --- Refresh ------------------------------------------------------------------
test('refresh issues new tokens for an active user', async () => {
  const r = await auth.refresh(generateToken(users.u1).refreshToken);
  assert.ok(r.accessToken && r.refreshToken);
});
test('refresh is refused once the account is inactivated', async () => {
  const { refreshToken } = generateToken(users.u1);
  users.u1.isActive = false;
  await assert.rejects(auth.refresh(refreshToken), { message: 'A fiók inaktív' });
});
test('refresh is refused for a deleted user', async () => {
  const { refreshToken } = generateToken(users.u1);
  delete users.u1;
  await assert.rejects(auth.refresh(refreshToken));
});
test('trusted-device token can not be exchanged for a session', async () => {
  await assert.rejects(auth.refresh(generateTrustedDeviceToken(users.u1)));
});

// --- 2FA setup ----------------------------------------------------------------
test('generating a 2FA secret stores it for a user without 2FA', async () => {
  const r = await auth.generate2FA('u1');
  assert.equal(users.u1.twoFactorSecret, r.secret);
});
test('an active 2FA secret can not be silently replaced', async () => {
  await assert.rejects(auth.generate2FA('u2'));
  assert.equal(users.u2.twoFactorSecret, secret);
});
test('verify2FA enables 2FA only with a correct code', async () => {
  users.u1.twoFactorSecret = secret;
  await assert.rejects(auth.verify2FA('u1', '000000'));
  assert.equal(users.u1.isTwoFactorEnabled, false);
  await auth.verify2FA('u1', code());
  assert.equal(users.u1.isTwoFactorEnabled, true);
});

// --- Forgot password ----------------------------------------------------------------
test('forgot password for unknown email changes nothing', async () => {
  await auth.forgotPassword('nobody@example.invalid');
  assert.equal(updateUser.mock.callCount(), 0);
  assert.equal(sendTemporaryPasswordEmail.mock.callCount(), 0);
});
test('forgot password sets a temporary password that must be changed and mails it', async () => {
  await auth.forgotPassword('A@example.invalid');
  assert.equal(updateUser.mock.callCount(), 1);
  assert.equal(users.u1.mustChangePassword, true);
  const [, , temp] = sendTemporaryPasswordEmail.mock.calls[0].arguments;
  assert.equal(users.u1.password, `hashed:${temp}`);
});
test('temporary passwords are 12 chars with every character class and do not repeat', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const p = auth.generateTemporaryPassword();
    assert.equal(p.length, 12);
    assert.match(p, /[a-z]/);
    assert.match(p, /[A-Z]/);
    assert.match(p, /[0-9]/);
    assert.match(p, /[^a-zA-Z0-9]/);
    seen.add(p);
  }
  assert.equal(seen.size, 200);
});
