# Party Payment / Cashbook Fix

## What changed
- Cashbook `entryNo` uniqueness now uses a partial unique index that only indexes string values. This avoids MongoDB treating multiple legacy `null`/missing entry numbers as duplicate values.
- Backend startup removes the old non-partial `entryNo_1` index and creates the corrected partial unique index.
- Party payment create/update no longer aborts party-ledger recalculation when Cashbook synchronization fails. The payment is saved, the party balance is recalculated, and the API returns `cashbookSyncWarning: true` for reconciliation if needed.
- Frontend displays a clear warning when the payment and party balance are saved but Cashbook sync still needs attention.

## Important deployment note
Restart/redeploy the backend after replacing the project. The index migration runs automatically during backend startup. Back up MongoDB before deploying to production. No live production database was available here, so validate with a staging copy before using it on live accounts.

## Responsive Billing UI update (2026-11-03)

- Added the available-stock indicator to the compact Order Item card layout used on mobile and tablet, matching the stock information shown in the desktop billing table.
- Changed Order Item layout breakpoint so tablet-sized screens use responsive item cards instead of the wide desktop table.
- Added a responsive Return Item card layout for mobile and tablet with the same fields and actions as the desktop return table.
- Kept the full-width tabular layouts for large desktop screens (XL breakpoint and above), avoiding horizontal scrolling on common tablet widths.
- Existing billing calculations, item handlers, and save payloads are unchanged.
