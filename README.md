# POS (Node.js + SQLite + React)
Backend:  cd backend && npm install && JWT_SECRET=$(openssl rand -hex 32) npm start   (prothom admin password console-e dekhabe)
Frontend: cd frontend && npm install && npm run dev  -> http://localhost:5173
Production: frontend-e `npm run build` korle backend nijei dist serve korbe.

## Env
JWT_SECRET (dorkari) | PORT | DB_FILE | TZ_OFFSET ('+6 hours') | HTTPS=1 (HTTPS-er pichone chalale)
SHOP_NAME, SHOP_ADDR, SHOP_PHONE  -> receipt header
PRINTER_HOST, PRINTER_PORT(9100), PRINTER_COLS (80mm=42/48, 58mm=32) -> LAN thermal printer (server theke)

## Thermal printer (3 poth)
1. LAN/Ethernet printer: PRINTER_HOST set korun -> sale-er por auto print + cash drawer open.
2. USB-serial / Bluetooth printer: Sell screen-e "🖨 প্রিন্টার" chepe port bachun (Chrome/Edge + HTTPS/localhost).
3. Kono printer connect na thakle: "রসিদ প্রিন্ট" button -> 80mm browser print (Bangla text ey kaj kore).
Note: ESC/POS receipt-e Bangla akkhor print hoy na; Bangla nam hole SKU print hobe.

## Offline mode
- Internet gele bikri local-e jomা hoy (OFF-xxxx), internet ashle auto sync (idempotent, duplicate hoy na).
- Offline-e coupon/gift card, notun customer/product kaj kore na. Offline-e tab/browser bondho korben na (login session harabe).
- Service worker (app offline-e khola) er jonno HTTPS ba localhost lagbe. LAN IP-te http hole SW chalu hobe na.
- Sync fail hole (jemon product delete hoyeche) browser-er localStorage 'failed' list-e thake.
