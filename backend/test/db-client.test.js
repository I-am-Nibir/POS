const { describe, test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { createDb, translate } = require('../db/client');
const { tempDatabase } = require('./helper');
const pause = (ms = 30) => new Promise(r => setTimeout(r, ms));

describe('database স্তর', () => {
  let database, db;
  before(async () => {
    database = await tempDatabase();
    db = createDb({ connectionString: database.url, max: 5 });
    await db.prepare('create table t(id integer generated always as identity primary key, x integer unique, money numeric(14,2), at timestamp default \'2026-01-02 03:04:05\')').run();
  });
  beforeEach(() => db.prepare('truncate t').run());
  after(async () => { await db?.close(); await database?.drop(); });
  const insert = x => db.prepare('insert into t(x) values(?)').run(x);
  const rows = async () => (await db.prepare('select x from t order by x').all()).map(r => r.x);

  test('placeholder বদল: উদ্ধৃতির ভেতর অপরিবর্তিত, ভুল সংখ্যা ধরা পড়ে', () => {
    assert.deepEqual(translate("select '?@a', ? , ?", [1, undefined]), { text: "select '?@a', $1 , $2", values: [1, null] });
    assert.deepEqual(translate('select @a,@b,@a', [{ a: 1, b: NaN, extra: 3 }]), { text: 'select $1,$2,$1', values: [1, null] });
    assert.throws(() => translate('select ?', []), /Missing SQL parameter/);
    assert.throws(() => translate('select ?', [1, 2]), /Too many/);
    assert.throws(() => translate('select @a', [{ b: 1 }]), /@a/);
  });
  test('id ফেরত আসে; টাকা number, সময় আগের রূপে', async () => {
    const r = await db.prepare('insert into t(x,money) values(?,?)').run(1, 10.005);
    assert.ok(r.lastInsertRowid > 0);
    assert.equal(r.changes, 1);
    assert.deepEqual(await db.prepare('select money,at,(select count(*) from t) n,(select sum(money) from t) s from t').get(),
      { money: 10.01, at: '2026-01-02 03:04:05', n: 1, s: 10.01 });
  });
  test('সফল transaction commit হয়, ব্যর্থটা rollback হয়', async () => {
    assert.equal(await db.transaction(async () => { await insert(1); return 'ok'; })(), 'ok');
    await assert.rejects(db.transaction(async () => { await insert(2); throw new Error('boom'); })(), /boom/);
    assert.deepEqual(await rows(), [1]);
  });
  test('অসমাপ্ত transaction-এর data বাইরে দেখা যায় না', async () => {
    let open;
    const gate = new Promise(r => { open = r; });
    const failing = db.transaction(async () => { await insert(1); await gate; throw new Error('rollback'); })();
    await pause();
    assert.deepEqual(await rows(), []);
    await insert(2);
    open();
    await assert.rejects(failing);
    assert.deepEqual(await rows(), [2]);
  });
  test('লেখার transaction একটার পর একটা হয়', async () => {
    await insert(0);
    const next = db.transaction(async () => {
      const { m } = await db.prepare('select max(x) m from t').get();
      await pause(2);
      await insert(m + 1);
    });
    await Promise.all(Array.from({ length: 20 }, () => next()));
    assert.equal((await rows()).length, 21);
  });
  test('snapshot একই data দেখে এবং লিখতে দেয় না', async () => {
    await insert(1);
    await db.snapshot(async () => {
      assert.equal((await rows()).length, 1);
      await db.pool.query('insert into t(x) values(2)'); // অন্য connection থেকে
      assert.equal((await rows()).length, 1);
    })();
    await assert.rejects(db.snapshot(async () => insert(3))(), /read-only/);
    assert.deepEqual(await rows(), [1, 2]);
  });
  test('ভেতরের transaction বাইরেরটার সাথে rollback হয়', async () => {
    const inner = db.transaction(async () => { await insert(1); });
    await assert.rejects(db.transaction(async () => { await inner(); throw new Error('x'); })());
    assert.deepEqual(await rows(), []);
  });
  test('query ব্যর্থ হলেও connection ও lock আটকে থাকে না', async () => {
    await insert(1);
    for (let i = 0; i < 8; i++) await assert.rejects(db.transaction(async () => insert(1))(), { code: '23505' });
    await db.transaction(async () => insert(2))();
    assert.deepEqual(await rows(), [1, 2]);
  });
  test('await বাদ পড়া কাজ transaction শেষে query করলে error পায়', async () => {
    let stray;
    await db.transaction(async () => { stray = pause().then(() => insert(9)); })();
    await assert.rejects(stray, /missing await/);
    assert.deepEqual(await rows(), []);
  });
});
