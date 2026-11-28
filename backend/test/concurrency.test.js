// একই মুহূর্তে অনেক request। "আগে দেখো, তারপর লেখো" ধরনের প্রতিটা নিয়ম এখানে পরীক্ষা হয়।
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start, PASSWORD } = require('./helper');

describe('একসাথে অনেক request', () => {
  let s, t;
  before(async () => { s = await start({ DB_TEST_JITTER_MS: '8' }); });
  after(() => s?.stop());
  const many = (n, make) => Promise.all(Array.from({ length: n }, (_, i) => make(i)));
  const statuses = list => list.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
  const post = (url, body, token = t.admin) => s.call('POST', url, { token, body });

  test('একসাথে setup এলেও admin একজনই', async () => {
    const r = await many(5, i => s.call('POST', '/api/setup', { body: { username: `owner${i}`, password: PASSWORD } }));
    assert.deepEqual(statuses(r), { 200: 1, 409: 4 });
    t = { admin: r.find(x => x.status === 200).body.token };
    s.tokens = t;
  });
  test('একই key-এর বিক্রি একসাথে এলে বিক্রি একটাই, কোনো error নেই', async () => {
    const p = await s.product({ stock: 100 });
    for (let round = 0; round < 15; round++) {
      const body = s.saleBody([[p, 1]]);
      const r = await many(6, () => post('/api/sales', body));
      assert.deepEqual(statuses(r), { 200: 6 });
      assert.equal(new Set(r.map(x => x.body.invoice)).size, 1);
    }
    assert.equal(await s.stock(p.id), 85);
  });
  test('shift একটাই খোলে ও একবারই বন্ধ হয়', async () => {
    assert.deepEqual(statuses(await many(8, () => post('/api/shifts/open', { opening: 0 }))), { 200: 1, 409: 7 });
    assert.deepEqual(statuses(await many(8, () => post('/api/shifts/close', { closing: 0 }))), { 200: 1, 409: 7 });
  });
  test('বাকি আদায়, supplier পরিশোধ ও স্টক সমন্বয় সীমা পার করে না', async () => {
    const p = await s.product({ price: 100, stock: 10 }), c = await s.customer();
    await s.sell([[p, 1]], { method: 'due', paid: 0, customerId: c });
    assert.deepEqual(statuses(await many(6, () => post(`/api/customers/${c}/pay`, { amount: 40 }))), { 200: 2, 400: 4 });
    assert.equal((await s.customerRow(c)).due, 20);
    const { id } = await s.post('/api/suppliers', { name: 'S' }, t.admin);
    await s.post('/api/purchases', { supplierId: id, paid: 0, items: [{ id: p.id, qty: 1, cost: 100 }] }, t.admin);
    assert.deepEqual(statuses(await many(6, () => post(`/api/suppliers/${id}/pay`, { amount: 40 }))), { 200: 2, 400: 4 });
    // স্টক ১০ - ১ বিক্রি + ১ ক্রয় = ১০
    assert.deepEqual(statuses(await many(8, () => post(`/api/products/${p.id}/adjust`, { delta: -3, reason: 'damaged' }))), { 200: 3, 400: 5 });
    assert.equal(await s.stock(p.id), 1);
  });
  test('coupon ও gift card সীমার বেশি খরচ হয় না', async () => {
    const p = await s.product({ price: 100, stock: 50 });
    await s.post('/api/coupons', { code: 'THREE', type: 'fixed', value: 10, max_uses: 3 }, t.admin);
    assert.deepEqual(statuses(await many(10, () => post('/api/sales', s.saleBody([[p, 1]], { coupon: 'THREE' })))), { 200: 3, 400: 7 });
    const { code } = await s.post('/api/giftcards', { amount: 200 }, t.admin);
    assert.deepEqual(statuses(await many(8, () => post('/api/sales', s.saleBody([[p, 1]], { gift: code, paid: 0 })))), { 200: 2, 400: 6 });
    assert.equal(await s.stock(p.id), 45);
  });
  test('একই পণ্য একসাথে দুবার exchange হয় না', async () => {
    const p = await s.product({ price: 100 }), sale = await s.sell([[p, 1]]);
    const { lines } = await s.get(`/api/exchange/invoice/${sale.invoice}`, t.admin);
    const body = { invoice: sale.invoice, items: [{ saleItemId: lines[0].sale_item_id, qty: 1, condition: 'unused_original' }], replacements: [{ productId: p.id, qty: 1 }] };
    assert.deepEqual(statuses(await many(8, () => post('/api/exchange', body))), { 200: 1, 409: 7 });
  });
  test('দুই admin একে অন্যকে একসাথে নামাতে চাইলেও অন্তত একজন সক্রিয় থাকে', async () => {
    await s.post('/api/users', { username: 'admin2', password: PASSWORD, role: 'admin' }, t.admin);
    const t2 = (await s.login('admin2')).body.token;
    const users = await s.get('/api/users', t.admin);
    const first = users.find(u => u.username.startsWith('owner')).id, second = users.find(u => u.username === 'admin2').id;
    for (let round = 0; round < 25; round++) {
      await s.db(async d => await d.prepare("update users set active=1 where role='admin'").run());
      await Promise.all([s.call('PUT', `/api/users/${second}`, { token: t.admin, body: { active: false } }), s.call('PUT', `/api/users/${first}`, { token: t2, body: { active: false } })]);
      assert.ok(await s.db(async d => (await d.prepare("select count(*) n from users where role='admin' and active=1").get()).n) >= 1, `round ${round}`);
    }
    await s.db(async d => await d.prepare("update users set active=1 where role='admin'").run());
  });
  test('ব্যর্থ ও সফল request মিশে গেলেও হিসাব মেলে', async () => {
    const admin = t.admin;
    const p = await s.product({ price: 100, stock: 100 });
    const r = await many(60, i => i % 3 === 0 ? post('/api/sales', s.saleBody([[p, 1]], { paid: 1 }), admin)
      : i % 3 === 1 ? post('/api/sales', s.saleBody([[p, 1]]), admin) : post('/api/expenses', { title: 'x', amount: 1 }, admin));
    assert.deepEqual(statuses(r), { 200: 40, 400: 20 });
    assert.equal(await s.stock(p.id), 80);
    assert.equal(await s.db(async d => (await d.prepare('select count(*) n from sale_items where product_id=?').get(p.id)).n), 20);
  });
});
