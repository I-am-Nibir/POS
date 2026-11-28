const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helper');

describe('বিক্রি, স্টক, কাস্টমার, loyalty, shift', () => {
  let s, t;
  before(async () => { s = await start(); t = await s.users(); });
  after(() => s?.stop());

  test('বিক্রিতে মোট, VAT, ভাংতি ও স্টক ঠিক থাকে', async () => {
    const a = await s.product({ price: 100, vat_rate: 5, stock: 10 }), b = await s.product({ price: 50, stock: 10 });
    const r = await s.sell([[a, 2], [b, 1]], { discount: 25, paid: 300 });
    // subtotal 250, discount 25 (১০%), VAT = 200*5% * 0.9 = 9
    assert.equal(r.total, 234);
    assert.equal(r.change, 66);
    assert.equal(r.due, 0);
    assert.equal(await s.stock(a.id), 8);
    assert.equal(await s.stock(b.id), 9);
    const row = await s.db(async d => await d.prepare('select * from sales where id=?').get(r.id));
    assert.deepEqual([row.subtotal, row.discount, row.vat, row.total], [250, 25, 9, 234]);
  });
  test('একই key দুবার পাঠালে দ্বিতীয় বিক্রি হয় না', async () => {
    const p = await s.product({ stock: 5 }), body = s.saleBody([[p, 1]]);
    const first = await s.post('/api/sales', body, t.cashier), again = await s.post('/api/sales', body, t.cashier);
    assert.equal(again.duplicate, true);
    assert.equal(again.invoice, first.invoice);
    assert.equal(await s.stock(p.id), 4);
  });
  test('স্টকের বেশি, কম টাকা, ভুল input: বিক্রি হয় না, স্টক অপরিবর্তিত', async () => {
    const p = await s.product({ stock: 2 });
    await s.expect(409, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 3]]) });
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { paid: 99 }) });
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { discount: 101 }) });
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[{ id: 99999 }, 1]]) });
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: { items: [] } });
    assert.equal(await s.stock(p.id), 2);
  });
  test('cashier সর্বোচ্চ ১০% discount দিতে পারে', async () => {
    const p = await s.product();
    await s.sell([[p, 1]], { discount: 10 }, t.cashier);
    await s.expect(403, 'POST', '/api/sales', { token: t.cashier, body: s.saleBody([[p, 1]], { discount: 10.5 }) });
    await s.sell([[p, 1]], { discount: 50 }, t.manager);
  });
  test('একসাথে ২০টা বিক্রি এলেও ৫টার বেশি স্টক বিক্রি হয় না', async () => {
    const p = await s.product({ stock: 5 });
    const all = await Promise.all(Array.from({ length: 20 }, () => s.call('POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]]) })));
    assert.equal(all.filter(r => r.status === 200).length, 5);
    assert.equal(all.filter(r => r.status === 409).length, 15);
    assert.equal(await s.stock(p.id), 0);
  });
  test('offline বিক্রি: ৭ দিনের মধ্যে সময় রাখা হয়, পুরোনোটা বাতিল', async () => {
    const p = await s.product({ stock: 1 });
    const at = new Date(Date.now() - 86400000).toISOString();
    const r = await s.sell([[p, 2]], { at }); // offline বিক্রিতে স্টক ঋণাত্মক হতে দেওয়া হয়
    assert.equal(await s.db(async d => (await d.prepare('select created_at from sales where id=?').get(r.id)).created_at), at.slice(0, 19).replace('T', ' '));
    assert.equal(await s.stock(p.id), -1);
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { at: new Date(Date.now() - 8 * 86400000).toISOString() }) });
    assert.equal(await s.stock(p.id), -1);
  });
  test('বাকি বিক্রি ও বাকি পরিশোধ', async () => {
    const p = await s.product({ price: 200 }), c = await s.customer();
    await s.expect(403, 'POST', '/api/sales', { token: t.cashier, body: s.saleBody([[p, 1]], { method: 'due', paid: 0, customerId: c }) });
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { method: 'due', paid: 0 }) });
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { method: 'due', paid: 201, customerId: c }) });
    const r = await s.sell([[p, 1]], { method: 'due', paid: 50, customerId: c });
    assert.equal(r.due, 150);
    assert.equal((await s.customerRow(c)).due, 150);
    await s.expect(400, 'POST', `/api/customers/${c}/pay`, { token: t.manager, body: { amount: 151 } });
    await s.post(`/api/customers/${c}/pay`, { amount: 100 }, t.manager);
    assert.equal((await s.customerRow(c)).due, 50);
    await s.expect(404, 'POST', '/api/customers/9999/pay', { token: t.manager, body: { amount: 1 } });
  });
  test('কাস্টমার তালিকা; একই ফোন দুবার নয়', async () => {
    await s.post('/api/customers', { name: 'Rahim', phone: '01800000000' }, t.cashier);
    await s.expect(409, 'POST', '/api/customers', { token: t.cashier, body: { name: 'Karim', phone: '01800000000' } });
    assert.ok((await s.get('/api/customers', t.cashier)).some(c => c.name === 'Rahim'));
  });
  test('loyalty point অর্জন, খরচ ও ledger', async () => {
    const p = await s.product({ price: 1000 }), c = await s.customer();
    const first = await s.sell([[p, 2]], { customerId: c });
    assert.equal(first.pointsEarned, 20);
    const second = await s.sell([[p, 1]], { customerId: c, redeemPoints: 15 });
    assert.equal(second.total, 985);
    assert.equal(second.pointsEarned, 9);
    assert.equal(second.pointsBalance, 14);
    assert.equal((await s.customerRow(c)).points, 14);
    const ledger = await s.get(`/api/customers/${c}/points-ledger`, t.manager);
    assert.equal(ledger.balance, 14);
    assert.deepEqual(ledger.entries.map(e => e.kind).sort(), ['earn', 'earn', 'redeem']);
    await s.expect(409, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { customerId: c, redeemPoints: 100 }) });
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[p, 1]], { customerId: c, redeemPoints: 5 }) });
    await s.expect(404, 'GET', '/api/customers/9999/points-ledger', { token: t.admin });
  });
  test('loyalty বন্ধ করলে point যোগ হয় না', async () => {
    await s.expect(400, 'PUT', '/api/loyalty-settings', { token: t.admin, body: { earnAmount: 0 } });
    await s.put('/api/loyalty-settings', { enabled: false }, t.admin);
    const p = await s.product({ price: 500 }), c = await s.customer();
    assert.equal((await s.sell([[p, 1]], { customerId: c })).pointsEarned, 0);
    assert.equal((await s.get('/api/loyalty-settings', t.cashier)).enabled, false);
    await s.put('/api/loyalty-settings', { enabled: true }, t.admin);
  });
  test('নগদ refund সবসময় বন্ধ', async () => {
    const r = await s.sell([[await s.product(), 1]]);
    await s.expect(410, 'POST', `/api/sales/${r.id}/refund`, { token: t.admin, body: {} });
  });
  test('বিক্রির তালিকা ও রসিদ আবার তোলা', async () => {
    const p = await s.product({ price: 75 }), r = await s.sell([[p, 2]]);
    assert.ok((await s.get('/api/sales', t.manager)).some(x => x.invoice === r.invoice));
    const byId = await s.get(`/api/sales/${r.id}/receipt`, t.manager);
    const byInvoice = await s.get(`/api/sales/by-invoice/${r.invoice.toLowerCase()}/receipt`, t.manager);
    assert.equal(byId.sale.total, 150);
    assert.equal(byInvoice.lines[0].qty, 2);
    await s.expect(400, 'GET', '/api/sales/abc/receipt', { token: t.admin });
    await s.expect(404, 'GET', '/api/sales/99999/receipt', { token: t.admin });
    await s.expect(404, 'GET', '/api/sales/by-invoice/NOPE/receipt', { token: t.admin });
  });
  test('shift খোলা ও বন্ধ: নগদ হিসাব', async () => {
    await s.post('/api/users', { username: 'cashier2', password: 'Test-pass-123', role: 'cashier' }, t.admin);
    const token = (await s.login('cashier2')).body.token;
    await s.expect(409, 'POST', '/api/shifts/close', { token, body: { closing: 0 } });
    await s.post('/api/shifts/open', { opening: 500 }, token);
    await s.expect(409, 'POST', '/api/shifts/open', { token, body: { opening: 0 } });
    const p = await s.product({ price: 100 });
    await s.sell([[p, 2]], { paid: 200 }, token);
    await s.sell([[p, 1]], { method: 'bkash', paid: 100 }, token);
    assert.deepEqual(await s.post('/api/shifts/close', { closing: 690 }, token), { expected: 700, counted: 690, difference: -10 });
  });
});
