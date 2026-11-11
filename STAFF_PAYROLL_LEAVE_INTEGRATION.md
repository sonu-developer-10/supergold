# SuperGold ERP — Integrated Staff Payroll & Leave Update

## Included

- Opening pending amount with an explicit `As On` date.
- Calendar-day salary accrual (monthly salary divided by 28/29/30/31).
- Current month accrues only through the local current date; future dates are not accrued.
- Salary revision history with an effective date. Existing staff without revision documents continue to use their existing salary until the first salary edit; on that first edit a legacy baseline revision is written before the new revision.
- Two paid leave-day units per calendar month. Approved leave requests, Admin direct-marked leave, and attendance Absent/Half-Day statuses consume the same monthly allowance. The allowance does not carry forward. Half-days consume 0.5 unit.
- Staff can submit their own leave request from the staff login. Admin can approve/reject requests and can directly mark a leave as approved.
- Staff login linking from Admin > Staff & Expenses > Edit Staff. Create the login first from Login Users, then select it in Linked staff login.
- Advance and salary payment mode (`Cash`, `Online`, `Bank`) stored on the source record and reflected in CashBook as an OUT transaction.
- Editing a staff advance/payment updates its CashBook source entry; deleting it removes its linked CashBook entry.
- Staff delete action now deactivates the staff profile, stops new salary accrual after the deactivation date, and retains attendance, leave, advance, payment and payroll history.
- Staff statement PDF includes opening balance, month-wise payroll, paid/unpaid leave counts and payment modes.

## Accounting rules

`Daily salary = monthly salary / calendar days in that month`.

Salary accrues from the later of joining date and (when opening balance is positive) the day after `openingBalanceAsOf`, through today for the current month or month-end for a completed month.

The first 2 absence/leave day-units in each month are paid. Later units are deducted at that date's daily rate. Approved leave takes precedence over attendance on the same date, so the same date is never deducted twice.

`Closing outstanding = opening pending + accrued salary after attendance deductions - advances - salary payments`.

Payments are permitted up to the staff member's total outstanding balance, so a payment can clear an old opening balance as well as current salary.

## Existing data safety

- No collection is dropped or reset.
- No existing staff, attendance, advance, salary-payment, leave, expense or CashBook record is bulk rewritten.
- New Staff fields have defaults so existing documents remain readable.
- Existing records with no payment mode display as Cash; they are not backfilled into CashBook to avoid creating duplicate historical cashbook entries.
- Staff deletion is now a soft deactivation; existing history is retained.
- Salary revision history is additive. A legacy salary baseline is added only when an existing staff member's salary is first changed and no revision history exists.

## Staff leave login linking

1. Admin opens **Login Users** and creates/activates a user with role `staff`.
2. Admin opens **Staff & Expenses** and edits the matching staff profile.
3. Select that login in **Linked staff login** and save.
4. The linked staff login sees **My Leave**, can submit requests, and can see only its own leave history.
5. Admin approves/rejects the request, or Admin uses **Direct Mark Leave** to create an already-approved leave.

A staff login that is not linked to a staff profile receives a clear message to contact Admin. Staff login access is limited to its own leave request/history endpoints; it does not gain access to Staff & Expenses, payroll, attendance, expenses or salary records.

## Local test / run

Use the existing local test database only (`wholesale_erp_test`) and keep the live Atlas URI out of the local `.env` during QA.

From the project root:

```bash
npm install
npm run build --workspace frontend
npm run qa --workspace backend
```

Then start backend and frontend using the project's existing run instructions. Do not run any database reset command. The new collections/fields are additive and are created by normal Mongoose model use.

## QA status for this archive

- Backend JavaScript syntax checks: passed for all route files, staff models and auth middleware.
- Frontend JSX/JavaScript syntax transpilation check: passed using the installed TypeScript compiler parser.
- Full Vite production build: not run because the dependency installation did not complete in this environment (`vite` executable was unavailable).
- MongoDB integration and browser workflow: not run in this environment because Mongoose dependencies were unavailable and no test database connection was opened.
- Live database: not accessed.

Before production deployment, run the local `wholesale_erp_test` smoke test and confirm the linked staff login, one request/approval, one direct leave, one Cash advance, one Online salary payment and PDF statement.

## Files updated

- `backend/models/Staff.js`
- `backend/models/StaffRecord.js`
- `backend/models/StaffSalaryPayment.js`
- `backend/models/StaffLeave.js`
- `backend/models/StaffSalaryRevision.js` (new)
- `backend/routes/staff.routes.js`
- `backend/middleware/auth.js`
- `frontend/src/App.jsx`
- `STAFF_PAYROLL_LEAVE_INTEGRATION.md` (this guide)
- `STAFF_PAYROLL_QA_REPORT.md`
