
const mongoose = require('mongoose');
const Bill = require('../models/Bill.js');
const Party = require('../models/Party.js');
const PartyPayment = require('../models/PartyPayment.js');
const Stock = require('../models/Stock.js');

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

const codeOf = (item) =>
  String(item?.articleCode || '').trim().toUpperCase();

const sizeOf = (item) =>
  String(item?.size || item?.sizeRange || '').trim();

const rateOf = (item) => money(item?.rate || 0);

function saleTotal(items = []) {
  return money(items.reduce((sum, item) => {
    const pairs = Math.max(
      0,
      Number(item.totalPairs || item.loosePairs || 0)
    );

    const amount = Number(item.totalAmount);

    return sum + (
      Number.isFinite(amount)
        ? amount
        : pairs * rateOf(item)
    );
  }, 0));
}

function returnTotal(items = []) {
  return money(items.reduce((sum, item) => {
    const pairs = Math.max(0, Number(item.totalPairs || 0));
    const amount = Number(item.totalAmount);

    return sum + (
      Number.isFinite(amount)
        ? amount
        : pairs * rateOf(item)
    );
  }, 0));
}

function paymentTotal(body = {}) {
  const cashPaid = money(body.cashPaid);
  const onlinePaid = money(body.onlinePaid);
  const advancePaid = money(body.advancePaid);

  return {
    cashPaid,
    onlinePaid,
    advancePaid,
    amountPaid: money(cashPaid + onlinePaid + advancePaid)
  };
}

// Find existing stock only.
// Customer-specific bill rates must not create stock variants.
async function findStockForItem(item, session = null) {
  const code = codeOf(item);
  if (!code) return null;

  const size = sizeOf(item);
  const rate = rateOf(item);
  const opts = session ? { session } : undefined;

  // 1. Exact article + size + selling price
  let matches = await Stock.find(
    {
      articleCode: code,
      sizeRange: size,
      sellingPrice: rate
    },
    null,
    opts
  );

  if (matches.length === 1) return matches[0];

  // 2. Same article + same size
  // Use this only when the matching size is unambiguous.
  matches = await Stock.find(
    {
      articleCode: code,
      sizeRange: size
    },
    null,
    opts
  );

  if (matches.length === 1) return matches[0];

  // 3. If only one stock variant exists for this article
  if (matches.length === 0) {
    matches = await Stock.find(
      { articleCode: code },
      null,
      opts
    );

    if (matches.length === 1) return matches[0];
  }

  return null;
}

async function applyStockEffect(items, direction, session = null) {
  for (const item of (Array.isArray(items) ? items : [])) {
    const pairs = Math.max(0, Number(item.totalPairs || 0));

    if (!pairs || !codeOf(item)) continue;

    const stock = await findStockForItem(item, session);

    if (!stock) {
      const opts = session ? { session } : undefined;

      const matches = await Stock.countDocuments(
        { articleCode: codeOf(item) },
        opts
      );

      if (matches > 1) {
        throw new Error(
          `Stock variant not found for ${codeOf(item)} / ` +
          `${sizeOf(item) || 'size'} / rate ₹${rateOf(item)}. ` +
          'Please select the correct article variant.'
        );
      }

      // Do not create a stock record automatically.
      continue;
    }

    const currentPairs = Number(stock.totalPairs || 0);

    if (direction === -1) {
      // Bill sale: do not allow stock to become negative.
      stock.totalPairs = Math.max(0, currentPairs - pairs);
    } else {
      // Return or restoring an old bill.
      stock.totalPairs = currentPairs + pairs;
    }

    const perCarton = Math.max(
      1,
      Number(stock.pairsPerCarton || 12)
    );

    stock.cartons = Math.floor(
      stock.totalPairs / perCarton
    );

    stock.loosePairs = stock.totalPairs % perCarton;
    stock.lastUpdated = Date.now();

    await stock.save(
      session ? { session } : undefined
    );
  }
}

/*
 * IMPORTANT:
 * Billing and Edit Bill must not create/update Article Master records.
 * Customer-specific selling rates stay inside the bill's items.
 * Add new articles and stock variants explicitly through their
 * respective master/inventory workflows.
 */
async function createOrUpdateCustomArticles() {
  return;
}

function paymentDateValue(payment) {
  const d = new Date(`${payment.paymentDate}T00:00:00`);

  return Number.isNaN(d.getTime())
    ? new Date(0)
    : d;
}

