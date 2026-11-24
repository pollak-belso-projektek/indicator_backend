import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mapUserPermissions } from '../utils/permissions.js';

const school = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherSchool = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ownUser = 'dc9696c5-2b38-48d6-b941-613a05e79b1b';
const foreignUser = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ownCentralUser = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const developerUser = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const missingUser = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const users = {
  [ownUser]: { id: ownUser, alapadatokId: school, permissions: 2 },
  [foreignUser]: { id: foreignUser, alapadatokId: otherSchool, permissions: 2 },
  [ownCentralUser]: { id: ownCentralUser, alapadatokId: school, permissions: 15 },
  [developerUser]: { id: developerUser, alapadatokId: null, permissions: 31 },
};

const update = mock.fn(async () => ({}));
const updatePassword = mock.fn(async () => ({}));
const inactivateUser = mock.fn(async () => ({}));
mock.module('../services/user.service.js', {
  namedExports: {
    create: async () => ({}), getAll: async () => [], getAllFiltered: async () => [],
    updatePersonalInformation: async () => ({}),
    update, updatePassword, inactivateUser, getById: async id => users[id] ?? null,
  },
});
const { default: usersRouter } = await import('../controllers/user.controller.js');

const actors = Object.fromEntries([1, 2, 4, 9, 10, 15, 31].map(role => [role, {
  id: `actor-${role}`, permissions: role, permissionsDetails: mapUserPermissions(role), alapadatokId: school,
}]));
actors.noSchool = { ...actors[4], alapadatokId: null };

let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = actors[req.headers['x-test-actor']]; next(); });
  app.use('/api/v1/users', usersRouter);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
  update.mock.resetCalls(); updatePassword.mock.resetCalls(); inactivateUser.mock.resetCalls();
});

const headers = actor => ({ 'Content-Type': 'application/json', 'x-test-actor': String(actor) });
const put = (actor, id, body = {}) => fetch(`${base}/api/v1/users/${id}`, {
  method: 'PUT', headers: headers(actor),
  body: JSON.stringify({ name: 'Test', email: 'test@example.invalid', permissions: 2, isActive: true, tableAccess: [], ...body }),
});
const putPassword = (actor, id) => fetch(`${base}/api/v1/users/${id}/password`, {
  method: 'PUT', headers: headers(actor),
  body: JSON.stringify({ newPassword: 'new-password', newPasswordConfirm: 'new-password' }),
});
const inactivate = (actor, id) => fetch(`${base}/api/v1/users/inactivate/${id}`, {
  method: 'DELETE', headers: headers(actor),
});

// --- Update: school scope (regression for UUID parseInt bug) ---
test('school admin can update a user of their own school (UUID ids)', async () => {
  assert.equal((await put(4, ownUser, { alapadatokId: school })).status, 200);
  assert.equal(update.mock.callCount(), 1);
  assert.equal(update.mock.calls[0].arguments[0], ownUser);
});
test('school admin omitting alapadatokId keeps user in own school', async () => {
  assert.equal((await put(4, ownUser, { alapadatokId: undefined })).status, 200);
  assert.equal(update.mock.calls[0].arguments[5], school);
});
for (const value of [null, '']) {
  test(`school admin cannot unassign school with ${JSON.stringify(value)}`, async () => {
    const status = (await put(4, ownUser, { alapadatokId: value })).status;
    if (status === 200) assert.equal(update.mock.calls[0].arguments[5], school);
    else assert.equal(status, 403);
  });
}
test('school admin cannot move a user to another school', async () => {
  assert.equal((await put(4, ownUser, { alapadatokId: otherSchool })).status, 403);
  assert.equal(update.mock.callCount(), 0);
});
test('school admin cannot update a user of another school', async () => {
  assert.equal((await put(4, foreignUser, { alapadatokId: school })).status, 403);
  assert.equal(update.mock.callCount(), 0);
});
test('school admin without assigned school cannot update', async () => {
  assert.equal((await put('noSchool', ownUser)).status, 403);
});
test('school admin cannot update a non-existent user', async () => {
  assert.equal((await put(4, missingUser)).status, 403);
});
test('developer gets 404 for a non-existent user', async () => {
  assert.equal((await put(31, missingUser)).status, 404);
});
for (const actor of [15, 31]) {
  test(`central role ${actor} can update a user of another school`, async () => {
    assert.equal((await put(actor, foreignUser, { alapadatokId: otherSchool })).status, 200);
    assert.equal(update.mock.calls[0].arguments[5], otherSchool);
  });
}

