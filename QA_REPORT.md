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

## Advanced ERP modules added

- Added standalone/linked Supplier Directory with supplier opening balance and supplier ledger.
- Added Purchase Order workflow. Creating a PO does not affect stock.
- Added partial Goods Receipt (GRN). Only accepted pairs are added to stock; rejected pairs are retained in GRN records. PO received quantities and status are updated.
- Added Purchase Invoice creation from received GRNs, one-time GRN invoicing protection, invoice-wise/general supplier payments and supplier payable ledger.
- Added canonical party ledger endpoint. Bill-wise payments are shown on payment date rather than being double-counted in the bill row. Party ledger modal now supports Print and PDF export.
- Added date-filtered Advanced Reports & Analytics with sales, collections, purchases, expenses, stock value, outstanding balances, estimated profit, daily sales and top articles.
- Added admin-only Purchases and Reports navigation tabs. Existing staff/special-staff navigation remains unchanged.

## Additional QA

- All backend route/model/server files passed `node --check`.
- Existing party ledger invariant tests passed.
- TypeScript JSX parser successfully parsed `App.jsx`, `PurchaseManagement.jsx`, and `ReportsAnalytics.jsx`.
- `npm ci` did not complete within the available execution window, so a full Vite production build and live MongoDB workflow test could not be completed in this environment. Run `npm ci` from the project root and `npm run build --workspace frontend` before deployment; then test PO → partial GRN → final GRN → invoice → supplier payment with a database backup first.

## Owner dashboard + smart billing upgrade (v5) QA

- Added party-specific pricing rules (exact article/size, article wildcard, size wildcard and global wildcard precedence); fixed rate and percentage discount are mutually exclusive per rule.
- Billing now resolves party pricing on selection and shows current available pairs; backend re-applies the matching price rule before saving a bill.
- New bills evaluate active party schemes and snapshot the selected scheme, benefit and applied discount. Bill creation rejects stock shortages rather than silently clamping inventory.
- Added admin-only Owner Dashboard API and responsive UI: month sales/collections/outstanding/stock value, estimated profit, party ranking, article margin analysis, low-stock and reorder suggestions, 90-day party purchase estimate, and daily cash closing.
- Daily cash closings are included in operational backup/restore; legacy v4 backups without the new collection remain accepted.
- `npm run qa --workspace backend` passed (`LEDGER_INVARIANTS_OK`, `ROUTES_SYNTAX_OK`).
- TypeScript JSX parser accepted `frontend/src/App.jsx`, `frontend/src/pages/OwnerDashboard.jsx`, and `frontend/src/pages/PartyGrowth.jsx`.
- Full Vite production build and live MongoDB workflow tests were not run because frontend dependencies are not installed in this environment. Run `npm ci` and `npm run build --workspace frontend` before deployment, then test party price rules, a qualifying scheme bill, insufficient-stock rejection, daily close, and backup restore on a database copy.
