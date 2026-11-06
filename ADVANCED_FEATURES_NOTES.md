# Supergold Advanced Features v2

This update is based on `supergold-main-advanced-erp.zip` and preserves the existing monolithic billing app, purchase workflow and reports.

## Added
- Admin-only Business Tools tab.
- Article grouped size/color stock matrix.
- Per-stock-variant reorder levels and low-stock alert list.
- Stock movement records for bill sale/return, stock inward and purchase GRN receipts.
- Party credit limit field and new-bill enforcement (0 = unlimited).
- Cash & Bank Book with manual entries plus automatic entries synchronized from bill cash/online collections, party receipts, supplier payments and expenses.
- Successful API mutation audit records (no request body/password data stored).
- Daily automatic JSON backup, 30-file retention, backup download, and guarded operational-data restore. Auth users/sessions are excluded.
- WhatsApp payment follow-up links with prefilled messages for user review.
- Database-backed rule-based ERP assistant.
- Purchase cost snapshot copied to new bill lines when available to improve historical COGS estimates.

## Important limitations / deployment notes
- Frontend production build was not run: dependency installation could not complete in this environment. Backend JavaScript syntax checks and the existing ledger invariant test passed.
- Profit is explicitly shown as estimated until opening stock, all historical purchase costs, landed costs, returns and expense accounting are fully reconciled.
- The assistant is rule-based over live ERP records, not a connected external LLM.
- WhatsApp opens a prefilled chat; user must review and send. No message is sent silently.
- Automatic backup writes JSON files to `BACKUP_DIR` (default `backend/backups`), retains 30 days/files, and requires persistent storage in cloud hosting. On ephemeral hosting, configure a persistent disk or external backup target.
- Restore replaces operational collections. Take a fresh backup first. Login users and sessions are not restored.
- Stock movement history starts recording from this version; it cannot reconstruct movements that occurred before installation.


## Owner dashboard and smart billing upgrade (v5)
- Admin-only mobile-responsive Owner Dashboard with current-month sales, collections, party outstanding, stock value, estimated profit, party ranking and low-stock/reorder panels.
- Party-specific flexible price rules: fixed article/size rate OR percentage discount, with exact variant rules taking precedence over wildcard rules. Rules are editable by Admin only and are applied again by the backend when a bill is saved.
- Billing party pricing lookup returns the effective rate and current stock availability; billing UI shows the stock quantity and pricing source beside the selected size.
- Active party schemes are automatically evaluated when a new bill is saved; the chosen scheme and its discount are snapshotted on the bill.
- Insufficient stock now raises a warning but does not block billing. The sold quantity is recorded as negative `totalPairs` until stock inward/adjustment clears the shortage; cartons and loose pairs remain non-negative. The saved bill stores shortage details.
- Daily cash closing records opening cash, cash-in, cash-out, expected cash, counted cash and difference. Closings are Admin-only and included in backup/restore; older v4 backups without this collection remain restorable.
- Party purchase prediction uses the last 90 days of recorded bills. Smart reorder suggestions use 90-day variant demand, a 21-day planning horizon and configured reorder levels.
- Profit values remain explicitly estimated; historical cost completeness and opening stock must be reconciled before treating them as final accounts.
