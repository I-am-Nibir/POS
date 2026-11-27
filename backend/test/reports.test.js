const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { start } = require('./helper');

describe('রিপোর্ট, Excel export, demo data', () => {
  let s, t;
  before(async () => {
    s = await start(); t = await s.users();
    const p = await s.product({ name: 'Soap', price: 100, cost: 60, stock: 6, low_stock: 5, category: 'Care' });
    await s.sell([[p, 3]]);
    await s.post('/api/expenses', { title: 'Tea', amount: 20 }, t.admin);
  });
  after(() => s?.stop());

  test('দৈনিক রিপোর্ট', async () => {
    const r = await s.get('/api/reports/daily', t.manager);
    assert.deepEqual([r.summary.orders, r.summary.revenue], [1, 300]);
    assert.deepEqual(r.top, [{ name: 'Soap', qty: 3 }]);
    assert.deepEqual(r.lowStock, [{ name: 'Soap', stock: 3 }]);
  });
  test('লাভের ধারাবাহিক হিসাব: আয় - ক্রয়মূল্য - খরচ', async () => {
    for (const group of ['day', 'month']) {
      const rows = await s.get(`/api/reports/series?group=${group}`, t.manager);
      const sum = k => rows.reduce((a, x) => a + x[k], 0);
      assert.deepEqual([sum('revenue'), sum('cogs'), sum('expenses'), sum('profit')], [300, 180, 20, 100]);
    }
  });
  test('বিস্তারিত রিপোর্ট ও তারিখের সীমা', async () => {
    const r = await s.get('/api/reports/detail', t.manager);
    assert.deepEqual(r.byMethod, [{ method: 'cash', n: 1, total: 300 }]);
    assert.equal(r.byCategory[0].category, 'Care');
    assert.equal(r.top[0].revenue, 300);
    assert.equal(r.sales.length, 1);
    assert.equal((await s.get('/api/reports/detail?from=2000-01-01&to=2000-01-02', t.admin)).sales.length, 0);
  });
  test('তিন ধরনের Excel file খোলে ও data থাকে', async () => {
    for (const type of ['sales', 'expenses', 'products']) {
      const r = await s.call('GET', `/api/export/${type}`, { token: t.manager });
      assert.equal(r.status, 200, type);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(r.body);
      assert.equal(wb.getWorksheet(type).rowCount, 2, type);
    }
    await s.expect(404, 'GET', '/api/export/users', { token: t.admin });
  });
  test('demo data যোগ, লুকানো, মোছা: আসল data অক্ষত থাকে', async () => {
    const real = (await s.get('/api/products', t.admin)).length;
    const seeded = await s.post('/api/demo/seed', {}, t.manager);
    assert.equal(seeded.products, 50);
    await s.expect(409, 'POST', '/api/demo/seed', { token: t.admin, body: {} });
    assert.equal((await s.get('/api/products', t.admin)).length, real + 50);
    await s.put('/api/demo/visibility', { hide: true }, t.manager);
    assert.equal((await s.get('/api/products', t.admin)).length, real);
    assert.equal((await s.get('/api/reports/daily', t.admin)).summary.revenue, 300);
    const status = await s.get('/api/demo/status', t.manager);
    assert.deepEqual([status.seeded, status.hidden, status.counts.customers], [true, true, 100]);
    await s.post('/api/demo/clear', {}, t.manager);
    await s.put('/api/demo/visibility', { hide: false }, t.admin);
    assert.equal((await s.get('/api/products', t.admin)).length, real);
    assert.equal((await s.get('/api/sales', t.admin)).length, 1);
  });
});
