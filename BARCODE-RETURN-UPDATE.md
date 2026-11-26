# Invoice Barcode and Return/Refund Update

## What changed

1. Receipt invoice barcode now encodes the exact sale invoice number using CODE128 (JsBarcode). It is no longer a decorative placeholder. Enable **Invoice barcode** in Admin > Receipt Settings to print it.
2. The Finance screen's former manual sale ID/product ID return form has been replaced with **Return / Refund by Invoice**.
3. Staff can type or scan an invoice number, load the matching sale, inspect its sold items and enter return quantities. The existing backend partial-return endpoint processes the selected quantities and restores stock.
4. Added an authenticated invoice lookup endpoint: `GET /api/sales/by-invoice/:invoice/receipt`. It returns the sale and original line-item snapshots; lookup is case-insensitive and respects demo-data visibility.
5. Camera scanning uses the browser `BarcodeDetector` API and requires a supported browser, camera permission, and HTTPS. A USB/Bluetooth barcode scanner that types into the invoice input and sends Enter can also be used.

## Important limitations / checks

- Return/refund permissions follow the existing return endpoint's manager/admin authorization; cashier access is not granted.
- This update uses the existing partial-return endpoint and its return quantity validation. It does not introduce a new accounting ledger or cash drawer integration.
- Barcode printing is controlled by the existing `showBarcode` Receipt Setting and is off by default until enabled.
- Full frontend production build and physical thermal-printer/scanner tests still need to be run in the target environment.
