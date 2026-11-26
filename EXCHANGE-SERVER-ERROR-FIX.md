# Exchange Server Error Fix

- Changed Store Credit issuance order in `/api/exchange`.
- Previously, the handler attempted to insert a Store Credit row with `exchange_id = 0` before creating the exchange record, then updated it afterward. This can fail on deployments where the existing database enforces an exchange foreign key.
- The handler now creates the exchange record first, then inserts the Store Credit with the actual `exchange_id`, all inside the same SQLite transaction. If any later step fails, the entire exchange rolls back.
- Backend syntax check passed. A live database / deployed Render exchange transaction has not been exercised in this environment.
