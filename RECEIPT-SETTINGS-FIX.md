# Receipt Settings Save Fix

## Root cause
The backend limited JSON request bodies to 100 KB, while the receipt settings page permits logo uploads up to 350 KB. A base64-encoded image is larger than its original file, so saving receipt settings with a sufficiently large logo could trigger Express's body-parser 413 HTML error page. The frontend then attempted `response.json()` and displayed `Unexpected token '<'`.

## Changes
- Increased Express JSON body limit from 100 KB to 1 MB (the UI logo limit remains 350 KB).
- Added a JSON 404 response for unknown `/api` endpoints before the SPA fallback.
- Updated the frontend API helper to handle non-JSON responses gracefully and show a useful diagnostic instead of a JSON parse exception.

## Deploy
Redeploy the full project so both `backend/server.js` and `frontend/src/App.jsx` are updated. Then try saving Receipt Settings again. If it still reports an HTML response, verify that the latest backend is deployed and `/api` is routed to this Express server.
