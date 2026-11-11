# Staff Payroll & Leave Integration — QA Report

## Static checks

| Check | Result |
|---|---|
| `node --check` on backend routes | PASS |
| `node --check` on staff models | PASS |
| `node --check` on auth middleware | PASS |
| Frontend JSX syntax parse/transpile | PASS |
| Vite production build | NOT RUN — Vite package was not available after dependency install timeout |
| MongoDB route integration | NOT RUN — Mongoose package/test database not available in this environment |
| Browser/mobile visual QA | NOT RUN |
| Live Atlas access | NOT USED |

## Manual acceptance scenarios to run on local `wholesale_erp_test`

1. Create staff with ₹15,000 monthly salary and no opening due. For a 30-day month, daily rate should be ₹500; on day 6, accrued base salary should be ₹3,000.
2. Set an opening pending balance of ₹8,000 as on the prior month-end. Current month accrual starts the next calendar day and the ₹8,000 remains part of total outstanding.
3. Mark/request 2 leave days in a month: no leave deduction. Mark/request a third full leave day: one daily-rate deduction. Half-day consumes 0.5 paid-leave unit.
4. Confirm Pending staff request does not affect payroll until Admin approves it.
5. Admin Direct Mark Leave should immediately be Approved and included in the same 2-day allowance.
6. Link a `staff` login to a staff profile. The login should see My Leave and only its own requests; an unlinked login should receive a clear error.
7. Record a Cash advance and an Online salary payment. Both should appear as OUT entries in CashBook with Cash/UPI account mapping respectively.
8. Edit/delete an advance or salary payment and verify its linked CashBook entry is updated/deleted.
9. Change salary with an effective date. Earlier salary periods should use the prior revision; dates on/after the effective date should use the new salary.
10. Deactivate a staff profile and verify its historical attendance, leaves, advances and salary payments remain in MongoDB.
11. Generate Staff Statement PDF and verify opening balance, month-wise payroll, paid/unpaid leaves and payment modes.

No database reset, destructive migration or historical CashBook backfill is part of this update.

## Monthly staff PDF ledger update

- Staff Share PDF now excludes date-wise attendance history.
- The PDF shows month-wise salary earned after attendance deductions, advance in that month, cumulative advances, salary paid, month balance, and cumulative outstanding due.
- Opening balance is included in the running due from its applicable month; salary payments in excess of a month's net payable reduce older outstanding dues.
- Verify the PDF against the Staff & Expenses outstanding figure for a staff member with an opening balance, advances in multiple months, and payments allocated to older months.
