// এগুলো app-এর জানা সমস্যা। test-গুলো "যা হওয়া উচিত" তা পরীক্ষা করে, তাই এখন fail করে,
// কিন্তু { todo } থাকায় পুরো suite আটকায় না। ঠিক করার পর { todo } সরিয়ে দিন।
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helper');

describe('জানা সমস্যা', () => {
  let s, t;
  before(async () => { s = await start(); t = await s.users(); });
  after(() => s?.stop());

  test('cashier কাস্টমারের বাকি কমাতে পারা উচিত নয়', { todo: 'অনুমতি সবার জন্য খোলা; দোকানের নিয়ম ঠিক করতে হবে' }, async () => {
    const p = await s.product(), c = await s.customer();
    await s.sell([[p, 1]], { method: 'due', paid: 0, customerId: c });
    await s.expect(403, 'POST', `/api/customers/${c}/pay`, { token: t.cashier, body: { amount: 100 } });
  });
  test('shift-এর নগদ হিসাবে gift card-এর অংশ ধরা উচিত নয়', { todo: 'shift close পুরো total-কে নগদ ধরে' }, async () => {
    const p = await s.product({ price: 500 });
    const { code } = await s.post('/api/giftcards', { amount: 400 }, t.admin);
    await s.post('/api/shifts/open', { opening: 0 }, t.cashier);
    await s.sell([[p, 1]], { gift: code, paid: 100 }, t.cashier);
    assert.equal((await s.post('/api/shifts/close', { closing: 100 }, t.cashier)).expected, 100);
  });
  test('দৈনিক রিপোর্ট বাংলাদেশের তারিখ অনুযায়ী হওয়া উচিত', { todo: '/api/reports/daily UTC তারিখ ব্যবহার করে' }, async () => {
    s.db(d => d.exec('delete from sale_items; delete from sales'));
    const sale = await s.sell([[await s.product(), 1]]);
    // এমন সময় বাছা, যখন ঢাকার তারিখ আর UTC তারিখ আলাদা, এবং সেটা ঢাকার "আজ"
    // অথবা ঢাকার "গতকাল": যেকোনো ঘণ্টায় test একই ফল দেয়।
    const dhakaNow = new Date(Date.now() + 6 * 3600e3);
    const midnightUtc = Date.parse(dhakaNow.toISOString().slice(0, 10) + 'T00:00:00Z') - 6 * 3600e3;
    const sameDate = dhakaNow.getUTCDate() === new Date().getUTCDate();
    const at = new Date(midnightUtc + (sameDate ? 30 : -30) * 60e3);
    s.db(d => d.prepare('update sales set created_at=? where id=?').run(at.toISOString().slice(0, 19).replace('T', ' '), sale.id));
    assert.equal((await s.get('/api/reports/daily', t.admin)).summary.orders, sameDate ? 1 : 0);
  });
  test('টাকা বাকি থাকা বিক্রি থেকে store credit পাওয়া উচিত নয়', { todo: 'exchange বাকি টাকা বিবেচনা করে না' }, async () => {
    const dear = await s.product({ price: 500 }), cheap = await s.product({ price: 100 }), c = await s.customer();
    const sale = await s.sell([[dear, 1]], { method: 'due', paid: 0, customerId: c });
    const r = await s.exchange(sale, dear, cheap);
    assert.ok(r.status >= 400 || r.body.creditValue === 0, `বাকি ৫০০, তবু credit ${r.body.creditValue}`);
  });
  test('পণ্য বদলের সময় stock না পাঠালে স্টক ০ হওয়া উচিত নয়', { todo: 'PUT-এ বাদ পড়া field default মান পায়' }, async () => {
    const p = await s.product({ stock: 9 });
    await s.call('PUT', `/api/products/${p.id}`, { token: t.admin, body: { name: p.name, sku: p.sku, price: 120 } });
    assert.equal(s.stock(p.id), 9);
  });
  test('অন্য পণ্যের SKU দিলে 500 নয়, 409 হওয়া উচিত', { todo: 'PUT duplicate SKU ধরে না' }, async () => {
    const a = await s.product(), b = await s.product();
    await s.expect(409, 'PUT', `/api/products/${b.id}`, { token: t.admin, body: { ...b, sku: a.sku } });
  });
});
