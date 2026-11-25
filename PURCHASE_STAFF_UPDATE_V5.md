# SuperGold ERP — Purchase & Staff Update v5

Base: SuperGold_ERP_Billing_Responsive_Fix_v4.zip

## Changes
- Supplier deletion endpoint/UI; deletion is blocked when supplier has purchase history.
- Purchase order article-code datalist suggestions from Article Master.
- Purchase order deletion, blocked after any goods have been received.
- Goods Receipt deletion reverses accepted stock, records a stock movement reversal, and restores PO received quantities/status. Deletion is blocked when the GRN is linked to an invoice.
- Purchase invoice edit/delete; edits/deletes are blocked while supplier payments are linked, to protect payable history.
- Supplier payment edit/delete updates linked invoice dues and synchronizes/removes its Cashbook entry.
- Owner Dashboard party ranking and purchase prediction show city. Business Control Center party lists show city.
- Staff row includes Share PDF. It opens a print-ready individual staff statement; choose Print → Save as PDF. Includes attendance history/counts, advances with date/reason/amount, salary payments, and due summary.

## Verification
- Backend route files pass `node --check`.
- JSX transpile/parse checks pass for App.jsx, PurchaseManagement.jsx, OwnerDashboard.jsx, BusinessTools.jsx.
- Full Vite build and live MongoDB integration/browser tests were not run in this environment.
