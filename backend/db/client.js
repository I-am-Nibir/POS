// App যে database interface ব্যবহার করে (PostgreSQL):
//   await db.prepare(sql).get/all/run(...)       placeholder: ? অথবা @name
//   await db.transaction(async () => { ... })()  পড়ে-লেখার কাজ
//   await db.snapshot(async () => { ... })()     শুধু পড়া, সব query একই মুহূর্তের data দেখে
//
// লেখার transaction-গুলো advisory lock দিয়ে একটার পর একটা চলে। তাই "আগে দেখো, তারপর লেখো"
// (স্টক, বাকি, credit, coupon, shift) নিরাপদ থাকে। এক দোকানের জন্য এটা যথেষ্ট;
// multi-tenant করার সময় lock-টা দোকানপ্রতি আলাদা করতে হবে।
const { AsyncLocalStorage } = require('node:async_hooks');
const { Pool, types } = require('pg');

types.setTypeParser(1700, Number); // numeric (টাকা)
types.setTypeParser(20, Number);   // bigint (count, sum)
types.setTypeParser(1114, v => v); // timestamp: 'YYYY-MM-DD HH:MM:SS' (UTC), frontend এই রূপই আশা করে
types.setTypeParser(1082, v => v); // date: 'YYYY-MM-DD'

const WRITE_LOCK = 724001;
const NO_ID_TABLES = new Set(['settings', 'app_settings']);

// ? ও @name কে $1, $2... বানায়; উদ্ধৃতির ভেতরের লেখা বদলায় না
function translate(sql, args) {
  const named = args.length === 1 && args[0] !== null && typeof args[0] === 'object' ? args[0] : null;
  const values = [], index = new Map();
  let position = 0;
  const clean = v => (v === undefined || Number.isNaN(v) ? null : v);
  const text = sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|\?|@([a-z_]\w*)/gi, (token, name) => {
    if (token === '?') {
      if (named || position >= args.length) throw new Error('Missing SQL parameter: ' + sql);
      values.push(clean(args[position++]));
      return `$${values.length}`;
    }
    if (!name) return token;
    if (!named || !(name in named)) throw new Error(`Missing SQL parameter @${name}: ${sql}`);
    if (!index.has(name)) { values.push(clean(named[name])); index.set(name, values.length); }
    return `$${index.get(name)}`;
  });
  if (!named && position !== args.length) throw new Error('Too many SQL parameters: ' + sql);
  return { text, values };
}

function createDb({ connectionString, max = 10 }) {
  const pool = new Pool({ connectionString, max, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  pool.on('error', e => console.error('Idle database connection error:', e.message));
  const context = new AsyncLocalStorage();
  // শুধু test-এর জন্য: প্রতিটা query-র আগে এলোমেলো দেরি, যাতে request-গুলো একে অন্যের মাঝে ঢোকে
  const jitter = Number(process.env.DB_TEST_JITTER_MS || 0);

  async function query(text, values) {
    if (jitter) await new Promise(resolve => setTimeout(resolve, Math.random() * jitter));
    const tx = context.getStore();
    // await ছাড়া রেখে যাওয়া কাজ transaction শেষে চুপচাপ চলতে দেওয়া হয় না
    if (tx?.done) throw new Error('Database used after its transaction finished (missing await?)');
    return (tx?.client || pool).query(text, values);
  }

  const within = (begin, lock) => work => async (...args) => {
    const outer = context.getStore();
    if (outer && !outer.done) return work(...args); // ভেতরের transaction বাইরেরটার অংশ হয়
    const client = await pool.connect();
    const tx = { client, done: false };
    let broken;
    try {
      await client.query(begin);
      if (lock) await client.query('select pg_advisory_xact_lock($1)', [WRITE_LOCK]);
      const result = await context.run(tx, () => work(...args));
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback').catch(failed => { broken = failed; });
      throw e;
    } finally {
      tx.done = true;
      client.release(broken);
    }
  };

  return {
    pool,
    prepare(sql) {
      const exec = async (args, suffix = '') => {
        const { text, values } = translate(sql, args);
        return query(text + suffix, values);
      };
      return {
        get: async (...args) => (await exec(args)).rows[0],
        all: async (...args) => (await exec(args)).rows,
        run: async (...args) => {
          const table = /^\s*insert\s+into\s+(\w+)/i.exec(sql)?.[1];
          const wantsId = table && !NO_ID_TABLES.has(table.toLowerCase()) && !/\breturning\b/i.test(sql);
          const r = await exec(args, wantsId ? ' returning id' : '');
          return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id };
        },
      };
    },
    transaction: within('begin', true),
    snapshot: within('begin isolation level repeatable read read only', false),
    close: () => pool.end(),
  };
}

module.exports = { createDb, translate };
