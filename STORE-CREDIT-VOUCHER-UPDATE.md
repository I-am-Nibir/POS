# Store Credit and Exchange Voucher Redemption Update

## Implemented

- Store Credit can be issued from an exchange and is tied to the customer account on the original sale.
- Sell Checkout accepts a Store Credit code after selecting the matching customer account.
- Store Credit supports partial redemption. Any unused balance remains in the customer account until it is spent or expires.
- Exchange Voucher codes can be applied at Sell Checkout. A voucher can be redeemed once only; if the sale total is lower than its balance, the unused remainder is forfeited.
- Admin can configure Store Credit and Voucher expiry in days (default: 365; allowed range: 1–3650).
- Customer Credit Ledger shows Store Credit issue/redemption and Voucher issue/redemption entries, code, date, amount, and account balance for admin/manager users.
- Redemption is validated and recorded inside the sale transaction. Voucher redemption has a unique database constraint to prevent duplicate use; Store Credit balance is decremented transactionally.
- Store Credit and Voucher cannot be combined with manual discount, coupon discount, or gift card. Backend validation enforces this even if the UI is bypassed.
- Credit/Voucher redemption is not queued for offline sales.

## How to use

1. Make the original sale with the customer's account selected if the exchange may produce Store Credit.
2. Complete an exchange with a lower-priced replacement. The configured lower-price policy determines Store Credit, Voucher, or No Credit.
3. At Sell Checkout, select the customer account and enter the Store Credit code, then choose **Apply Credit**. Or enter an Exchange Voucher code and choose **Apply Voucher**.
4. The amount due is recalculated. Store Credit can be partially used; a voucher is one-time use.
5. Complete the sale normally. The server validates the code, balance, expiry, customer ownership, and duplicate-use rules.
6. Admin/manager can open Customers → Credit Ledger to review account credit activity.
7. Admin can set expiry under Exchange → Store Credit & Voucher Settings.

## Database changes

The backend adds `credit_ledger` and `voucher_redemptions`, plus `customer_id` and `expires_at` columns to the existing `store_credits` and `exchange_vouchers` tables. These migrations run on backend startup and preserve existing rows. Existing legacy credits without an expiry remain valid until their balance is consumed; newly issued credits/vouchers receive the configured expiry.

## Important policy notes

- Store Credit is account-based; the original sale must have a customer account attached. An exchange cannot issue account-based Store Credit against a walk-in sale with no customer account.
- Voucher is single-use. If its value exceeds the sale amount, the unused remainder is forfeited.
- No cash refund is introduced. The existing exchange-only policy remains unchanged.

## Validation status

- `node --check` passed for `backend/server.js` and `backend/extra.js`.
- TypeScript JSX transpilation/parsing passed for `Sell.jsx`, `Exchange.jsx`, and `Extra.jsx`.
- SQLite migration and insert statements were smoke-tested with Python's SQLite engine.
- Full `npm run build` could not be completed because npm dependency installation timed out / required registry packages unavailable in the environment. Run `npm run build` in an environment with npm registry access before deployment.
