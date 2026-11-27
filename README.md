# POS (Node.js + SQLite + React)
Backend:  cd backend && npm install && JWT_SECRET=$(openssl rand -hex 32) npm start
First run: open the site -> 'First-time setup' screen -> create your own admin account (no default password exists).
Optional: set SETUP_KEY so only you can complete the first-time setup on a public URL.
Frontend: cd frontend && npm install && npm run dev  -> http://localhost:5173
Production: frontend-e `npm run build` korle backend nijei dist serve korbe.

## Env
JWT_SECRET (required) | SETUP_KEY (optional) | PORT | DB_FILE | TZ_OFFSET ('+6 hours') | HTTPS=1 (HTTPS-er pichone chalale)
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

## Render persistence
The included `render.yaml` configures a Starter web service with a 1 GB persistent disk mounted at `/var/data`, and sets `DB_FILE=/var/data/pos.db`. Keep that disk attached to preserve SQLite data across deploys. The blueprint also generates `JWT_SECRET`; do not remove it. The persistent disk is a paid Render feature, not part of the free ephemeral filesystem.

## Test
Prothome ekbar `npm run build` (ba `npm --prefix backend install`), tarpor `npm test`.
Test nijer osthayi database banay, ashol data chhoy na. `todo` mane jana somossa (backend/test/known-issues.test.js).
GitHub-e push korle `.github/workflows/test.yml` nije test chalay.
