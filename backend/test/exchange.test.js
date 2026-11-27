const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { start } = require('./helper');

describe('exchange, store credit, voucher', () => {
  let s, t, cheap, mid, dear, customer;
  before(async () => { s = await start(); t = await s.users(); });
  beforeEach(async () => {
    await s.put('/api/exchange/settings', { enabled: true, days: 5, allowPartial: true, allowFull: true, excludedCategories: [], lowerPriceMode: 'store_credit' }, t.admin);
    cheap = await s.product({ price: 100 }); mid = await s.product({ price: 300 }); dear = await s.product({ price: 500 });
    customer = await s.customer();
  });
  after(() => s?.stop());

  test('বেশি দামের পণ্যে বদল: বাড়তি টাকা ছাড়া হয় না, স্টক বদলায়', async () => {
    const sale = await s.sell([[cheap, 1]]);
    assert.equal((await s.exchange(sale, cheap, mid, { extraPaid: 199 })).status, 400);
    assert.equal(s.stock(mid.id), 20);
    const r = await s.exchange(sale, cheap, mid, { extraPaid: 200 });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(s.stock(cheap.id), 20);
    assert.equal(s.stock(mid.id), 19);
    assert.ok((await s.get('/api/exchange/history', t.manager)).some(e => e.code === r.body.code));
  });
  test('একই পণ্য দুবার exchange হয় না', async () => {
    const sale = await s.sell([[mid, 1]]);
    assert.equal((await s.exchange(sale, mid, mid)).status, 200);
    assert.equal((await s.exchange(sale, mid, mid)).status, 409);
  });
  test('কম দামে বদল: store credit তৈরি, যাচাই ও খরচ', async () => {
    const sale = await s.sell([[dear, 1]], { customerId: customer });
    const r = await s.exchange(sale, dear, cheap);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.creditValue, 400);
    assert.match(r.body.voucherCode, /^SC-/);
    const code = r.body.voucherCode;
    assert.equal((await s.get(`/api/credit/check/${code}?customerId=${customer}`, t.cashier)).balance, 400);
    await s.expect(404, 'GET', `/api/credit/check/${code}?customerId=${customer + 999}`, { token: t.cashier });
    const used = await s.sell([[mid, 1]], { customerId: customer, storeCreditCode: code, paid: 0 });
    assert.equal(used.creditUsed, 300);
    assert.equal((await s.get(`/api/credit/check/${code}?customerId=${customer}`, t.cashier)).balance, 100);
    const ledger = await s.get(`/api/customers/${customer}/credit-ledger`, t.manager);
    assert.equal(ledger.balance, 100);
    await s.expect(404, 'GET', '/api/customers/9999/credit-ledger', { token: t.admin });
  });
  test('একসাথে অনেক বিক্রিতেও store credit একবারই খরচ হয়', async () => {
    const sale = await s.sell([[dear, 1]], { customerId: customer });
    const code = (await s.exchange(sale, dear, cheap)).body.voucherCode;
    const all = await Promise.all(Array.from({ length: 10 }, () => s.call('POST', '/api/sales', { token: t.admin, body: s.saleBody([[dear, 1]], { customerId: customer, storeCreditCode: code, paid: 100 }) })));
    assert.equal(all.filter(r => r.status === 200).length, 1);
    assert.equal(s.db(d => d.prepare('select balance from store_credits where code=?').get(code).balance), 0);
  });
  test('store credit অন্য ছাড়ের সাথে মেশে না; মেয়াদ শেষে চলে না', async () => {
    const sale = await s.sell([[dear, 1]], { customerId: customer });
    const code = (await s.exchange(sale, dear, cheap)).body.voucherCode;
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[mid, 1]], { customerId: customer, storeCreditCode: code, discount: 1 }) });
    s.db(d => d.prepare("update store_credits set expires_at=datetime('now','-1 day') where code=?").run(code));
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[mid, 1]], { customerId: customer, storeCreditCode: code }) });
  });
  test('customer ছাড়া বিক্রিতে store credit দেওয়া যায় না, কিছুই বদলায় না', async () => {
    const sale = await s.sell([[dear, 1]]);
    assert.equal((await s.exchange(sale, dear, cheap)).status, 400);
    assert.equal(s.stock(dear.id), 19);
    assert.equal(s.stock(cheap.id), 20);
  });
  test('voucher একবারই ব্যবহার হয়', async () => {
    await s.put('/api/exchange/settings', { lowerPriceMode: 'voucher' }, t.admin);
    const sale = await s.sell([[dear, 1]]);
    const code = (await s.exchange(sale, dear, cheap)).body.voucherCode;
    assert.match(code, /^EX-/);
    assert.equal((await s.get(`/api/voucher/check/${code}`, t.cashier)).balance, 400);
    await s.sell([[mid, 1]], { customerId: customer, voucherCode: code, paid: 0 });
    await s.expect(404, 'GET', `/api/voucher/check/${code}`, { token: t.cashier });
    await s.expect(400, 'POST', '/api/sales', { token: t.admin, body: s.saleBody([[cheap, 1]], { customerId: customer, voucherCode: code }) });
  });
  test('no_credit নিয়মে বাকি টাকা ফেরত বা credit হয় না', async () => {
    await s.put('/api/exchange/settings', { lowerPriceMode: 'no_credit' }, t.admin);
    const r = await s.exchange(await s.sell([[dear, 1]]), dear, cheap);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.voucherCode, null);
  });
  test('নিয়ম: বন্ধ, মেয়াদ, category, আংশিক, ব্যবহৃত পণ্য', async () => {
    const sale = await s.sell([[mid, 2]]);
    await s.put('/api/exchange/settings', { enabled: false }, t.admin);
    assert.equal((await s.exchange(sale, mid, mid)).status, 403);
    await s.put('/api/exchange/settings', { enabled: true, allowPartial: false }, t.admin);
    assert.equal((await s.exchange(sale, mid, mid)).status, 403);
    await s.put('/api/exchange/settings', { allowPartial: true, excludedCategories: [''] }, t.admin);
    assert.equal((await s.exchange(sale, mid, mid)).status, 400);
    await s.put('/api/exchange/settings', { excludedCategories: [] }, t.admin);
    const info = await s.get(`/api/exchange/invoice/${sale.invoice}`, t.manager);
    await s.expect(400, 'POST', '/api/exchange', { token: t.admin, body: { invoice: sale.invoice, items: [{ saleItemId: info.lines[0].sale_item_id, qty: 1, condition: 'used' }], replacements: [{ productId: mid.id, qty: 1 }] } });
    s.db(d => d.prepare("update sales set created_at=datetime('now','-7 days') where id=?").run(sale.id));
    assert.equal((await s.get(`/api/exchange/invoice/${sale.invoice}`, t.admin)).eligible, false);
    assert.equal((await s.exchange(sale, mid, mid)).status, 409);
    await s.expect(404, 'GET', '/api/exchange/invoice/NOPE', { token: t.admin });
    await s.expect(400, 'PUT', '/api/exchange/settings', { token: t.admin, body: { days: -1 } });
  });
  test('exchange-এর পর loyalty point সমন্বয় হয়', async () => {
    const sale = await s.sell([[dear, 1]], { customerId: customer });
    assert.equal(s.customerRow(customer).points, 5);
    assert.equal((await s.exchange(sale, dear, cheap)).status, 200);
    assert.equal(s.customerRow(customer).points, 1);
  });
  test('credit setting', async () => {
    assert.equal((await s.put('/api/credit/settings', { expiryDays: 30 }, t.admin)).expiryDays, 30);
    assert.equal((await s.get('/api/credit/settings', t.admin)).expiryDays, 30);
    await s.expect(400, 'PUT', '/api/credit/settings', { token: t.admin, body: { expiryDays: 0 } });
  });
});
