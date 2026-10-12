# SuperGold ERP QA / Fix Report

## Fixed in this build

- Bill deletion now rebuilds the party ledger from the party opening balance; it never uses the deleted bill's previous balance as the new starting point.
- Bill create/edit/delete and party-payment create/edit/delete use MongoDB transactions when the MongoDB connection supports transactions.
- Local standalone MongoDB remains supported through a compatibility fallback; production should use MongoDB Atlas/replica set for atomic transactions.
- Stock movement now rejects a sale that would make stock negative instead of silently clamping stock to zero.
- Party-payment ledger rebuild is deterministic and applies each separate payment once according to payment date.
- Overpayments are preserved as signed credit instead of disappearing through `Math.max(0, ...)`.
- Party edit no longer blindly overwrites `currentBalance`. The existing Due Amount field is treated as a controlled opening-balance adjustment and the ledger is rebuilt.
- Party deletion is blocked when bills or party-payment records exist.
- Money calculations are rounded consistently to two decimal places in the corrected accounting routes.
- Authentication sessions are persisted in MongoDB instead of server memory, so a normal backend restart no longer invalidates every login session.
- Production requires `AUTH_SECRET` and `ADMIN_PASSWORD` instead of silently using production-unsafe defaults.
- Frontend API URL supports `VITE_API_BASE` while retaining the existing localhost fallback for local development.
- Dashboard Last 7 Days filter logic was corrected and the default dashboard filter remains Last 7 Days.
- Edit Bill initial previous balance now uses the previous bill's ledger balance or the party opening balance, not the party's already-derived current balance.
- Stock has a unique variant index for article code + size + selling price.

## QA executed

- All backend JavaScript files passed Node syntax checks.
- Ledger invariant tests passed:
  - deleting a middle bill and rebuilding from scratch
  - overpayment/credit preservation
  - separate payment applied exactly once
  - two-decimal money normalization
- Route syntax QA passed.

## Remaining environment-dependent check

The container could not complete `npm ci`/frontend dependency installation within the available execution window, so a real Vite production build could not be executed here. The source was therefore not claimed as a successful browser build. Run `npm ci && npm run build` inside `frontend` before deployment.
