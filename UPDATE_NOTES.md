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

## Receipt customization update
- Added an admin-only Receipt Settings page with 58mm/80mm paper selection, logo upload/remove, editable business details, show/hide controls, print-mode preference, and live preview.
- Receipt preferences are stored in the SQLite `app_settings` table through authenticated API endpoints, so settings persist across sessions and devices using the same database.
- Sales now follow the configured post-payment print mode: Auto opens the browser print dialog; Manual leaves a receipt print action available after the sale. Reprint uses the saved current receipt settings.
- Browser print dialogs are subject to browser popup/print permissions. This does not provide unattended silent printing; that requires a supported local/thermal printer integration.


## Sales report receipt reprint update

- Added a Print button to every row in Reports → Sales list.
- Added authenticated `GET /api/sales/:id/receipt` for managers/admins; it retrieves the saved sale and original line items from SQLite, including product-name snapshots.
- Reprints use the current admin-configured receipt settings (58mm/80mm, logo and visibility options).
- The original sale timestamp is printed; refunded/other non-completed statuses are labelled on the receipt.
- The print window is opened directly from the click event before the API request to reduce browser popup-blocking issues. Allow pop-ups for the POS site if prompted.
- Reprint availability follows the current demo-data visibility setting.

### Invoice barcode sizing adjustment
- Reduced the printed invoice CODE128 barcode bar module width and height.
- Removed the duplicate human-readable value under the barcode because the invoice number is already printed above it.
- Constrained the barcode SVG to the receipt content width (54mm on 58mm paper / 76mm on 80mm paper), so it cannot extend wider than the receipt's product-list column.
- Note: very long invoice identifiers can still produce dense barcodes; test with the actual scanner and printer before production use.

## Exchange policy on receipts (latest update)
- Added an Admin-controlled Exchange Policy section to Receipt Settings.
- The receipt policy can be shown/hidden, and the exchange period (default 5 days) is configurable.
- Admin can edit the policy body, the `NO RETURN – NO REFUND.` notice, and the closing message.
- `{days}` in the policy text is replaced with the configured exchange period on both live preview and printed receipts.
- Backend validates the configured period (0–365 days) and limits policy text lengths.
- The setting is persisted with the existing receipt configuration in SQLite.

Testing note: backend syntax check passed. Frontend production build and physical thermal-printer output have not yet been verified in this environment.
