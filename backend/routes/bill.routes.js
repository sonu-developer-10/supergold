const Bill = require('../models/Bill.js');
const Party = require('../models/Party.js');
const Article = require('../models/Article.js');
const Stock = require('../models/Stock.js');

function registerRoutes(app) {
// --- BILLS ROUTES ---
app.get('/api/bills', async (req, res) => {
  try {
    const bills = await Bill.find().sort({ billDate: -1 });
    res.json(bills);
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
    const lastBill = await Bill.findOne().sort({ billNo: -1 });
    const billNo = lastBill ? lastBill.billNo + 1 : 1001;

    const newBill = new Bill({ billNo, ...req.body });
    const savedBill = await newBill.save();

    // 0. Save manually-entered bill articles into Master Article + Stock master.
    // Existing Stock/Article fields remain unchanged; this only creates a master entry
    // so the same article/rate can be selected automatically on future bills.
    if (req.body.items && Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        const code = String(item.articleCode || '').trim().toUpperCase();
        if (!code) continue;

        const isCustomArticle = item.isCustom === true || !(await Article.exists({ articleCode: code }));
        if (!isCustomArticle) continue;

        const mrp = Number(item.mrp || 0);
        const rate = Number(item.rate || 0);
        const brand = item.brand || '';
        const color = item.color || '';
        const sizeRange = item.size || '6*9 (Gents)';

        await Article.findOneAndUpdate(
          { articleCode: code },
          {
            $setOnInsert: {
              articleCode: code,
              brand,
              color,
              sizeRange,
              mrp,
              purchaseRate: 0,
              wholesaleRate: rate,
              sellingPrice: rate,
              pairsInPeti: 12
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await Stock.findOneAndUpdate(
          { articleCode: code },
          {
            $setOnInsert: {
              articleCode: code,
              brand,
              color,
              sizeRange,
              cartons: 0,
              pairsPerCarton: 12,
              loosePairs: 0,
              totalPairs: 0,
              mrp,
              purchaseRate: 0,
              sellingPrice: rate,
              lastUpdated: Date.now()
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    // 1. Stock Adjustment for New Sold Items (Deduct Stock if article exists in Stock)
    if (req.body.items && Array.isArray(req.body.items)) {
      for (let item of req.body.items) {
        if (item.articleCode && item.totalPairs > 0) {
          const st = await Stock.findOne({ articleCode: item.articleCode });
          if (st) {
            st.totalPairs = Math.max(0, st.totalPairs - item.totalPairs);
            st.cartons = Math.floor(st.totalPairs / (st.pairsPerCarton || 12));
            st.loosePairs = st.totalPairs % (st.pairsPerCarton || 12);
            await st.save();
          }
        }
      }
    }

    // 2. Stock Adjustment for Return Items (Add Back Stock if article exists in Stock)
    if (req.body.returnItems && Array.isArray(req.body.returnItems)) {
      for (let rItem of req.body.returnItems) {
        if (rItem.articleCode && rItem.totalPairs > 0) {
          const st = await Stock.findOne({ articleCode: rItem.articleCode });
          if (st) {
            st.totalPairs += rItem.totalPairs;
            st.cartons = Math.floor(st.totalPairs / (st.pairsPerCarton || 12));
            st.loosePairs = st.totalPairs % (st.pairsPerCarton || 12);
            await st.save();
          }
        }
      }
    }

    // 3. Update Party Ledger Dues
    if (req.body.partyId) {
      await Party.findByIdAndUpdate(req.body.partyId, {
        currentBalance: req.body.dueBalance
      });
    }

    res.status(201).json(savedBill);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bills/:id', async (req, res) => {
  try {
    const existing = await Bill.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Bill not found' });

    // Payment-only update (used by the delivery-payment screen).
    const isFullBillEdit = Array.isArray(req.body.items) || Array.isArray(req.body.returnItems) || req.body.partyId !== undefined;

    if (!isFullBillEdit) {
      const updatePayload = {};
      ['todayTotal', 'amountPaid', 'dueBalance', 'cashPaid', 'onlinePaid'].forEach((key) => {
        if (req.body[key] !== undefined) updatePayload[key] = Number(req.body[key] || 0);
      });

      const updated = await Bill.findByIdAndUpdate(req.params.id, updatePayload, { new: true });
      if (updated && updated.partyId && req.body.dueBalance !== undefined) {
        await Party.findByIdAndUpdate(updated.partyId, { currentBalance: Number(req.body.dueBalance || 0) });
      }
      return res.json(updated);
    }

    const oldPartyId = String(existing.partyId || '');
    const newPartyId = req.body.partyId || existing.partyId;
    const items = Array.isArray(req.body.items) ? req.body.items : (existing.items || []);
    const returnItems = Array.isArray(req.body.returnItems) ? req.body.returnItems : (existing.returnItems || []);

    // Create master/stock records for newly entered custom articles.
    for (const item of items) {
      const code = String(item.articleCode || '').trim().toUpperCase();
      if (!code) continue;
      const existsInArticle = await Article.exists({ articleCode: code });
      const isCustomArticle = item.isCustom === true || !existsInArticle;
      if (!isCustomArticle) continue;

      const mrp = Number(item.mrp || 0);
      const rate = Number(item.rate || 0);
      const brand = item.brand || '';
      const color = item.color || '';
      const sizeRange = item.size || '6*9 (Gents)';

      await Article.findOneAndUpdate(
        { articleCode: code },
        {
          $setOnInsert: {
            articleCode: code, brand, color, sizeRange, mrp,
            purchaseRate: 0, wholesaleRate: rate, sellingPrice: rate, pairsInPeti: 12
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await Stock.findOneAndUpdate(
        { articleCode: code },
        {
          $setOnInsert: {
            articleCode: code, brand, color, sizeRange, cartons: 0,
            pairsPerCarton: 12, loosePairs: 0, totalPairs: 0, mrp,
            purchaseRate: 0, sellingPrice: rate, lastUpdated: Date.now()
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    // Reverse old stock effect, then apply the edited bill's effect.
    // Sale = stock -pairs, Return = stock +pairs.
    const stockDelta = new Map();
    const addStockEffect = (list, sign) => {
      for (const item of (Array.isArray(list) ? list : [])) {
        const code = String(item.articleCode || '').trim().toUpperCase();
        const pairs = Math.max(0, Number(item.totalPairs || 0));
        if (!code || !pairs) continue;
        stockDelta.set(code, (stockDelta.get(code) || 0) + sign * pairs);
      }
    };
    addStockEffect(existing.items, +1);       // undo old sale
    addStockEffect(existing.returnItems, -1); // undo old return
    addStockEffect(items, -1);                // apply new sale
    addStockEffect(returnItems, +1);          // apply new return

    for (const [articleCode, delta] of stockDelta.entries()) {
      if (!delta) continue;
      const st = await Stock.findOne({ articleCode });
      if (!st) continue;
      st.totalPairs = Math.max(0, Number(st.totalPairs || 0) + delta);
      const perCarton = Number(st.pairsPerCarton || 12);
      st.cartons = Math.floor(st.totalPairs / perCarton);
      st.loosePairs = st.totalPairs % perCarton;
      st.lastUpdated = Date.now();
      await st.save();
    }

    const rawTotal = items.reduce((sum, item) => sum + (Number(item.totalAmount) || (Number(item.totalPairs || 0) * Number(item.rate || 0))), 0);
    const returnTotal = returnItems.reduce((sum, item) => sum + (Number(item.totalAmount) || (Number(item.totalPairs || 0) * Number(item.rate || 0))), 0);
    const discountVal = Math.max(0, Number(req.body.discountVal || 0));

    let previousBalance = Number(req.body.previousBalance);
    if (!Number.isFinite(previousBalance)) previousBalance = Number(existing.previousBalance || 0);

    // If party changes, use the new party's current ledger as previous balance.
    if (String(newPartyId) !== oldPartyId) {
      const newParty = await Party.findById(newPartyId);
      if (!newParty) return res.status(400).json({ error: 'Selected party not found' });
      previousBalance = Number(newParty.currentBalance || 0);
    }

    const todayTotal = Math.max(0, rawTotal - returnTotal - discountVal);
    const cashPaid = Math.max(0, Number(req.body.cashPaid || 0));
    const onlinePaid = Math.max(0, Number(req.body.onlinePaid || 0));
    const advancePaid = Math.max(0, Number(req.body.advancePaid || 0));
    const amountPaid = cashPaid + onlinePaid + advancePaid;
    const dueBalance = (todayTotal + previousBalance) - amountPaid;

    const updatePayload = {
      partyId: newPartyId,
      partyName: req.body.partyName !== undefined ? req.body.partyName : existing.partyName,
      deliveryMode: req.body.deliveryMode !== undefined ? req.body.deliveryMode : existing.deliveryMode,
      items,
      returnItems,
      rawTotal,
      returnTotal,
      discountVal,
      todayTotal,
      previousBalance,
      advancePaid,
      cashPaid,
      onlinePaid,
      amountPaid,
      dueBalance
    };

    // billNo and billDate are intentionally preserved.
    const updated = await Bill.findByIdAndUpdate(req.params.id, updatePayload, { new: true });

    if (oldPartyId && oldPartyId !== String(newPartyId)) {
      const oldParty = await Party.findById(oldPartyId);
      if (oldParty) {
        const latestOldBill = await Bill.findOne({ partyId: oldParty._id, _id: { $ne: existing._id } }).sort({ billDate: -1 });
        oldParty.currentBalance = latestOldBill ? Number(latestOldBill.dueBalance || 0) : Number(oldParty.openingBalance || 0);
        await oldParty.save();
      }
    }
    if (updated && updated.partyId) {
      await Party.findByIdAndUpdate(updated.partyId, { currentBalance: Number(updated.dueBalance || 0) });
    }

    res.json(updated);
  } catch (err) {
    console.error('Bill update error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bill deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

}

module.exports = registerRoutes;
