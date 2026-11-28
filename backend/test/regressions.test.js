// আগে পাওয়া ৬টা সমস্যা ঠিক করা হয়েছে। এই test-গুলো নিশ্চিত করে সেগুলো আর ফিরে না আসে।
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helper');

describe('ঠিক করা সমস্যা', () => {
  let s, t;
  before(async () => { s = await start(); t = await s.users(); });
  after(() => s?.stop());

  test('cashier বাকি জমা নিলে রসিদ ও রেকর্ড থাকে, শুধু admin/manager দেখে', async () => {
    const p = await s.product({ price: 500 }), c = await s.customer('Karim');
    await s.sell([[p, 1]], { method: 'due', paid: 0, customerId: c });
    const { payment } = await s.post(`/api/customers/${c}/pay`, { amount: 100.5, method: 'bkash' }, t.cashier);
    assert.match(payment.receipt_no, /^DP-/);
    assert.deepEqual([payment.due_before, payment.amount, payment.due_after, payment.method, payment.collected_by_name], [500, 100.5, 399.5, 'bkash', 'cashier']);
    await s.expect(403, 'GET', '/api/due-payments', { token: t.cashier });
    for (const token of [t.admin, t.manager]) assert.equal((await s.get('/api/due-payments', token))[0].receipt_no, payment.receipt_no);
    await s.expect(400, 'POST', `/api/customers/${c}/pay`, { token: t.cashier, body: { amount: 400 } });
    await s.expect(400, 'POST', `/api/customers/${c}/pay`, { token: t.cashier, body: { amount: 1, method: 'free' } });
    await s.post(`/api/customers/${c}/pay`, { amount: 399.5 }, t.cashier);
    assert.equal((await s.customerRow(c)).due, 0);
  });
  test('shift-এর নগদ হিসাবে gift card-এর অংশ ধরা উচিত নয়', async () => {
    // আলাদা cashier, যাতে আগের test-এর নগদ জমা এই shift-এ না মেশে
    await s.post('/api/users', { username: 'giftcashier', password: 'Test-pass-123', role: 'cashier' }, t.admin);
    const token = (await s.login('giftcashier')).body.token;
    const p = await s.product({ price: 500 });
    const { code } = await s.post('/api/giftcards', { amount: 400 }, t.admin);
    await s.post('/api/shifts/open', { opening: 0 }, token);
    await s.sell([[p, 1]], { gift: code, paid: 100 }, token);
    assert.equal((await s.post('/api/shifts/close', { closing: 100 }, token)).expected, 100);
  });
  test('দৈনিক রিপোর্ট বাংলাদেশের তারিখ অনুযায়ী হওয়া উচিত', async () => {
    await s.db(async d => {
      await d.prepare('delete from sale_items').run();
      await d.prepare('delete from sales').run();
    });
    const sale = await s.sell([[await s.product(), 1]]);
    // এমন সময় বাছা, যখন ঢাকার তারিখ আর UTC তারিখ আলাদা, এবং সেটা ঢাকার "আজ"
    // অথবা ঢাকার "গতকাল": যেকোনো ঘণ্টায় test একই ফল দেয়।
    const dhakaNow = new Date(Date.now() + 6 * 3600e3);
    const midnightUtc = Date.parse(dhakaNow.toISOString().slice(0, 10) + 'T00:00:00Z') - 6 * 3600e3;
    const sameDate = dhakaNow.getUTCDate() === new Date().getUTCDate();
    const at = new Date(midnightUtc + (sameDate ? 30 : -30) * 60e3);
    await s.db(async d => await d.prepare('update sales set created_at=? where id=?').run(at.toISOString().slice(0, 19).replace('T', ' '), sale.id));
    assert.equal((await s.get('/api/reports/daily', t.admin)).summary.orders, sameDate ? 1 : 0);
  });
  test('টাকা বাকি থাকা বিক্রি থেকে store credit পাওয়া উচিত নয়', async () => {
    const dear = await s.product({ price: 500 }), cheap = await s.product({ price: 100 }), c = await s.customer();
    const sale = await s.sell([[dear, 1]], { method: 'due', paid: 0, customerId: c });
    const r = await s.exchange(sale, dear, cheap);
    assert.ok(r.status >= 400 || r.body.creditValue === 0, `বাকি ৫০০, তবু credit ${r.body.creditValue}`);
  });
  test('পণ্য বদলের সময় stock না পাঠালে স্টক ০ হওয়া উচিত নয়', async () => {
    const p = await s.product({ stock: 9 });
    await s.call('PUT', `/api/products/${p.id}`, { token: t.admin, body: { name: p.name, sku: p.sku, price: 120 } });
    assert.equal(await s.stock(p.id), 9);
  });
  test('অন্য পণ্যের SKU দিলে 500 নয়, 409 হওয়া উচিত', async () => {
    const a = await s.product(), b = await s.product();
    await s.expect(409, 'PUT', `/api/products/${b.id}`, { token: t.admin, body: { ...b, sku: a.sku } });
  });
  test('বাকির চেয়ে বেশি ফেরত হলে বাকি শোধ হয়ে শুধু অতিরিক্ত অংশ credit হয়', async () => {
    for (const mode of ['store_credit', 'voucher']) {
      await s.put('/api/exchange/settings', { lowerPriceMode: mode }, t.admin);
      const dear = await s.product({ price: 500 }), cheap = await s.product({ price: 100 }), c = await s.customer();
      const sale = await s.sell([[dear, 1]], { method: 'due', paid: 350, customerId: c }); // বাকি ১৫০
      assert.equal((await s.get(`/api/exchange/invoice/${sale.invoice}`, t.admin)).customerDue, 150);
      const { body } = await s.exchange(sale, dear, cheap);
      assert.deepEqual([body.dueAdjusted, body.creditValue, body.creditMode], [150, 250, mode]);
      assert.equal((await s.customerRow(c)).due, 0);
      assert.equal((await s.get(`/api/${mode === 'voucher' ? 'voucher' : 'credit'}/check/${body.voucherCode}?customerId=${c}`, t.admin)).balance, 250);
      const record = (await s.get('/api/due-payments', t.admin))[0];
      assert.deepEqual([record.method, record.amount], ['exchange', 150]);
    }
    await s.put('/api/exchange/settings', { lowerPriceMode: 'store_credit' }, t.admin);
  });
  test('shift-এ নগদ বাকি আদায়, আংশিক জমা ও exchange-এর বাড়তি টাকা ধরা হয়; bKash ও ভাংতি নয়', async () => {
    await s.post('/api/users', { username: 'drawer', password: 'Test-pass-123', role: 'manager' }, t.admin);
    const token = (await s.login('drawer')).body.token;
    await s.post('/api/shifts/open', { opening: 1000 }, token);
    const cheap = await s.product({ price: 100 }), dear = await s.product({ price: 300 }), c = await s.customer();
    const sale = await s.sell([[cheap, 1]], { paid: 500 }, token);                      // +100
    await s.sell([[dear, 1]], { method: 'due', paid: 50, customerId: c }, token);       // +50
    await s.sell([[dear, 1]], { method: 'bkash', paid: 300 }, token);
    await s.post(`/api/customers/${c}/pay`, { amount: 70 }, token);                     // +70
    await s.post(`/api/customers/${c}/pay`, { amount: 30, method: 'nagad' }, token);
    const info = await s.get(`/api/exchange/invoice/${sale.invoice}`, token);
    await s.post('/api/exchange', { invoice: sale.invoice, items: [{ saleItemId: info.lines[0].sale_item_id, qty: 1, condition: 'unused_original' }], replacements: [{ productId: dear.id, qty: 1 }], extraPaid: 250 }, token); // +200
    assert.equal((await s.post('/api/shifts/close', { closing: 1420 }, token)).expected, 1420);
  });
  test('product update: বাদ পড়া field অপরিবর্তিত, null দিলে লেখা মোছে', async () => {
    const p = await s.product({ size: 'M', color: 'Red', stock: 9, vat_rate: 5 });
    const row = () => s.db(async d => await d.prepare('select * from products where id=?').get(p.id));
    await s.put(`/api/products/${p.id}`, { price: 130 }, t.admin);
    assert.deepEqual([(await row()).price, (await row()).size, (await row()).stock, (await row()).vat_rate, (await row()).cost], [130, 'M', 9, 5, 60]);
    await s.put(`/api/products/${p.id}`, { size: null }, t.admin);
    assert.deepEqual([(await row()).size, (await row()).color], [null, 'Red']);
    await s.expect(400, 'PUT', `/api/products/${p.id}`, { token: t.admin, body: { price: null } });
    await s.expect(404, 'PUT', '/api/products/99999', { token: t.admin, body: { price: 1 } });
  });
  test('discount ও VAT থাকা বিলের পূর্ণ exchange-এ ঠিক দেওয়া টাকাই ফেরত মূল্য হয়', async () => {
    const p = await s.product({ price: 100, vat_rate: 5 }), c = await s.customer();
    const sale = await s.sell([[p, 2]], { discount: 20, customerId: c });
    assert.equal(sale.total, 189); // (200 - 20) + ৫% VAT
    const half = await s.exchange(sale, p, p, { extraPaid: 100 });
    assert.equal(half.body.returned, 94.5, JSON.stringify(half.body));
    const rest = await s.exchange(sale, p, p, { extraPaid: 100 });
    assert.equal(rest.body.returned, 94.5);
  });
});