async function rebuildPartyLedger(
  partyId,
  startingBalance = null,
  session = null
) {
  if (!partyId) return null;

  const opts = session ? { session } : {};

  const party = await Party.findById(
    partyId,
    null,
    opts
  );

  if (!party) return null;

  const bills = await Bill.find(
    { partyId },
    null,
    opts
  ).sort({ billDate: 1, billNo: 1 });

  const partyPayments = await PartyPayment.find(
    { partyId },
    null,
    opts
  ).sort({ paymentDate: 1, createdAt: 1, _id: 1 });

  // Always rebuild from opening balance, not from a deleted bill.
  let balance = startingBalance !== null
    ? money(startingBalance)
    : money(party.openingBalance);

  let paymentIndex = 0;

  for (const bill of bills) {
    const billDate = new Date(bill.billDate || Date.now());
    billDate.setHours(23, 59, 59, 999);

    // Apply party payments dated on/before this bill.
    while (
      paymentIndex < partyPayments.length &&
      paymentDateValue(partyPayments[paymentIndex]) <= billDate
    ) {
      balance = money(
        balance - Number(partyPayments[paymentIndex].amount || 0)
      );

      paymentIndex += 1;
    }

    const rawTotal = saleTotal(bill.items || []);
    const returns = returnTotal(bill.returnItems || []);
    const discount = Math.max(0, money(bill.discountVal));

    const today = Math.max(
      0,
      money(rawTotal - returns - discount)
    );

    const payments = paymentTotal(bill);

    const previous = money(balance);
    const due = money(
      previous + today - payments.amountPaid
    );

    bill.rawTotal = rawTotal;
    bill.returnTotal = returns;
    bill.todayTotal = today;
    bill.previousBalance = previous;
    bill.cashPaid = payments.cashPaid;
    bill.onlinePaid = payments.onlinePaid;
    bill.advancePaid = payments.advancePaid;
    bill.amountPaid = payments.amountPaid;
    bill.dueBalance = due;

    await bill.save(
      session ? { session } : undefined
    );

    balance = due;
  }

  // Payments after the last bill remain as advance/credit.
  while (paymentIndex < partyPayments.length) {
    balance = money(
      balance - Number(partyPayments[paymentIndex].amount || 0)
    );

    paymentIndex += 1;
  }

  party.currentBalance = money(balance);

  await party.save(
    session ? { session } : undefined
  );

  return party.currentBalance;
}

function transactionUnsupported(err) {
  const message = String(err?.message || '').toLowerCase();

  return (
    err?.code === 20 ||
    message.includes('transaction numbers are only allowed') ||
    message.includes('replica set') ||
    message.includes('mongos')
  );
}

async function withTransaction(work) {
  const session = await mongoose.startSession();

  try {
    let result;

    try {
      await session.withTransaction(async () => {
        result = await work(session);
      });

      return result;
    } catch (err) {
      if (!transactionUnsupported(err)) throw err;

      console.warn(
        'MongoDB transactions are unavailable on this connection; ' +
        'using compatibility mode. Production should use MongoDB ' +
        'Atlas/replica set.'
      );

      return await work(null);
    }
  } finally {
    await session.endSession();
  }
}

