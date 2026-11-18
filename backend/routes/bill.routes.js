const mongoose = require('mongoose');
const Bill = require('../models/Bill.js');
const Party = require('../models/Party.js');
const PartyPayment = require('../models/PartyPayment.js');
const Article = require('../models/Article.js');
const Stock = require('../models/Stock.js');
const StockMovement = require('../models/StockMovement.js');
const { syncCashEntry } = require('../utils-cashbook');
const CashBookEntry = require('../models/CashBookEntry');
const PartyScheme = require('../models/PartyScheme');
const Sequence = require('../models/Sequence');

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};
const codeOf = (item) => String(item?.articleCode || '').trim().toUpperCase();
const sizeOf = (item) => String(item?.size || item?.sizeRange || '').trim();
const rateOf = (item) => money(item?.rate || 0);

function saleTotal(items = []) {
  return money(items.reduce((sum, item) => {
    const pairs = Math.max(0, Number(item.totalPairs || item.loosePairs || 0));
    const amount = Number(item.totalAmount);
    return sum + (Number.isFinite(amount) ? amount : pairs * rateOf(item));
  }, 0));
}

function returnTotal(items = []) {
  return money(items.reduce((sum, item) => {
    const pairs = Math.max(0, Number(item.totalPairs || 0));
    const amount = Number(item.totalAmount);
    return sum + (Number.isFinite(amount) ? amount : pairs * rateOf(item));
  }, 0));
}

function paymentTotal(body = {}) {
  const cashPaid = money(body.cashPaid);
  const onlinePaid = money(body.onlinePaid);
  const advancePaid = money(body.advancePaid);
  return { cashPaid, onlinePaid, advancePaid, amountPaid: money(cashPaid + onlinePaid + advancePaid) };
}

