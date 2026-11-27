const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, PASSWORD } = require('./helper');

describe('setup, login ও user', () => {
  let s, t;
  before(async () => { s = await start({ SETUP_KEY: 'open-sesame' }); });
  after(() => s?.stop());

  test('healthz ও প্রথম setup-এর অবস্থা', async () => {
    assert.deepEqual(await s.get('/healthz'), { ok: 1 });
    assert.deepEqual(await s.get('/api/setup/status'), { needed: true, keyRequired: true });
  });
  test('ভুল setup key বা ছোট password দিয়ে admin বানানো যায় না', async () => {
    await s.expect(403, 'POST', '/api/setup', { body: { username: 'admin', password: PASSWORD, key: 'wrong' } });
    await s.expect(400, 'POST', '/api/setup', { body: { username: 'admin', password: 'short', key: 'open-sesame' } });
  });
  test('setup শুধু একবার হয়', async () => {
    const body = { username: 'admin', password: PASSWORD, key: 'open-sesame' };
    const r = await s.post('/api/setup', body);
    assert.equal(r.user.role, 'admin');
    await s.expect(409, 'POST', '/api/setup', { body });
    assert.equal((await s.get('/api/setup/status')).needed, false);
    t = { admin: r.token };
  });
  test('admin user বানায়; একই username দুবার নয়', async () => {
    for (const role of ['manager', 'cashier']) await s.post('/api/users', { username: role, password: PASSWORD, role }, t.admin);
    await s.expect(409, 'POST', '/api/users', { token: t.admin, body: { username: 'cashier', password: PASSWORD, role: 'cashier' } });
    await s.expect(400, 'POST', '/api/users', { token: t.admin, body: { username: 'boss', password: PASSWORD, role: 'owner' } });
    assert.equal((await s.get('/api/users', t.admin)).length, 3);
  });
  test('login: ঠিক password চলে, ভুলটা চলে না', async () => {
    t.cashier = (await s.login('cashier')).body.token;
    t.manager = (await s.login('manager')).body.token;
    assert.ok(t.cashier && t.manager);
    assert.equal((await s.login('cashier', 'wrong-password')).status, 401);
    assert.equal((await s.login('nobody')).status, 401);
  });
  test('একই IP থেকে ১০ বারের বেশি login আটকে যায়', async () => {
    const opts = { body: { username: 'admin', password: 'wrong' }, headers: { 'x-forwarded-for': '192.0.2.50' } };
    for (let i = 0; i < 10; i++) await s.expect(401, 'POST', '/api/login', opts);
    await s.expect(429, 'POST', '/api/login', opts);
  });
  test('token ছাড়া বা ভুল token-এ 401', async () => {
    await s.expect(401, 'GET', '/api/products');
    await s.expect(401, 'GET', '/api/products', { token: 'not-a-token' });
  });
  test('role অনুযায়ী অনুমতি', async () => {
    const managerUp = ['/api/sales', '/api/suppliers', '/api/expenses', '/api/reports/daily', '/api/reports/series', '/api/reports/detail', '/api/coupons', '/api/giftcards', '/api/exchange/history', '/api/products/manage', '/api/demo/status', '/api/export/sales'];
    for (const url of managerUp) {
      await s.expect(403, 'GET', url, { token: t.cashier });
      await s.expect(200, 'GET', url, { token: t.manager });
    }
    for (const url of ['/api/users', '/api/audit', '/api/credit/settings']) {
      await s.expect(403, 'GET', url, { token: t.cashier });
      await s.expect(403, 'GET', url, { token: t.manager });
      await s.expect(200, 'GET', url, { token: t.admin });
    }
    for (const url of ['/api/receipt-settings', '/api/loyalty-settings', '/api/exchange/settings']) {
      await s.expect(200, 'GET', url, { token: t.cashier });
      await s.expect(403, 'PUT', url, { token: t.manager, body: {} });
    }
    await s.expect(403, 'POST', '/api/products', { token: t.cashier, body: {} });
    await s.expect(403, 'POST', '/api/exchange', { token: t.cashier, body: {} });
  });
  test('নিষ্ক্রিয় করলে পুরোনো token সাথে সাথে বন্ধ; password বদল কাজ করে', async () => {
    const id = (await s.get('/api/users', t.admin)).find(u => u.username === 'cashier').id;
    await s.put(`/api/users/${id}`, { active: false }, t.admin);
    await s.expect(401, 'GET', '/api/products', { token: t.cashier });
    assert.equal((await s.login('cashier')).status, 401);
    await s.put(`/api/users/${id}`, { active: true, password: 'New-pass-456' }, t.admin);
    assert.equal((await s.login('cashier', 'New-pass-456')).status, 200);
    await s.expect(404, 'PUT', '/api/users/999', { token: t.admin, body: { active: false } });
  });
  test('নিজের admin account নামানো বা মোছা যায় না', async () => {
    const me = (await s.get('/api/users', t.admin)).find(u => u.username === 'admin').id;
    await s.expect(400, 'PUT', `/api/users/${me}`, { token: t.admin, body: { role: 'cashier' } });
    await s.expect(400, 'DELETE', `/api/users/${me}`, { token: t.admin });
  });
  test('user মোছা ও audit log', async () => {
    const id = (await s.get('/api/users', t.admin)).find(u => u.username === 'manager').id;
    await s.expect(200, 'DELETE', `/api/users/${id}`, { token: t.admin });
    await s.expect(401, 'GET', '/api/suppliers', { token: t.manager });
    await s.expect(404, 'DELETE', `/api/users/${id}`, { token: t.admin });
    const actions = (await s.get('/api/audit', t.admin)).map(a => a.action);
    for (const a of ['setup', 'user_create', 'user_update', 'user_delete', 'login', 'login_fail']) assert.ok(actions.includes(a), a);
  });
  test('অজানা API path 404 JSON দেয়', async () => {
    const b = await s.expect(404, 'GET', '/api/nope');
    assert.match(b.error, /not found/i);
  });
});
