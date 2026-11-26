# Dokan POS update notes

## Included changes
- Cashier discounts are capped at 10% of the subtotal. The API validates the combined manual and coupon discount; manager/admin accounts are exempt from the cashier cap.
- Sell screen supports Taka and percentage discounts, quick discount buttons, and a live amount/percentage summary.
- Void confirmation and undo restore the bill state.
- Cart quantity can be typed directly.
- Held bills display customer, time, line count, and total; held bill state is retained.
- Last receipt can be reprinted from the Sell toolbar.
- Customer list can be searched by name or phone.
- Cart rows display the product VAT rate.
- Void button styling remains red.
- Admin/manager dashboard includes demo data seed, visibility, and delete controls.
- Demo data includes 50 products, 100 customers, 5 suppliers, sample sales and expenses, two coupons, and one gift card.
- Demo rows are tagged with `is_demo`; visibility filters are applied to product, customer, supplier, sales, expense, dashboard, reporting, and export queries.

## Deployment
The existing Render blueprint is preserved. It configures a Starter service and a 1 GB persistent disk at `/var/data`, with `DB_FILE=/var/data/pos.db` and a generated `JWT_SECRET`. Keep the disk attached to preserve SQLite data across deploys.

## Validation
- Backend JavaScript syntax checked with Node.
- Frontend JSX syntax parsed/transpiled with the installed TypeScript JSX parser.
- Representative SQLite queries for demo visibility/reporting were checked against a matching schema.
- A full dependency install and Vite production build could not be run in this environment because npm package downloads are unavailable.
