const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helper');

describe('coupon ও gift card', () => {
  let s, t, p;
  before(async () => { s = await start(); t = await s.users(); p = await s.product({ price: 500, stock: 100 }); });
  after(() => s?.stop());
  const coupon = code => s.db(d => d.prepare('select * from coupons where code=?').get(code));

  test('coupon তৈরি, যাচাই, বিক্রিতে ব্যবহার ও সীমা', async () => {
    await s.post('/api/coupons', { code: 'ten', type: 'percent', value: 10, min_total: 400, max_uses: 1 }, t.manager);
    await s.expect(409, 'POST', '/api/coupons', { token: t.admin, body: { code: 'TEN', type: 'fixed', value: 1 } });
    await s.expect(400, 'POST', '/api/coupons', { token: t.admin, body: { code: 'BIG', type: 'percent', value: 101 } });
    assert.deepEqual(await s.get('/api/coupons/check?code=ten&base=500', t.cashier), { discount: 50 });
    await s.expect(400, 'GET', '/api/coupons/check?code=ten&base=399', { token: t.cashier });
    assert.equal((await s.sell([[p, 1]], { coupon: 'ten' })).total, 450);
    assert.equal(coupon('TEN').used, 1);
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { coupon: 'ten' }) });
  });
  test('বিক্রি ব্যর্থ হলে coupon খরচ হয় না', async () => {
    await s.post('/api/coupons', { code: 'ONCE', type: 'fixed', value: 20, max_uses: 1 }, t.admin);
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { coupon: 'ONCE', paid: 1 }) });
    assert.equal(coupon('ONCE').used, 0);
  });
  test('মেয়াদ শেষ বা বন্ধ coupon চলে না', async () => {
    await s.post('/api/coupons', { code: 'OLD', type: 'fixed', value: 20, expires: '2020-01-01' }, t.admin);
    await s.expect(400, 'GET', '/api/coupons/check?code=OLD&base=500', { token: t.admin });
    await s.post('/api/coupons', { code: 'OFF', type: 'fixed', value: 20 }, t.admin);
    const id = (await s.get('/api/coupons', t.manager)).find(c => c.code === 'OFF').id;
    await s.put(`/api/coupons/${id}/toggle`, {}, t.manager);
    await s.expect(400, 'GET', '/api/coupons/check?code=OFF&base=500', { token: t.admin });
  });
  test('gift card ইস্যু, আংশিক ব্যবহার ও rollback', async () => {
    const { code } = await s.post('/api/giftcards', { amount: 700 }, t.manager);
    const balance = async () => (await s.get(`/api/giftcards/${code.toLowerCase()}`, t.cashier)).balance;
    assert.ok((await s.get('/api/giftcards', t.manager)).some(g => g.code === code));
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { gift: code, paid: 0, items: [{ id: p.id, qty: 2 }] }) });
    assert.equal(await balance(), 700);
    assert.equal((await s.sell([[p, 1]], { gift: code, paid: 0 })).gift, 500);
    assert.equal(await balance(), 200);
    await s.sell([[p, 1]], { gift: code, paid: 300 });
    assert.equal(await balance(), 0);
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { gift: code }) });
    await s.expect(404, 'GET', '/api/giftcards/NOPE', { token: t.admin });
  });
});
