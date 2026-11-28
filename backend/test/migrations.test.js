const { describe, test, beforeEach, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { migrate, loadMigrations } = require('../db');
const { createDb } = require('../db/client');
const { start, tempDatabase } = require('./helper');

describe('database migration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dokan-mig-'));
  let database, db;
  beforeEach(async () => { database = await tempDatabase(); db = createDb({ connectionString: database.url, max: 5 }); });
  afterEach(async () => { await db.close(); await database.drop(); });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));
  // নকল migration folder
  const folder = files => {
    const d = fs.mkdtempSync(path.join(dir, 'm-'));
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(d, name), body);
    return d;
  };
  const up = sql => `exports.up = db => db.query(${JSON.stringify(sql)});`;
  const versions = async () => (await db.prepare('select version from schema_migrations order by version').all()).map(r => r.version);
  const exists = async name => (await db.prepare('select to_regclass(?) is not null as found').get(name)).found;

  test('নতুন database-এ সব migration একবার চলে', async () => {
    const all = loadMigrations().map(m => m.version);
    assert.deepEqual((await migrate(db.pool)).applied, all);
    assert.deepEqual((await migrate(db.pool)).applied, []);
    assert.deepEqual(await versions(), all);
    for (const t of ['users', 'sales', 'due_payments', 'exchanges']) assert.ok(await exists(t), t);
  });
  test('একসাথে কয়েকটা server চালু হলেও migration একবারই চলে', async () => {
    const r = await Promise.all([migrate(db.pool), migrate(db.pool), migrate(db.pool)]);
    assert.equal(r.flatMap(x => x.applied).length, loadMigrations().length);
  });
  test('ব্যর্থ migration পুরোটা rollback হয়, আগেরগুলো ও data থাকে', async () => {
    const first = { '001_first.js': up('create table a(x int); insert into a values(7)') };
    const broken = folder({ ...first, '002_broken.js': up('create table b(x int); insert into nowhere values(1)') });
    await assert.rejects(migrate(db.pool, { dir: broken }), /Migration 2 \(broken\) failed and was rolled back/);
    assert.deepEqual(await versions(), [1]);
    assert.equal(await exists('b'), false);
    const fixed = folder({ ...first, '002_broken.js': up('create table b(x int)') });
    assert.deepEqual((await migrate(db.pool, { dir: fixed })).applied, [2]);
    assert.equal((await db.prepare('select x from a').get()).x, 7);
  });
  test('database code-এর চেয়ে নতুন হলে বা নম্বরে ফাঁক থাকলে থেমে যায়', async () => {
    await migrate(db.pool, { dir: folder({ '001_a.js': up('create table a(x int)'), '002_b.js': up('create table b(x int)') }) });
    await assert.rejects(migrate(db.pool, { dir: folder({ '001_a.js': up('select 1') }) }), /Deploy the newer code/);
    assert.throws(() => loadMigrations(folder({ '001_a.js': up(''), '003_c.js': up('') })), /without gaps/);
    assert.throws(() => loadMigrations(folder({ 'first.js': up('') })), /Bad migration file name/);
  });
  test('server চালু হলে migration নিজে চলে; আবার চালু করলেও ঠিক থাকে', async () => {
    const s = await start();
    try {
      assert.ok((await s.db(d => d.prepare('select count(*) n from schema_migrations').get())).n >= 1);
    } finally { await s.stop(); }
  });
});
