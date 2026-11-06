const assert = require('assert');

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

function rebuild(opening, bills, payments) {
  let balance = money(opening);
  let paymentIndex = 0;
  const sortedBills = [...bills].sort((a, b) => a.date.localeCompare(b.date) || a.billNo - b.billNo);
  const sortedPayments = [...payments].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  for (const bill of sortedBills) {
    while (paymentIndex < sortedPayments.length && sortedPayments[paymentIndex].date <= bill.date) {
      balance = money(balance - sortedPayments[paymentIndex].amount);
      paymentIndex++;
    }
    const previous = balance;
    balance = money(previous + bill.total - bill.paid);
    bill.previous = previous;
    bill.due = balance;
  }
  while (paymentIndex < sortedPayments.length) {
    balance = money(balance - sortedPayments[paymentIndex].amount);
    paymentIndex++;
  }
  return { balance, bills: sortedBills };
}

// Delete/rebuild must equal rebuilding from scratch without the deleted bill.
const all = rebuild(0, [
  { billNo: 1001, date: '2026-10-01', total: 10000, paid: 0 },
  { billNo: 1002, date: '2026-10-02', total: 5000, paid: 0 },
  { billNo: 1003, date: '2026-10-03', total: 3000, paid: 0 }
], []);
const afterDelete = rebuild(0, [
  { billNo: 1001, date: '2026-10-01', total: 10000, paid: 0 },
  { billNo: 1003, date: '2026-10-03', total: 3000, paid: 0 }
], []);
assert.strictEqual(all.balance, 18000);
assert.strictEqual(afterDelete.balance, 13000);
assert.strictEqual(afterDelete.bills[1].previous, 10000);

// Overpayment must remain as signed credit instead of disappearing.
const credit = rebuild(0, [{ billNo: 1001, date: '2026-10-01', total: 1000, paid: 1500 }], []);
assert.strictEqual(credit.balance, -500);

// Separate payment must be applied once, not once per bill.
const payment = rebuild(0, [
  { billNo: 1001, date: '2026-10-02', total: 1000, paid: 0 },
  { billNo: 1002, date: '2026-10-03', total: 1000, paid: 0 }
], [{ date: '2026-10-01', amount: 1500, createdAt: 1 }]);
assert.strictEqual(payment.balance, 500);
assert.strictEqual(payment.bills[0].due, -500);
assert.strictEqual(payment.bills[1].previous, -500);

assert.strictEqual(money(43673.880000000005), 43673.88);
console.log('LEDGER_INVARIANTS_OK');