async function findStockForItem(item, session = null) {
  const code = codeOf(item);
  if (!code) return null;
  const size = sizeOf(item);
  const mrp = money(item?.mrp || 0);
  const opts = session ? { session } : undefined;

  // Inventory identity is Article Code + Size + MRP. Selling rate may vary
  // by customer and must never select or merge a different stock variant.
  let matches = await Stock.find({ articleCode: code, sizeRange: size, mrp }, null, opts);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`Duplicate stock variants found for ${code} / ${size} / MRP ₹${mrp}. Please run the stock variant migration before billing.`);
  }

  // Legacy bill lines may not contain MRP. Only permit an unambiguous fallback.
  if (!(Number(item?.mrp) > 0)) {
    matches = await Stock.find({ articleCode: code, sizeRange: size }, null, opts);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

async function applyStockEffect(items, direction, session = null, priorWarnings = []) {
  const stockWarnings = [];
  for (const item of (Array.isArray(items) ? items : [])) {
    const requestedPairs = Math.max(0, Number(item.totalPairs || 0));
    // When reversing an older bill, restore only the quantity that was actually
    // deducted. Any shortage was warned about but never removed from stock.
    const priorWarning = direction === 1 ? (priorWarnings || []).find((warning) =>
      String(warning.articleCode || '') === codeOf(item) &&
      String(warning.size || '') === sizeOf(item) &&
      String(warning.color || '') === String(item.color || '')
    ) : null;
    const pairs = Math.max(0, requestedPairs - Number(priorWarning?.shortagePairs || 0));
    if (!pairs || !codeOf(item)) continue;

    const stock = await findStockForItem(item, session);
    if (!stock) {
      const opts = session ? { session } : undefined;
      const matches = await Stock.countDocuments({ articleCode: codeOf(item) }, opts);
      if (matches > 1) {
        throw new Error(`Stock variant not found for ${codeOf(item)} / ${sizeOf(item) || 'size'} / rate ₹${rateOf(item)}. Please select the correct article variant.`);
      }
      continue;
    }

    const currentPairs = Number(stock.totalPairs || 0);

if (direction === -1) {
  // Stock records may be incomplete while opening inventory is being entered.
  // Never block billing, but never allow the on-hand stock balance below zero.
  if (currentPairs < pairs) {
    stockWarnings.push({
      articleCode: codeOf(item),
      size: sizeOf(item),
      color: item.color || '',
      availablePairs: currentPairs,
      requiredPairs: pairs,
      shortagePairs: pairs - currentPairs,
      message: `Insufficient stock for ${codeOf(item)} / ${sizeOf(item)}. Available: ${currentPairs} pairs, required: ${pairs}. Bill saved; stock updated to zero.`
    });
  }
  stock.totalPairs = Math.max(0, currentPairs - pairs);
} else {
  // Return hone par stock add hoga.
  stock.totalPairs = currentPairs + pairs;
}

    
    const perCarton = Math.max(1, Number(stock.pairsPerCarton || 12));
    // Keep every on-hand quantity field non-negative.
    stock.cartons = Math.max(0, Math.floor(Math.max(0, stock.totalPairs) / perCarton));
    stock.loosePairs = Math.max(0, stock.totalPairs) % perCarton;
    stock.lastUpdated = Date.now();
    await stock.save(session ? { session } : undefined);
    const movement = new StockMovement({ articleCode: codeOf(item), sizeRange: sizeOf(item), color: item.color || '', movementType: direction === -1 ? 'Sale' : 'Sales Return', quantity: pairs, direction: direction === -1 ? 'OUT' : 'IN', referenceType: 'Bill', referenceNo: '', remarks: direction === -1 && currentPairs < pairs ? `Billing stock movement; shortage ${pairs - currentPairs} pairs warned; on-hand stock capped at zero` : 'Billing stock movement' });
    await movement.save(session ? { session } : undefined);
  }
  return stockWarnings;
}

async function createOrUpdateCustomArticles(items = [], session = null) {
  for (const item of items) {
    const code = codeOf(item);
    if (!code) continue;
    const size = sizeOf(item) || '6*9 (Gents)';
    const rate = rateOf(item);
    const isCustom = item.isCustom === true;
    const variantMrp = money(item.mrp);
    const query = { articleCode: code, sizeRange: size, mrp: variantMrp };
    const opts = session ? { session } : {};
    // Snapshot the contemporaneous purchase cost onto the bill line so future
    // rate changes do not rewrite the historical cost basis for this sale.
    if (!(Number(item.purchaseRate) > 0)) {
      let costVariant = await (session ? Stock.findOne(query).session(session) : Stock.findOne(query));
      if (!costVariant) costVariant = await (session ? Article.findOne(query).session(session) : Article.findOne(query));
      if (costVariant && Number(costVariant.purchaseRate) > 0) item.purchaseRate = Number(costVariant.purchaseRate);
    }
    const exists = await (session ? Article.exists(query).session(session) : Article.exists(query));
    if (!isCustom && exists) continue;

    await Article.findOneAndUpdate(
      query,
      {
        $setOnInsert: {
          articleCode: code,
          brand: item.brand || '',
          color: item.color || '',
          sizeRange: size,
          mrp: money(item.mrp),
          purchaseRate: 0,
          wholesaleRate: rate,
          sellingPrice: rate,
          purchaseDiscountPercent: 0,
          sellingDiscountPercent: money(money(item.mrp) > 0 ? ((money(item.mrp) - rate) / money(item.mrp)) * 100 : 0),
          pairsInPeti: 12
        }
      },
      { ...opts, upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Stock.findOneAndUpdate(
      { articleCode: code, sizeRange: size, mrp: variantMrp },
      {
        $setOnInsert: {
          articleCode: code,
          brand: item.brand || '',
          color: item.color || '',
          sizeRange: size,
          cartons: 0,
          pairsPerCarton: 12,
          loosePairs: 0,
          totalPairs: 0,
          mrp: variantMrp,
          purchaseRate: money(item.purchaseRate || 0),
          sellingPrice: rate,
          lastUpdated: Date.now()
        }
      },
      { ...opts, upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

function paymentDateValue(payment) {
  const d = new Date(`${payment.paymentDate}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

async function rebuildPartyLedger(partyId, startingBalance = null, session = null) {
  if (!partyId) return null;

  const opts = session ? { session } : {};
  const party = await Party.findById(partyId, null, opts);
  if (!party) return null;

  const bills = await Bill.find({ partyId }, null, opts).sort({ billDate: 1, billNo: 1 });
  const allPartyPayments = await PartyPayment.find({ partyId }, null, opts).sort({ paymentDate: 1, createdAt: 1, _id: 1 });
  // Bill-allocated receipts are applied to their selected bill below; only general receipts
  // reduce the running party balance separately. This prevents double-counting.
  const partyPayments = allPartyPayments.filter(payment => payment.allocationType !== 'Bill' || !payment.billId);
  const billAllocatedPayments = allPartyPayments.filter(payment => payment.allocationType === 'Bill' && payment.billId);

  // Rebuild from the party's opening balance every time. Never use a deleted
  // bill's previousBalance as a new starting point.
  let balance = startingBalance !== null ? money(startingBalance) : money(party.openingBalance);
  let paymentIndex = 0;

  for (const bill of bills) {
    const billDate = new Date(bill.billDate || Date.now());
    billDate.setHours(23, 59, 59, 999);

    // Separate party payments dated on/before this bill are applied once,
    // before the bill. Signed balance preserves overpayment as advance credit.
    while (paymentIndex < partyPayments.length && paymentDateValue(partyPayments[paymentIndex]) <= billDate) {
      balance = money(balance - Number(partyPayments[paymentIndex].amount || 0));
      paymentIndex += 1;
    }

    const rawTotal = saleTotal(bill.items || []);
    const returns = returnTotal(bill.returnItems || []);
    const discount = Math.max(0, money(bill.discountVal));
    const today = Math.max(0, money(rawTotal - returns - discount));
    const allocations = billAllocatedPayments.filter(payment => String(payment.billId) === String(bill._id));
    const allocatedCash = money(allocations.filter(payment => payment.paymentMode === 'Cash').reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const allocatedOnline = money(allocations.filter(payment => payment.paymentMode !== 'Cash').reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    // bill.cashPaid/onlinePaid are persisted with allocated amounts, so subtract the
    // current allocation totals to recover the original bill-entry payment amounts.
    const baseCash = Math.max(0, money(Number(bill.cashPaid || 0) - Number(bill.allocatedPartyCashPaid || 0)));
    const baseOnline = Math.max(0, money(Number(bill.onlinePaid || 0) - Number(bill.allocatedPartyOnlinePaid || 0)));
    const baseAdvance = money(bill.advancePaid || 0);
    const payments = { cashPaid: money(baseCash + allocatedCash), onlinePaid: money(baseOnline + allocatedOnline), advancePaid: baseAdvance, amountPaid: money(baseCash + baseOnline + baseAdvance + allocatedCash + allocatedOnline) };

    const previous = money(balance);
    const due = money(previous + today - payments.amountPaid);

    bill.rawTotal = rawTotal;
    bill.returnTotal = returns;
    bill.todayTotal = today;
    bill.previousBalance = previous;
    bill.cashPaid = payments.cashPaid;
    bill.onlinePaid = payments.onlinePaid;
    bill.allocatedPartyCashPaid = allocatedCash;
    bill.allocatedPartyOnlinePaid = allocatedOnline;
    bill.advancePaid = payments.advancePaid;
    bill.amountPaid = payments.amountPaid;
    bill.dueBalance = due;
    await bill.save(session ? { session } : undefined);

    balance = due;
  }

  // Payments after the last bill remain as advance/credit against the party.
  while (paymentIndex < partyPayments.length) {
    balance = money(balance - Number(partyPayments[paymentIndex].amount || 0));
    paymentIndex += 1;
  }

  party.currentBalance = money(balance);
  await party.save(session ? { session } : undefined);
  return party.currentBalance;
}

function transactionUnsupported(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 20 || message.includes('transaction numbers are only allowed') || message.includes('replica set') || message.includes('mongos');
}

function transactionUnsupported(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 20 || message.includes('transaction numbers are only allowed') || message.includes('replica set') || message.includes('mongos');
}


async function nextBillNumber(session = null) {
  const options = session ? { session } : {};
  // Seed once from legacy bills, then allocate atomically. A duplicate-key race
  // during first-time seeding is harmless: the winning request created the row.
  const latest = await Bill.findOne({}, { billNo: 1 }, options).sort({ billNo: -1 }).lean();
  try {
    await Sequence.updateOne(
      { _id: 'billNo' },
      { $setOnInsert: { value: Math.max(1000, Number(latest?.billNo || 1000)) } },
      { ...options, upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
  const sequence = await Sequence.findOneAndUpdate(
    { _id: 'billNo' },
    { $inc: { value: 1 } },
    { ...options, new: true }
  );
  return sequence.value;
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
      console.warn('MongoDB transactions are unavailable on this connection; using compatibility mode. Production should use MongoDB Atlas/replica set.');
      return await work(null);
    }
  } finally {
    await session.endSession();
  }
}

function registerRoutes(app) {
  app.get('/api/billing/availability', async (req, res) => {
    try {
      const code = String(req.query.articleCode || '').trim().toUpperCase();
      const size = String(req.query.size || '').trim();
      if (!code) return res.status(400).json({ error: 'Article code is required' });
      const rows = await Stock.find({ articleCode: code, ...(size ? { sizeRange: size } : {}) }).lean();
      res.json({ articleCode: code, size, variants: rows.map(x => ({ sizeRange: x.sizeRange, availablePairs: Number(x.totalPairs || 0), reorderLevel: Number(x.reorderLevel || 0), sellingPrice: Number(x.sellingPrice || 0) })), availablePairs: rows.reduce((n,x)=>n+Number(x.totalPairs||0),0) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/bills', async (req, res) => {
    try {
      res.json(await Bill.find().sort({ billDate: -1, billNo: -1 }));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/bills/:id', async (req, res) => {
    try {
      const bill = await Bill.findById(req.params.id);
      if (!bill) return res.status(404).json({ error: 'Bill not found' });
      res.json(bill);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/bills', async (req, res) => {
    try {
      const idempotencyKey = String(req.get('Idempotency-Key') || req.body.idempotencyKey || '').trim();
      if (idempotencyKey) {
        const prior = await Bill.findOne({ idempotencyKey });
        if (prior) return res.status(200).json(prior);
      }
      if (!req.body.partyId) return res.status(400).json({ error: 'Party is required' });
      const result = await withTransaction(async (session) => {
        const party = await Party.findById(req.body.partyId).session(session);
        if (!party) throw Object.assign(new Error('Selected party not found'), { statusCode: 400 });

        const items = Array.isArray(req.body.items) ? req.body.items.map(x => ({ ...x })) : [];
        const returnItems = Array.isArray(req.body.returnItems) ? req.body.returnItems : [];
        // The client resolves latest party+article rate before submission.
        // Always honor the rate on the submitted line: staff may manually edit it,
        // and a successfully saved manual rate becomes the next latest rate.
        await createOrUpdateCustomArticles(items, session);

        const rawTotal = saleTotal(items);
        const returns = returnTotal(returnItems);
        const manualDiscountVal = Math.max(0, money(req.body.discountVal));
        const activeSchemes = await PartyScheme.find({ partyId: party._id, active: true, startDate: { $lte: new Date() }, $or: [{ endDate: null }, { endDate: { $gte: new Date() } }] }).session(session).lean();
        const eligibleSchemes = activeSchemes.filter(x => x.schemeType !== 'target_bonus' || rawTotal >= Number(x.targetAmount || 0));
        const schemeBenefits = eligibleSchemes.map(x => ({ scheme: x, discount: x.schemeType === 'discount_percent' ? money(rawTotal * Math.min(100, Math.max(0, Number(x.value || 0))) / 100) : (x.schemeType === 'discount_amount' || x.schemeType === 'target_bonus' ? Math.max(0, money(x.value || 0)) : 0) }));
        schemeBenefits.sort((a,b) => b.discount-a.discount);
        const scheme = schemeBenefits[0]?.scheme || null;
        let schemeDiscountVal = schemeBenefits[0]?.discount || 0;
        schemeDiscountVal = Math.min(schemeDiscountVal, Math.max(0, rawTotal - returns - manualDiscountVal));
        const discountVal = money(manualDiscountVal + schemeDiscountVal);
        const todayTotal = Math.max(0, money(rawTotal - returns - discountVal));
        const payments = paymentTotal(req.body);
        const projectedBalance = money(Number(party.currentBalance || 0) + todayTotal - payments.amountPaid);
        const creditLimit = Number(party.creditLimit || 0);
        if (creditLimit > 0 && projectedBalance > creditLimit) {
          throw Object.assign(new Error(`Party credit limit exceeded. Limit: ₹${creditLimit.toFixed(2)}, projected outstanding: ₹${projectedBalance.toFixed(2)}.`), { statusCode: 409 });
        }

        const billNo = await nextBillNumber(session);

        const savedBill = await new Bill({
          billNo,
          ...(idempotencyKey ? { idempotencyKey } : {}),
          partyId: party._id,
          partyName: req.body.partyName || party.name,
          deliveryMode: req.body.deliveryMode || '',
          deliveryDate: req.body.deliveryDate || null,
          items,
          returnItems,
          rawTotal,
          returnTotal: returns,
          discountVal,
          manualDiscountVal,
          schemeDiscountVal,
          appliedScheme: scheme ? { schemeId: scheme._id, name: scheme.name, schemeType: scheme.schemeType, gift: scheme.gift || '', discount: schemeDiscountVal } : null,
          todayTotal,
          ...payments,
          createdBy: req.user?.username || '',
          createdByRole: req.user?.role || ''
        }).save({ session });

        const stockWarnings = await applyStockEffect(items, -1, session);
        await applyStockEffect(returnItems, +1, session);
        savedBill.stockWarnings = stockWarnings;
        if (stockWarnings.length) await savedBill.save({ session });
        await rebuildPartyLedger(party._id, null, session);
        return savedBill;
      });
      let cashbookSyncWarning = false;
      try {
        await syncCashEntry({sourceType:'BillCash',sourceId:`${result._id}:cash`,date:result.billDate,direction:'IN',account:'Cash',category:'Bill Collection',amount:result.cashPaid,partyName:result.partyName,reference:`Bill ${result.billNo}`,remarks:'Cash collected on bill',createdBy:req.user?.username||''});
        await syncCashEntry({sourceType:'BillOnline',sourceId:`${result._id}:online`,date:result.billDate,direction:'IN',account:'UPI',category:'Bill Collection',amount:result.onlinePaid,partyName:result.partyName,reference:`Bill ${result.billNo}`,remarks:'Online collected on bill',createdBy:req.user?.username||''});
      } catch (syncError) {
        // The bill is already committed. Never report this as a failed bill save:
        // that can cause the client to submit a second bill after a retry.
        cashbookSyncWarning = true;
        console.error(`Cashbook sync failed for saved bill ${result.billNo}:`, syncError);
      }
      res.status(201).json({ ...result.toObject(), cashbookSyncWarning });
    } catch (err) {
      if (err.code === 11000) {
        const key = String(req.get('Idempotency-Key') || req.body.idempotencyKey || '').trim();
        if (key) {
          const prior = await Bill.findOne({ idempotencyKey: key }).catch(() => null);
          if (prior) return res.status(200).json(prior);
        }
      }
      console.error('Bill create error:', err);
      res.status(err.statusCode || (err.code === 11000 ? 409 : 500)).json({ error: err.code === 11000 ? 'Bill number conflict. Please retry the bill.' : err.message });
    }
  });

  app.put('/api/bills/:id', async (req, res) => {
    try {
      const result = await withTransaction(async (session) => {
        const existing = await Bill.findById(req.params.id).session(session);
        if (!existing) throw Object.assign(new Error('Bill not found'), { statusCode: 404 });

        const isFullBillEdit = Array.isArray(req.body.items) || Array.isArray(req.body.returnItems) || req.body.partyId !== undefined;
        if (!isFullBillEdit) {
          const updatePayload = {};
          ['cashPaid', 'onlinePaid', 'advancePaid'].forEach((key) => {
            if (req.body[key] !== undefined) updatePayload[key] = money(req.body[key]);
          });
          if (req.body.deliveryDate !== undefined) {
  updatePayload.deliveryDate = req.body.deliveryDate || null;
}

if (req.body.deliveryStatus !== undefined) {
  updatePayload.deliveryStatus = req.body.deliveryStatus;
}
          if (req.body.amountPaid !== undefined && req.body.cashPaid === undefined && req.body.onlinePaid === undefined && req.body.advancePaid === undefined) {
            updatePayload.amountPaid = money(req.body.amountPaid);
          }
          await Bill.findByIdAndUpdate(req.params.id, updatePayload, { new: true, session });
          await rebuildPartyLedger(existing.partyId, null, session);
          return Bill.findById(req.params.id).session(session);
        }

        const items = Array.isArray(req.body.items) ? req.body.items : (existing.items || []);
        const returnItems = Array.isArray(req.body.returnItems) ? req.body.returnItems : (existing.returnItems || []);
        const newPartyId = req.body.partyId || existing.partyId;
        const newParty = await Party.findById(newPartyId).session(session);
        if (!newParty) throw Object.assign(new Error('Selected party not found'), { statusCode: 400 });

        await createOrUpdateCustomArticles(items, session);
        await applyStockEffect(existing.items || [], +1, session, existing.stockWarnings || []);
        await applyStockEffect(existing.returnItems || [], -1, session);
        const stockWarnings = await applyStockEffect(items, -1, session);
        await applyStockEffect(returnItems, +1, session);

        const rawTotal = saleTotal(items);
        const returns = returnTotal(returnItems);
        const discountVal = Math.max(0, money(req.body.discountVal));
        const todayTotal = Math.max(0, money(rawTotal - returns - discountVal));
        const payments = paymentTotal(req.body);
        const projectedBalance = money(Number(newParty.currentBalance || 0) + todayTotal - payments.amountPaid);
const creditLimit = Number(newParty.creditLimit || 0);
        if (creditLimit > 0 && projectedBalance > creditLimit) {
          throw Object.assign(new Error(`Party credit limit exceeded. Limit: ₹${creditLimit.toFixed(2)}, projected outstanding: ₹${projectedBalance.toFixed(2)}.`), { statusCode: 409 });
        }

        await Bill.findByIdAndUpdate(req.params.id, {
          partyId: newParty._id,
          partyName: req.body.partyName !== undefined ? req.body.partyName : existing.partyName,
          deliveryMode: req.body.deliveryMode !== undefined ? req.body.deliveryMode : existing.deliveryMode,
          deliveryDate: req.body.deliveryDate !== undefined
  ? req.body.deliveryDate
  : existing.deliveryDate,
          items,
          returnItems,
          rawTotal,
          returnTotal: returns,
          discountVal,
          manualDiscountVal: discountVal,
          schemeDiscountVal: 0,
          appliedScheme: null,
          todayTotal,
          cashPaid: payments.cashPaid,
          onlinePaid: payments.onlinePaid,
          advancePaid: payments.advancePaid,
          amountPaid: payments.amountPaid,
          stockWarnings
        }, { new: true, session });

        const oldPartyId = String(existing.partyId || '');
        const newPartyIdString = String(newParty._id);
        if (oldPartyId && oldPartyId !== newPartyIdString) {
          await rebuildPartyLedger(oldPartyId, null, session);
        }
        await rebuildPartyLedger(newParty._id, null, session);
        return Bill.findById(existing._id).session(session);
      });
      await syncCashEntry({sourceType:'BillCash',sourceId:`${result._id}:cash`,date:result.billDate,direction:'IN',account:'Cash',category:'Bill Collection',amount:result.cashPaid,partyName:result.partyName,reference:`Bill ${result.billNo}`,remarks:'Cash collected on bill',createdBy:req.user?.username||''});
      await syncCashEntry({sourceType:'BillOnline',sourceId:`${result._id}:online`,date:result.billDate,direction:'IN',account:'UPI',category:'Bill Collection',amount:result.onlinePaid,partyName:result.partyName,reference:`Bill ${result.billNo}`,remarks:'Online collected on bill',createdBy:req.user?.username||''});
      res.json(result);
    } catch (err) {
      console.error('Bill update error:', err);
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  app.delete('/api/bills/:id', async (req, res) => {
    try {
      const result = await withTransaction(async (session) => {
        const existing = await Bill.findById(req.params.id).session(session);
        if (!existing) throw Object.assign(new Error('Bill not found'), { statusCode: 404 });

        await applyStockEffect(existing.items || [], +1, session, existing.stockWarnings || []);
        await applyStockEffect(existing.returnItems || [], -1, session);
        await Bill.findByIdAndDelete(req.params.id, { session });
        await CashBookEntry.deleteMany({sourceId:{$in:[`${existing._id}:cash`,`${existing._id}:online`]}});
        await rebuildPartyLedger(existing.partyId, null, session);
        return { message: 'Bill deleted and ledger/stock recalculated successfully' };
      });
      res.json(result);
    } catch (err) {
      console.error('Bill delete error:', err);
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });
}

module.exports = registerRoutes;
module.exports.rebuildPartyLedger = rebuildPartyLedger;
