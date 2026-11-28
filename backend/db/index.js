// Schema migration (PostgreSQL)।
// - backend/db/migrations/NNN_name.js file-গুলো নম্বর অনুযায়ী একবার করে চলে।
// - কোনটা চলেছে তা schema_migrations table-এ থাকে।
// - প্রতিটা migration একটা transaction; ব্যর্থ হলে rollback হয় এবং server চালু হয় না।
// - একসাথে দুটো server চালু হলেও lock থাকায় migration একবারই চলে।
// data আছে এমন database বদলানোর আগে backup (pg_dump বা Render-এর backup) নিজে নিতে হবে।
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, 'migrations');
const MIGRATION_LOCK = 724000;

function loadMigrations(dir = DIR) {
  const list = fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(file => {
    const m = /^(\d{3})_([a-z0-9_]+)\.js$/.exec(file);
    if (!m) throw new Error(`Bad migration file name: ${file} (expected 002_short_name.js)`);
    return { version: Number(m[1]), name: m[2], up: require(path.resolve(dir, file)).up };
  }).sort((a, b) => a.version - b.version);
  list.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Migration numbers must be 001, 002, 003... without gaps or repeats (problem at ${m.name})`);
  });
  return list;
}

async function migrate(pool, { dir } = {}) {
  const migrations = loadMigrations(dir);
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await client.query('create table if not exists schema_migrations(version integer primary key, name text not null, applied_at timestamptz not null default now())');
    const current = (await client.query('select coalesce(max(version),0) v from schema_migrations')).rows[0].v;
    if (current > migrations.length)
      throw new Error(`Database is at version ${current} but this code only knows ${migrations.length}. Deploy the newer code.`);
    const applied = [];
    for (const m of migrations.slice(current)) {
      try {
        await client.query('begin');
        await m.up(client);
        await client.query('insert into schema_migrations(version,name) values($1,$2)', [m.version, m.name]);
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw new Error(`Migration ${m.version} (${m.name}) failed and was rolled back: ${e.message}`, { cause: e });
      }
      applied.push(m.version);
      console.log(`Database migration ${m.version} (${m.name}) applied`);
    }
    return { applied };
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {});
    client.release();
  }
}

module.exports = { migrate, loadMigrations };
