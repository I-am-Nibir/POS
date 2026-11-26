# Exchange Workflow Update

## Included in this update
- Added a dedicated **Exchange** sidebar page for Admin and Manager roles.
- Added invoice lookup using the invoice barcode value. A USB keyboard-wedge barcode scanner can scan directly into the invoice field and submit with Enter.
- Added exchange eligibility checks using the configured exchange period (default 5 days), completed-sale status, and remaining sold quantities.
- Added partial/full exchange switches and excluded product categories in Admin Exchange Settings.
- Requires products to be unused and in original condition; used, damaged, or altered items are rejected server-side.
- Replacement products are selected from active products; replacement stock is deducted and accepted exchange stock is returned to inventory.
- Added lower-price difference modes: store credit, exchange voucher, or no credit. Higher replacement value requires the difference to be entered as collected before completion.
- Added exchange history with the processing employee's username and user ID, invoice, amounts, credit mode, and timestamp.
- Added audit log entries for exchange settings changes and completed exchanges.
- Disabled the legacy cash-refund endpoint and removed the old Return/Refund UI from Finance. Cash refunds are not supported; use Exchange.

## Permissions
- Exchange processing and history are currently Admin/Manager only.
- Exchange settings are Admin only.

## Important limitations / follow-up
- USB barcode scanners that emulate a keyboard are supported by the invoice input. Camera scanning is not implemented on this Exchange page.
- Store-credit and voucher balances are recorded in their own tables, but redemption/application at checkout is not yet wired into the Sell payment flow.
- The extra amount collected for a higher-priced replacement is recorded as part of the exchange transaction; payment-terminal/cash-drawer integration is not included.
- Exchange receipt printing is not yet included.
- Exchange condition is confirmed by the staff member in the UI; there is no photo evidence workflow.
- Existing legacy `return_items` records are retained for historical reporting; the new Exchange flow uses separate `exchange_items` records.

## Validation
- `node --check backend/server.js` passed.
- `node --check backend/extra.js` passed.
- JSX syntax transpilation for `App.jsx`, `Exchange.jsx`, and `Extra.jsx` passed using the locally available TypeScript transpiler.
- Full Vite production build, live SQLite migration, API integration test, and physical barcode-printer test were not run because project npm dependencies are not installed in this environment.
