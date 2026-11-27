import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'access-secret';
process.env.JWT_REFRESH_SECRET = 'refresh-secret';
const ISSUER = 'https://indicator-login-service.pollak.info';
const { generateToken, verifyToken, verifyRefreshToken, generateTrustedDeviceToken, verifyTrustedDeviceToken } = await import('../utils/token.js');

const user = {
  id: 'u1', email: 'a@example.invalid', name: 'A', permissionsDetails: { isAdmin: true }, alapadatok: { id: 's' },
  isTwoFactorEnabled: false,
  tableAccess: [
    { tableName: 'dobbanto', access: 15, table: { isAvailable: true, alias: 'Dobbantó' } },
    { tableName: 'hidden', access: 15, table: { isAvailable: false, alias: 'Rejtett' } },
  ],
};

test('access token carries subject, permissions and only available tables', async () => {
  const { accessToken } = generateToken(user);
  const decoded = await verifyToken(accessToken);
  assert.equal(decoded.sub, 'u1');
  assert.deepEqual(decoded.permissions, { isAdmin: true });
  assert.deepEqual(decoded.tableAccess.map(t => t.tableName), ['dobbanto']);
});
test('refresh token is accepted as refresh token', async () => {
  const { refreshToken } = generateToken(user);
  const decoded = await verifyRefreshToken(refreshToken);
  assert.equal(decoded.id, 'u1');
  assert.equal(decoded.type, 'refresh');
});
test('refresh tokens issued before this change (no type) still work', async () => {
  const legacy = jwt.sign({ email: user.email, id: 'u1' }, 'refresh-secret', { algorithm: 'HS256', issuer: ISSUER, subject: 'u1', expiresIn: '7d' });
  assert.equal((await verifyRefreshToken(legacy)).id, 'u1');
});
test('trusted-device token can NOT be used as a refresh token', async () => {
  assert.equal(await verifyRefreshToken(generateTrustedDeviceToken(user)), null);
});
test('access token can not be used as a refresh token', async () => {
  assert.equal(await verifyRefreshToken(generateToken(user).accessToken), null);
});
test('refresh token can not be used as an access token', async () => {
  await assert.rejects(verifyToken(generateToken(user).refreshToken));
});
test('trusted-device token verifies as trusted-device token', () => {
  assert.equal(verifyTrustedDeviceToken(generateTrustedDeviceToken(user)).id, 'u1');
});
test('refresh token is not a trusted-device token', () => {
  assert.equal(verifyTrustedDeviceToken(generateToken(user).refreshToken), null);
});
test('expired refresh token is rejected', async () => {
  const expired = jwt.sign({ id: 'u1', type: 'refresh' }, 'refresh-secret', { algorithm: 'HS256', issuer: ISSUER, expiresIn: -10 });
  assert.equal(await verifyRefreshToken(expired), null);
});
test('forged refresh token is rejected', async () => {
  const forged = jwt.sign({ id: 'u1', type: 'refresh' }, 'guess', { algorithm: 'HS256', issuer: ISSUER });
  assert.equal(await verifyRefreshToken(forged), null);
});
