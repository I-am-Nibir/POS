const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helper');

describe('পণ্য, supplier, ক্রয়, খরচ', () => {
  let s, t;
  before(async () => { s = await start(); t = await s.users(); });
  after(() => s?.stop());

  test('পণ্য যোগ, বদল, মোছা', async () => {
    const p = await s.product({ name: 'Rice', sku: 'RICE' });
    await s.expect(409, 'POST', '/api/products', { token: t.admin, body: { name: 'Other', sku: 'RICE', price: 1 } });
    await s.expect(400, 'POST', '/api/products', { token: t.admin, body: { name: 'Bad', sku: 'BAD', price: -1 } });
    await s.put(`/api/products/${p.id}`, { name: 'Rice 5kg', sku: 'RICE', price: 400, cost: 350, stock: 7 }, t.manager);
    const listed = (await s.get('/api/products', t.cashier)).find(x => x.id === p.id);
    assert.deepEqual([listed.name, listed.price, listed.stock], ['Rice 5kg', 400, 7]);
    assert.equal('cost' in listed, false, 'cashier-এর তালিকায় ক্রয়মূল্য থাকা চলবে না');
    assert.equal((await s.get('/api/products/manage', t.manager)).find(x => x.id === p.id).cost, 350);
    await s.expect(200, 'DELETE', `/api/products/${p.id}`, { token: t.manager });
    assert.ok(!(await s.get('/api/products', t.admin)).some(x => x.id === p.id));
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]]) });
  });
  test('size-color matrix; duplicate হলে পুরো batch বাতিল', async () => {
    const body = { name: 'Shirt', baseSku: 'sh', price: 500, sizes: ['M', 'L'], colors: ['Red', 'Blue'], stock: 3 };
    assert.equal((await s.post('/api/products/matrix', body, t.manager)).created, 4);
    await s.expect(409, 'POST', '/api/products/matrix', { token: t.admin, body: { ...body, sizes: ['XL', 'M'] } });
    const skus = (await s.get('/api/products', t.admin)).map(p => p.sku);
    assert.ok(skus.includes('SH-M-RED'));
    assert.ok(!skus.includes('SH-XL-RED'));
  });
  test('স্টক সমন্বয় ঋণাত্মক হতে দেয় না', async () => {
    const p = await s.product({ stock: 5 });
    await s.post(`/api/products/${p.id}/adjust`, { delta: -2, reason: 'damaged' }, t.manager);
    await s.expect(400, 'POST', `/api/products/${p.id}/adjust`, { token: t.admin, body: { delta: -4, reason: 'damaged' } });
    assert.equal(s.stock(p.id), 3);
  });
  test('ক্রয়ে স্টক, ক্রয়মূল্য ও supplier-এর পাওনা বদলায়', async () => {
    const p = await s.product({ stock: 1, cost: 10 });
    const { id } = await s.post('/api/suppliers', { name: 'Dhaka Traders' }, t.manager);
    const r = await s.post('/api/purchases', { supplierId: id, paid: 100, items: [{ id: p.id, qty: 10, cost: 25 }] }, t.manager);
    assert.equal(r.total, 250);
    assert.equal(s.stock(p.id), 11);
    const due = async () => (await s.get('/api/suppliers', t.admin)).find(x => x.id === id).due;
    assert.equal(await due(), 150);
    await s.post(`/api/suppliers/${id}/pay`, { amount: 50 }, t.manager);
    assert.equal(await due(), 100);
    await s.expect(400, 'POST', `/api/suppliers/${id}/pay`, { token: t.admin, body: { amount: 101 } });
  });
  test('ভুল ক্রয় পুরোটা rollback হয়', async () => {
    const p = await s.product({ stock: 4 });
    const { id } = await s.post('/api/suppliers', { name: 'Second' }, t.admin);
    await s.expect(400, 'POST', '/api/purchases', { token: t.admin, body: { supplierId: id, paid: 0, items: [{ id: p.id, qty: 5, cost: 1 }, { id: 99999, qty: 1, cost: 1 }] } });
    await s.expect(400, 'POST', '/api/purchases', { token: t.admin, body: { supplierId: id, paid: 10, items: [{ id: p.id, qty: 1, cost: 1 }] } });
    await s.expect(404, 'POST', '/api/purchases', { token: t.admin, body: { supplierId: 9999, paid: 0, items: [{ id: p.id, qty: 1, cost: 1 }] } });
    assert.equal(s.stock(p.id), 4);
    assert.equal(s.db(d => d.prepare('select count(*) n from purchases where supplier_id=?').get(id).n), 0);
  });
  test('খরচ যোগ, তারিখে ছাঁকা, মোছা', async () => {
    await s.post('/api/expenses', { title: 'Rent', amount: 8000, category: 'Rent', date: '2026-01-15' }, t.manager);
    await s.post('/api/expenses', { title: 'Tea', amount: 50 }, t.manager);
    const jan = await s.get('/api/expenses?from=2026-01-01&to=2026-01-31', t.manager);
    assert.equal(jan.length, 1);
    await s.expect(403, 'DELETE', `/api/expenses/${jan[0].id}`, { token: t.manager });
    await s.expect(200, 'DELETE', `/api/expenses/${jan[0].id}`, { token: t.admin });
    await s.expect(404, 'DELETE', `/api/expenses/${jan[0].id}`, { token: t.admin });
    assert.equal((await s.get('/api/expenses', t.admin)).length, 1);
  });
  test('receipt setting সংরক্ষণ ও যাচাই', async () => {
    const r = await s.put('/api/receipt-settings', { name: 'আমার দোকান', paper: '58', exchangeDays: 9 }, t.admin);
    assert.equal(r.paper, '58');
    assert.equal((await s.get('/api/receipt-settings', t.cashier)).name, 'আমার দোকান');
    assert.equal((await s.get('/api/exchange/settings', t.cashier)).days, 9);
    await s.expect(400, 'PUT', '/api/receipt-settings', { token: t.admin, body: { paper: '100' } });
    await s.expect(400, 'PUT', '/api/receipt-settings', { token: t.admin, body: { exchangeDays: 999 } });
  });
});
