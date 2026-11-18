# SuperGold ERP — Complete React + Node Project

This is the runnable project for the existing SuperGold ERP.

## Run on Windows / macOS / Linux

Requirements:
- Node.js 18+ (Node 20 LTS recommended)
- MongoDB Atlas or local MongoDB

### 1. Configure backend

Copy `backend/.env.example` to `backend/.env` and put your MongoDB connection string there.

For the existing Atlas database, the database name must remain:

`wholesale_erp`

Do not commit `backend/.env`.

### 2. Install everything

From the project root:

```bash
npm install
```

### 3. Start frontend + backend together

```bash
npm run dev
```

Frontend:
`http://localhost:5173`

Backend:
`http://localhost:5000`

### 4. Production frontend build

```bash
npm run build
```

## Important

The ERP UI code in `frontend/src/App.jsx` is kept intact. The project files around it provide the normal React/Vite entry point, Tailwind processing, dependencies, and backend workspace so the project can be run directly.

Existing API routes, MongoDB model names, login/access-control behavior, and the 30-minute inactivity session behavior are preserved.

## Advanced ERP modules (October 2026)

The admin workspace now includes **Purchases** and **Reports** modules.

### Purchase workflow

1. Create a supplier as a standalone account, or link it to an existing Wholesale Party. The link identifies the same business contact; supplier payable accounting remains in the supplier ledger so it cannot silently alter the wholesale party receivable balance.
2. Create a Purchase Order (PO). A PO does **not** change stock.
3. Receive goods against an open PO through Goods Receipt (GRN). Only accepted pairs increase stock; rejected pairs are recorded separately. Partial receipts are supported and the PO remains open until all ordered quantities have been received.
4. Create a Purchase Invoice against one or more received GRNs. A GRN can only be invoiced once. Invoice discounts, tax, freight, paid amount and due amount are recorded.
5. Record supplier payments as invoice-wise or general supplier payments. Supplier Ledger shows opening payable, purchase invoices, payments and current payable.

### New backend endpoints

- `GET/POST /api/suppliers`, `PUT /api/suppliers/:id`, `GET /api/suppliers/:id/ledger`
- `GET/POST /api/purchase-orders`, `PATCH /api/purchase-orders/:id/status`
- `GET/POST /api/goods-receipts`
- `GET/POST /api/purchase-invoices`
- `GET/POST /api/supplier-payments`
- `GET /api/parties/:id/ledger`
- `GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Reports and calculation notes

Reports include sales, returns, collections, purchase invoices, supplier payments, expenses, current stock valuation, party outstanding, supplier payable, top-selling articles and daily sales. Gross/net profit are explicitly marked as **estimates**: historical COGS uses purchase rate saved on bill items where available, otherwise it falls back to the current Article Master purchase rate. Stock value is a current snapshot, not a historical date-range valuation.


## Advanced Business Control Center (added)

Admin navigation now includes **Business Tools** with:
- Article-wise size/color stock matrix and configurable reorder levels.
- Stock movement log for billing, sales returns, stock inward and purchase GRNs.
- Party credit limits (0 means unlimited); new bills are blocked when projected outstanding exceeds the limit.
- Cash & Bank Book: bill collections, party receipts, supplier payments and expenses are synchronized automatically; manual entries are also supported.
- Profit summary linked to Reports (clearly marked estimated when historical item cost snapshots are missing).
- Successful API mutation audit log (request bodies/secrets are not stored).
- Daily server-side JSON backup, 30-file retention, manual download and guarded restore. Set `BACKUP_DIR` to a persistent mounted directory on cloud hosting.
- WhatsApp payment reminders open a prefilled chat for user review; messages are not sent automatically.
- Rule-based ERP assistant answers from current database summaries; it is not an external generative AI service.

### Backup / restore notes
Automatic backups run after MongoDB connects and then hourly-check for a new daily file. The default local path is `backend/backups`; cloud platforms with ephemeral filesystems require a persistent disk or external backup target. Restore replaces operational collections and intentionally does not replace login users or sessions. Take a fresh backup before restoring.


## Party Growth & Admin Controls (v4)

- Admin-only Party Growth tab: purchase ranking, party bill/item history, salesman-wise sales and collections, party-specific schemes, and gift announcements.
- Gift announcements can be copied into a WhatsApp chat using a prefilled message; the user reviews and sends it.
- Party schemes support percentage discount, fixed discount, or purchase-target/gift records. Scheme records are tracked separately; staff must apply any approved bill discount through the existing bill discount field.
- Size-range master list is deduplicated and Admin can remove unused dropdown values without changing historical bill/article data.
- All API DELETE requests are rejected for non-admin roles, in addition to hiding destructive UI controls from Staff and Special Staff.
- New bills record the authenticated username and role for salesman reporting. Historical bills created before this change are grouped as `Not recorded (old bills)`.

## v5 Owner Dashboard & Smart Billing

The latest v4 project has been extended with an Admin-only responsive Owner Dashboard, flexible party-wise pricing (fixed article/size rates or percentage discounts), stock availability in billing, automatic active party-scheme application, daily cash closing, low-stock/reorder suggestions based on 90-day demand, party purchase predictions, and estimated article-level profit margin analysis. Existing operational data collections are preserved; the new daily cash closing collection is additive. Always take a backup before upgrading a live database.