function registerRoutes(app) {
  // GET ALL BILLS
  app.get('/api/bills', async (req, res) => {
    try {
      res.json(
        await Bill.find().sort({ billDate: -1, billNo: -1 })
      );
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET ONE BILL
  app.get('/api/bills/:id', async (req, res) => {
    try {
      const bill = await Bill.findById(req.params.id);

      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }

      res.json(bill);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // CREATE BILL
  app.post('/api/bills', async (req, res) => {
    try {
      if (!req.body.partyId) {
        return res.status(400).json({
          error: 'Party is required'
        });
      }

      const result = await withTransaction(async (session) => {
        const party = await Party.findById(req.body.partyId)
          .session(session);

        if (!party) {
          throw Object.assign(
            new Error('Selected party not found'),
            { statusCode: 400 }
          );
        }

        const items = Array.isArray(req.body.items)
          ? req.body.items
          : [];

        const returnItems = Array.isArray(req.body.returnItems)
          ? req.body.returnItems
          : [];

        // Do not create/update Article Master from a bill.
        await createOrUpdateCustomArticles(items, session);

        const rawTotal = saleTotal(items);
        const returns = returnTotal(returnItems);
        const discountVal = Math.max(
          0,
          money(req.body.discountVal)
        );

        const todayTotal = Math.max(
          0,
          money(rawTotal - returns - discountVal)
        );

        const payments = paymentTotal(req.body);

        const lastAnyBill = await Bill.findOne()
          .sort({ billNo: -1 })
          .session(session);

        const billNo = lastAnyBill
          ? Number(lastAnyBill.billNo) + 1
          : 1001;

        const savedBill = await new Bill({
          billNo,
          partyId: party._id,
          partyName: req.body.partyName || party.name,
          deliveryMode: req.body.deliveryMode || '',
          deliveryDate: req.body.deliveryDate || null,
          items,
          returnItems,
          rawTotal,
          returnTotal: returns,
          discountVal,
          todayTotal,
          ...payments
        }).save({ session });

        await applyStockEffect(items, -1, session);
        await applyStockEffect(returnItems, +1, session);
        await rebuildPartyLedger(party._id, null, session);

        return savedBill;
      });

      res.status(201).json(result);
    } catch (err) {
      console.error('Bill create error:', err);

      res.status(
        err.statusCode || (err.code === 11000 ? 409 : 500)
      ).json({
        error: err.code === 11000
          ? 'Bill number conflict. Please retry the bill.'
          : err.message
      });
    }
  });

  // UPDATE BILL
  app.put('/api/bills/:id', async (req, res) => {
    try {
      const result = await withTransaction(async (session) => {
        const existing = await Bill.findById(req.params.id)
          .session(session);

        if (!existing) {
          throw Object.assign(
            new Error('Bill not found'),
            { statusCode: 404 }
          );
        }

        const isFullBillEdit =
          Array.isArray(req.body.items) ||
          Array.isArray(req.body.returnItems) ||
          req.body.partyId !== undefined;

        // Partial update: payments/delivery only.
        if (!isFullBillEdit) {
          const updatePayload = {};

          ['cashPaid', 'onlinePaid', 'advancePaid'].forEach((key) => {
            if (req.body[key] !== undefined) {
              updatePayload[key] = money(req.body[key]);
            }
          });

          if (req.body.deliveryDate !== undefined) {
            updatePayload.deliveryDate = req.body.deliveryDate || null;
          }

          if (req.body.deliveryStatus !== undefined) {
            updatePayload.deliveryStatus = req.body.deliveryStatus;
          }

          if (
            req.body.amountPaid !== undefined &&
            req.body.cashPaid === undefined &&
            req.body.onlinePaid === undefined &&
            req.body.advancePaid === undefined
          ) {
            updatePayload.amountPaid = money(req.body.amountPaid);
          }

          await Bill.findByIdAndUpdate(
            req.params.id,
            updatePayload,
            { new: true, session }
          );

          await rebuildPartyLedger(existing.partyId, null, session);

          return Bill.findById(req.params.id).session(session);
        }

        const items = Array.isArray(req.body.items)
          ? req.body.items
          : (existing.items || []);

        const returnItems = Array.isArray(req.body.returnItems)
          ? req.body.returnItems
          : (existing.returnItems || []);

        const newPartyId = req.body.partyId || existing.partyId;

        const newParty = await Party.findById(newPartyId)
          .session(session);

        if (!newParty) {
          throw Object.assign(
            new Error('Selected party not found'),
            { statusCode: 400 }
          );
        }

        // Never create/update Article Master from Edit Bill.
        await createOrUpdateCustomArticles(items, session);

        // Restore the previous bill's stock effect first.
        await applyStockEffect(existing.items || [], +1, session);
        await applyStockEffect(existing.returnItems || [], -1, session);

        // Apply the edited bill's stock effect.
        await applyStockEffect(items, -1, session);
        await applyStockEffect(returnItems, +1, session);

        const rawTotal = saleTotal(items);
        const returns = returnTotal(returnItems);

        const discountVal = Math.max(
          0,
          money(req.body.discountVal)
        );

        const todayTotal = Math.max(
          0,
          money(rawTotal - returns - discountVal)
        );

        const payments = paymentTotal(req.body);

        await Bill.findByIdAndUpdate(
          req.params.id,
          {
            partyId: newParty._id,
            partyName: req.body.partyName !== undefined
              ? req.body.partyName
              : existing.partyName,
            deliveryMode: req.body.deliveryMode !== undefined
              ? req.body.deliveryMode
              : existing.deliveryMode,
            deliveryDate: req.body.deliveryDate !== undefined
              ? req.body.deliveryDate
              : existing.deliveryDate,
            items,
            returnItems,
            rawTotal,
            returnTotal: returns,
            discountVal,
            todayTotal,
            cashPaid: payments.cashPaid,
            onlinePaid: payments.onlinePaid,
            advancePaid: payments.advancePaid,
            amountPaid: payments.amountPaid
          },
          { new: true, session }
        );

        const oldPartyId = String(existing.partyId || '');
        const newPartyIdString = String(newParty._id);

        if (oldPartyId && oldPartyId !== newPartyIdString) {
          await rebuildPartyLedger(existing.partyId, null, session);
        }

        await rebuildPartyLedger(newParty._id, null, session);

        return Bill.findById(existing._id).session(session);
      });

      res.json(result);
    } catch (err) {
      console.error('Bill update error:', err);

      res.status(err.statusCode || 500).json({
        error: err.message
      });
    }
  });

  // DELETE BILL
  app.delete('/api/bills/:id', async (req, res) => {
    try {
      const result = await withTransaction(async (session) => {
        const existing = await Bill.findById(req.params.id)
          .session(session);

        if (!existing) {
          throw Object.assign(
            new Error('Bill not found'),
            { statusCode: 404 }
          );
        }

        // Restore stock before deleting the bill.
        await applyStockEffect(existing.items || [], +1, session);
        await applyStockEffect(existing.returnItems || [], -1, session);

        await Bill.findByIdAndDelete(
          req.params.id,
          { session }
        );

        await rebuildPartyLedger(existing.partyId, null, session);

        return {
          message: 'Bill deleted and ledger/stock recalculated successfully'
        };
      });

      res.json(result);
    } catch (err) {
      console.error('Bill delete error:', err);

      res.status(err.statusCode || 500).json({
        error: err.message
      });
    }
  });
}

module.exports = registerRoutes;
module.exports.rebuildPartyLedger = rebuildPartyLedger;