// --- Update: role escalation (same matrix as creation) ---
for (const actor of [1, 2, 4, 9, 10, 15, 31]) {
  for (const role of [1, 2, 4, 9, 10, 15, 31]) {
    const allowed = actor === 31 || (actor === 15 && [1, 2, 4, 9, 10].includes(role)) || (actor === 4 && [1, 2, 4].includes(role));
    test(`role ${actor} setting role ${role} on own-school user: ${allowed ? 'allowed' : 'forbidden'}`, async () => {
      const response = await put(actor, ownUser, { permissions: role });
      assert.equal(response.status, allowed ? 200 : 403);
      assert.equal(update.mock.callCount(), allowed ? 1 : 0);
      if (allowed) assert.equal(update.mock.calls[0].arguments[3], role);
    });
  }
}
for (const value of [null, '', 0, 3, 16, 32, -1, '31', '2', {}, []]) {
  test(`invalid role ${JSON.stringify(value)} is rejected on update`, async () => {
    assert.equal((await put(31, ownUser, { permissions: value })).status, 400);
    assert.equal(update.mock.callCount(), 0);
  });
}
test('omitted role on update falls back to general user', async () => {
  assert.equal((await put(4, ownUser, { permissions: undefined })).status, 200);
  assert.equal(update.mock.calls[0].arguments[3], 1);
});
test('school admin cannot modify a central admin even in own school', async () => {
  assert.equal((await put(4, ownCentralUser, { permissions: 1 })).status, 403);
  assert.equal(update.mock.callCount(), 0);
});
test('central admin cannot modify or demote a developer', async () => {
  assert.equal((await put(15, developerUser, { permissions: 1 })).status, 403);
  assert.equal(update.mock.callCount(), 0);
});

// --- Password ---
test('school admin can change password of own-school user', async () => {
  assert.equal((await putPassword(4, ownUser)).status, 200);
  assert.equal(updatePassword.mock.callCount(), 1);
});
test('school admin cannot change password of another school user', async () => {
  assert.equal((await putPassword(4, foreignUser)).status, 403);
  assert.equal(updatePassword.mock.callCount(), 0);
});
test('school admin cannot change password of own-school central admin', async () => {
  assert.equal((await putPassword(4, ownCentralUser)).status, 403);
});
test('central admin cannot change developer password', async () => {
  assert.equal((await putPassword(15, developerUser)).status, 403);
});
for (const actor of [1, 2, 9, 10]) {
  test(`non-admin role ${actor} cannot change other users' passwords`, async () => {
    assert.equal((await putPassword(actor, ownUser)).status, 403);
    assert.equal(updatePassword.mock.callCount(), 0);
  });
}
test('central admin can change password of another school user', async () => {
  assert.equal((await putPassword(15, foreignUser)).status, 200);
});
test('developer can change any password', async () => {
  assert.equal((await putPassword(31, ownCentralUser)).status, 200);
});
test('unauthenticated password change is rejected', async () => {
  assert.equal((await putPassword('missing', ownUser)).status, 401);
});

// --- Inactivate ---
test('school admin can inactivate own-school user', async () => {
  assert.equal((await inactivate(4, ownUser)).status, 200);
  assert.equal(inactivateUser.mock.callCount(), 1);
});
test('school admin cannot inactivate another school user', async () => {
  assert.equal((await inactivate(4, foreignUser)).status, 403);
  assert.equal(inactivateUser.mock.callCount(), 0);
});
test('school admin cannot inactivate own-school central admin', async () => {
  assert.equal((await inactivate(4, ownCentralUser)).status, 403);
});
test('non-admin cannot inactivate users', async () => {
  assert.equal((await inactivate(2, ownUser)).status, 403);
});
