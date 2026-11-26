# Loyalty / Reward Points Update

- Admin can enable or disable loyalty points.
- Admin configures the spend amount and points earned, the BDT value of each redeemed point, minimum redemption, and maximum redemption per sale.
- Default rule: each BDT 100 of eligible discounted merchandise spend earns 1 point; each point redeems for BDT 1; minimum redemption 10 points; maximum 500 points per sale.
- Points are earned on the merchandise subtotal after manual, coupon, and loyalty discounts, before VAT. Redeemed value does not earn new points. Walk-in sales do not earn points.
- The Sell screen displays the selected customer's point balance, redemption input, discount value, and estimated points earned.
- Sale processing validates points on the server and updates customer balance plus the points ledger in one SQLite transaction. Redemption and earning are recorded separately.
- Receipt output includes points redeemed, points earned, and remaining balance when a registered customer is selected.
- Admin/manager can inspect a customer's points ledger from the Customers page.
- Exchanges on sales created after this update recalculate net earned points against the original discounted merchandise value, cumulative returned items, and replacement merchandise using the earning rate saved with that sale. Point reversals are ledgered separately; if previously earned points were already spent, the balance can become negative and future earnings offset it. Older sales are left unchanged because their historical loyalty calculation cannot be reconstructed reliably.
- Store Credit / Exchange Voucher redemption remains mutually exclusive with discount/coupon/gift-card/loyalty redemption. Cash refunds remain disabled.
