# POS (Node.js + PostgreSQL + React)
PostgreSQL lagbe. Docker thakle:
  docker run -d --name dokan-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -v dokan-pg:/var/lib/postgresql/data postgres:16
Backend:  cd backend && npm install && DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres JWT_SECRET=$(openssl rand -hex 32) npm start
First run: open the site -> 'First-time setup' screen -> create your own admin account (no default password exists).
Optional: set SETUP_KEY so only you can complete the first-time setup on a public URL.
Frontend: cd frontend && npm install && npm run dev  -> http://localhost:5173
Production: frontend-e `npm run build` korle backend nijei dist serve korbe.

## Env
JWT_SECRET (required) | SETUP_KEY (optional) | PORT | DATABASE_URL (required) | DB_POOL_MAX (10) | TZ_OFFSET ('+6 hours') | HTTPS=1 (HTTPS-er pichone chalale)
Receipt header: app-er "Receipt Settings" theke set korun.

## Receipt printing (browser)
- Computer-e thermal printer-er driver install korun (USB ba LAN), tarpor "রসিদ প্রিন্ট" chepe browser print dialog theke printer bachun. Bangla lekha print hoy.
- Receipt Settings-e 58mm/80mm ar auto print bachha jay. Auto print-er jonno site-er pop-up allow korun.
- Cash drawer lagle printer driver-er cash drawer option check korun (driver onujayi bhinno).

## Offline mode
- Internet gele bikri local-e jomা hoy (OFF-xxxx), internet ashle auto sync (idempotent, duplicate hoy na).
- Offline-e coupon/gift card, notun customer/product kaj kore na. Offline-e tab/browser bondho korben na (login session harabe).
- Service worker (app offline-e khola) er jonno HTTPS ba localhost lagbe. LAN IP-te http hole SW chalu hobe na.
- Sync fail hole (jemon product delete hoyeche) browser-er localStorage 'failed' list-e thake.


## POS updates
- Cashier manual discount is limited to 10% of the subtotal; the backend checks the combined manual + coupon discount as well. Manager/admin accounts are not subject to the cashier limit.
- Sell screen supports Taka and percentage discount entry, void confirmation with undo, editable cart quantities, held-bill details, receipt reprint, customer name/phone search, and per-item VAT labels.
- Admin/manager users can add, hide/show, and delete tagged demo data from the bottom of the Dashboard. Demo records include 50 products, 100 customers, 5 suppliers, sample sales, expenses, two coupons, and a gift card.
- Demo rows are marked with `is_demo`; hiding them excludes them from product/customer/supplier/sales/expense lists and reporting queries without deleting real data.

## Render-e deploy
Notun bhabe: Render Dashboard -> New -> Blueprint -> ei repo. `render.yaml` web service ar PostgreSQL duitai banabe.
Age theke hate banano service thakle: New -> Postgres diye database banan, tarpor service-er Environment-e `DATABASE_URL` (database-er Internal URL) boshan. `DB_FILE` ar disk muche felte paren.
Free plan shudhu test-er jonno. Free database-er meyad shimito ebong backup nei.

## Database code lekhar niyom
`await db.prepare(sql).get/all/run()` (placeholder `?` ba `@name`). Shudhu porar jonno `db.snapshot`. Porte-lekha ek sathe thakle `await db.transaction(async()=>{...})()` byabohar korun. `await` bad diben na.

## Test
Prothome ekbar `npm run build` (ba `npm --prefix backend install`), tarpor `npm test`.
Test-er jonno cholonto PostgreSQL lagbe (default `postgres://postgres:postgres@127.0.0.1:5432/postgres`, onno hole TEST_DATABASE_URL din).
Protiti test nijer osthayi database banay o muche fele. Ashol database-er server TEST_DATABASE_URL-e diben na. Thik kora somossar test: backend/test/regressions.test.js.
GitHub-e push korle `.github/workflows/test.yml` nije test chalay.

## Database migration
Server chalu hole `backend/db/migrations/` er notun file gulo nije cholbe.
- Schema bodlate notun file jog korun: `002_short_name.js`, vitore `exports.up = db => db.query('...')`. Chole jaoa file bodlaben na.
- Data thaka database-e notun migration deploy korar age nije backup nin (`pg_dump "$DATABASE_URL" > backup.sql`). App nije backup ney na.
- Migration fail korle rollback hoy ebong server chalu hoy na.
