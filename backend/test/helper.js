// প্রতিটা test server নিজের অস্থায়ী PostgreSQL database বানায় ও শেষে মুছে ফেলে। অন্য database ছোঁয় না।
// TEST_DATABASE_URL: এমন PostgreSQL server-এর ঠিকানা, যেখানে database বানানোর অনুমতি আছে।
const { spawn } = require('node:child_process');
const net = require('node:net'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');

const { createDb } = require('../db/client');
const PASSWORD = 'Test-pass-123';
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

async function tempDatabase() {
  const name = `dokan_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = createDb({ connectionString: ADMIN_URL, max: 1 });
  await admin.prepare(`create database ${name}`).run();
  const url = new URL(ADMIN_URL);
  url.pathname = '/' + name;
  return {
    url: url.href,
    drop: async () => {
      await admin.prepare(`drop database if exists ${name} with (force)`).run();
      await admin.close();
    },
  };
}
const freePort = () => new Promise((ok, no) => {
  const s = net.createServer().on('error', no);
  s.listen(0, () => { const { port } = s.address(); s.close(() => ok(port)); });
});

async function start(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dokan-test-'));
  const database = await tempDatabase(), port = await freePort();
  const direct = createDb({ connectionString: database.url, max: 1 });
  const childEnv = { ...process.env, DATABASE_URL: database.url, DB_POOL_MAX: '5', PORT: String(port), JWT_SECRET: 'test-secret', SETUP_KEY: '', TZ_OFFSET: '', HTTPS: '', ...env };
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: childEnv, cwd: dir });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  const base = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null) await new Promise(r => { child.once('exit', r); child.kill(); });
    await direct.close();
    await database.drop();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  for (let i = 0; ; i++) {
    try { if ((await fetch(base + '/healthz')).ok) break; } catch {}
    if (i > 200 || child.exitCode !== null) { await stop(); throw new Error('Server did not start:\n' + out); }
    await new Promise(r => setTimeout(r, 50));
  }

  let ip = 0, seq = 0;
  async function call(method, url, { token, body, headers = {} } = {}) {
    if (process.env.ROUTE_LOG) fs.appendFileSync(process.env.ROUTE_LOG, `${method} ${url.split('?')[0]}\n`);
    const res = await fetch(base + url, {
      method,
      headers: { ...(body !== undefined && { 'content-type': 'application/json' }), ...(token && { authorization: `Bearer ${token}` }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, body: data, headers: res.headers };
  }
  // প্রত্যাশিত status না এলে সাথে সাথে পরিষ্কার বার্তাসহ fail করে
  async function expect(status, method, url, opts) {
    const r = await call(method, url, opts);
    assert.equal(r.status, status, `${method} ${url} -> ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    return r.body;
  }
  // login rate limit এড়াতে প্রতি login-এ আলাদা client IP
  const login = (username, password = PASSWORD) =>
    call('POST', '/api/login', { body: { username, password }, headers: { 'x-forwarded-for': `10.0.${ip >> 8}.${ip++ & 255}` } });

  const api = {
    call, expect, login, stop, databaseUrl: database.url,
    get: (url, token) => expect(200, 'GET', url, { token }),
    post: (url, body, token) => expect(200, 'POST', url, { body, token }),
    put: (url, body, token) => expect(200, 'PUT', url, { body, token }),
    db: fn => fn(direct), // test থেকে সরাসরি database দেখা বা বদলানো
  };

  // admin, manager, cashier তৈরি করে token ফেরত দেয়
  api.users = async () => {
    const admin = (await api.post('/api/setup', { username: 'admin', password: PASSWORD })).token;
    const t = { admin };
    for (const role of ['manager', 'cashier']) {
      await api.post('/api/users', { username: role, password: PASSWORD, role }, admin);
      t[role] = (await login(role)).body.token;
    }
    api.tokens = t;
    return t;
  };
  api.product = async (fields = {}) => {
    const n = ++seq;
    const p = { name: `Product ${n}`, sku: `SKU-${n}`, price: 100, cost: 60, stock: 20, ...fields };
    const { id } = await api.post('/api/products', p, api.tokens.admin);
    return { ...p, id };
  };
  api.customer = async (name = `Customer ${++seq}`) => (await api.post('/api/customers', { name, phone: `017${String(++seq).padStart(8, '0')}` }, api.tokens.admin)).id;
  api.saleBody = (items, extra = {}) => ({ items: items.map(([p, qty]) => ({ id: p.id, qty })), method: 'cash', paid: 100000, key: `test-key-${++seq}-${process.pid}`, ...extra });
  api.sell = (items, extra, token = api.tokens.admin) => api.post('/api/sales', api.saleBody(items, extra), token);
  api.stock = async id => (await direct.prepare('select stock from products where id=?').get(id)).stock;
  api.customerRow = id => direct.prepare('select * from customers where id=?').get(id);
  api.exchange = async (sale, returned, replacement, extra = {}, qty = 1) => {
    const info = await api.get(`/api/exchange/invoice/${sale.invoice}`, api.tokens.admin);
    const line = info.lines.find(l => l.product_id === returned.id);
    return api.call('POST', '/api/exchange', { token: api.tokens.admin, body: { invoice: sale.invoice, items: [{ saleItemId: line.sale_item_id, qty, condition: 'unused_original' }], replacements: [{ productId: replacement.id, qty: 1 }], ...extra } });
  };
  return api;
}
module.exports = { start, tempDatabase, PASSWORD };
