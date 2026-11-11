const Party = require('../models/Party.js');
const Bill = require('../models/Bill.js');
const PartyPayment = require('../models/PartyPayment.js');
const { rebuildPartyLedger } = require('./bill.routes.js');

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

function registerRoutes(app) {
  app.get('/api/parties/:id/pricing', async (req, res) => {
    try {
      const party = await Party.findById(req.params.id).select('priceRules').lean();
      if (!party) return res.status(404).json({ error: 'Party not found' });
      const code = String(req.query.articleCode || '').trim().toUpperCase();
      const size = String(req.query.size || '').trim();
      const mrp = Number(req.query.mrp || 0);
      const hasMrp = Number.isFinite(mrp) && mrp > 0;
      const Article = require('../models/Article');
      const Stock = require('../models/Stock');
      const [article, stock] = await Promise.all([
        Article.findOne({ articleCode: code, sizeRange: size, ...(hasMrp ? { mrp } : {}) }).lean(),
        Stock.findOne({ articleCode: code, sizeRange: size, ...(hasMrp ? { mrp } : {}) }).lean()
      ]);
      const rules = (party.priceRules || []).filter(r => r.active !== false && (r.articleCode === '*' || String(r.articleCode||'').toUpperCase() === code) && (r.sizeRange === '*' || String(r.sizeRange||'') === size));
      rules.sort((a,b) => ((b.articleCode !== '*') + (b.sizeRange !== '*')) - ((a.articleCode !== '*') + (a.sizeRange !== '*')));
      const rule = rules[0];
      const baseRate = Number(article?.sellingPrice || article?.wholesaleRate || stock?.sellingPrice || 0);
      let rate = baseRate; let pricingSource = 'Wholesale rate';
      if (rule) {
        if (rule.fixedRate !== null && rule.fixedRate !== undefined && Number.isFinite(Number(rule.fixedRate))) { rate = Number(rule.fixedRate); pricingSource = 'Party fixed rate'; }
        else if (rule.discountPercent !== null && rule.discountPercent !== undefined) { rate = Number((baseRate * (1 - Number(rule.discountPercent)/100)).toFixed(2)); pricingSource = `Party discount ${Number(rule.discountPercent)}%`; }
      }
      // Latest Billed Rate is variant-specific: party + article + size + MRP.
      // Never borrow a rate from another MRP variant of the same article/size.
      // Search bills newest-first and select the newest matching saved line.
      let lastBilledRate = null;
      if (hasMrp) {
        const recentBills = await Bill.find({
          partyId: party._id,
          items: { $elemMatch: { articleCode: code } }
        }).sort({ billDate: -1, billNo: -1 }).select('items billDate billNo').limit(100).lean();
        for (const savedBill of recentBills) {
          const latestLine = (savedBill.items || []).find(item =>
            String(item.articleCode || '').trim().toUpperCase() === code &&
            String(item.size || item.sizeRange || '').trim() === size &&
            Math.abs(Number(item.mrp || 0) - mrp) < 0.005 &&
            Number.isFinite(Number(item.rate)) && Number(item.rate) > 0
          );
          if (latestLine) { lastBilledRate = Number(latestLine.rate); break; }
        }
      }
      if (lastBilledRate !== null) { rate = lastBilledRate; pricingSource = 'Latest billed rate'; }
      res.json({ articleCode: code, size, mrp: hasMrp ? mrp : null, baseRate, rate, lastBilledRate, pricingSource, availablePairs: Number(stock?.totalPairs || 0), hasStockRecord: !!stock });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put('/api/parties/:id/price-rules', async (req, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can manage party rates' });
      const party = await Party.findById(req.params.id);
      if (!party) return res.status(404).json({ error: 'Party not found' });
      const rules = Array.isArray(req.body.rules) ? req.body.rules : [];
      const clean = rules.map(r => {
        const fixedRate = r.fixedRate === '' || r.fixedRate === null || r.fixedRate === undefined ? null : Number(r.fixedRate);
        const discountPercent = r.discountPercent === '' || r.discountPercent === null || r.discountPercent === undefined ? null : Number(r.discountPercent);
        if (fixedRate !== null && (!Number.isFinite(fixedRate) || fixedRate < 0)) throw new Error('Fixed rate must be zero or more');
        if (discountPercent !== null && (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)) throw new Error('Discount must be between 0 and 100');
        if (fixedRate !== null && discountPercent !== null) throw new Error('Choose either fixed rate or discount percentage for one rule');
        return { articleCode: String(r.articleCode || '*').trim().toUpperCase() || '*', sizeRange: String(r.sizeRange || '*').trim() || '*', fixedRate, discountPercent, active: r.active !== false, updatedAt: new Date() };
      });
      party.priceRules = clean; await party.save(); res.json({ success: true, priceRules: party.priceRules });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.get('/api/parties/:id/ledger', async (req, res) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) return res.status(404).json({ error: 'Party not found' });
      const [bills, payments] = await Promise.all([
        Bill.find({ partyId: party._id }).sort({ billDate: 1, billNo: 1 }).lean(),
        PartyPayment.find({ partyId: party._id }).sort({ paymentDate: 1, createdAt: 1 }).lean()
      ]);
      const rows = [];
      if (Number(party.openingBalance || 0) !== 0) rows.push({ id: `opening-${party._id}`, date: null, type: 'Opening Balance', detail: 'Opening balance', debit: Math.max(0, Number(party.openingBalance || 0)), credit: Math.max(0, -Number(party.openingBalance || 0)) });
      bills.forEach(b => { const allocated = Number(b.allocatedPartyCashPaid || 0) + Number(b.allocatedPartyOnlinePaid || 0); const basePaid = Math.max(0, Number(b.amountPaid || 0) - allocated); rows.push({ id: String(b._id), date: b.billDate, createdAt: b.createdAt || b.updatedAt || b.billDate, type: 'Sale Bill', source: 'bill', detail: `Bill #${b.billNo}`, billNo: b.billNo, billId: String(b._id), debit: Number(b.todayTotal || 0), credit: basePaid }); });
      payments.forEach(p => rows.push({ id: String(p._id), date: p.paymentDate, createdAt: p.createdAt || p.updatedAt || p.paymentDate, type: 'Payment Received', source: 'partyPayment', detail: [p.receiptNo, p.allocationType === 'Bill' ? `Against Bill ${p.billNo || ''}` : 'General', p.paymentMode, p.reference, p.remark].filter(Boolean).join(' • '), receiptNo: p.receiptNo, payment: p, debit: 0, credit: Number(p.amount || 0) }));
      // Show ledger chronologically: oldest transactions first, newest at the bottom.
      // For transactions on the same business date, use their actual creation time
      // so a bill/payment appears in the order it was recorded, not by type.
      rows.sort((a, b) => {
        const dateA = new Date(a.date || '1970-01-01').getTime();
        const dateB = new Date(b.date || '1970-01-01').getTime();
        if (dateA !== dateB) return dateA - dateB;
        const createdA = new Date(a.createdAt || a.date || '1970-01-01').getTime();
        const createdB = new Date(b.createdAt || b.date || '1970-01-01').getTime();
        if (createdA !== createdB) return createdA - createdB;
        return String(a.id).localeCompare(String(b.id));
      });
      let balance = 0;
      const transactions = rows.map(row => { balance = Number((balance + Number(row.debit || 0) - Number(row.credit || 0)).toFixed(2)); return { ...row, balance }; });
      res.json({ party, transactions, balance: Number(Number(party.currentBalance || balance).toFixed(2)), bills, payments });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/parties', async (req, res) => {
    try {
      const parties = await Party.find().sort({ createdAt: -1 });
      res.json(parties);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/parties', async (req, res) => {
    try {
      const { name, phone, city, openingBalance } = req.body;
      const creditLimit = Math.max(0, money(req.body.creditLimit));
      if (!String(name || '').trim()) return res.status(400).json({ error: 'Party name is required' });
      const initialBal = money(openingBalance);
      const savedParty = await new Party({
        name: String(name).trim(),
        phone: phone || '',
        city: city || '',
        openingBalance: initialBal,
        currentBalance: initialBal,
        creditLimit
      }).save();
      res.status(201).json(savedParty);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/parties/:id', async (req, res) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) return res.status(404).json({ error: 'Party not found' });

      const updates = {};
      if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (!name) return res.status(400).json({ error: 'Party name is required' });
        updates.name = name;
      }
      if (req.body.phone !== undefined) updates.phone = req.body.phone || '';
      if (req.body.city !== undefined) updates.city = req.body.city || '';
      if (req.body.creditLimit !== undefined) { const limit = money(req.body.creditLimit); if (limit < 0) return res.status(400).json({ error: 'Credit limit cannot be negative' }); updates.creditLimit = limit; }

      const requestedCurrent = req.body.currentBalance !== undefined ? money(req.body.currentBalance) : null;
      const requestedOpening = req.body.openingBalance !== undefined ? money(req.body.openingBalance) : money(party.openingBalance);
      const billCount = await Bill.countDocuments({ partyId: party._id });
      const paymentCount = await PartyPayment.countDocuments({ partyId: party._id });

      if (requestedCurrent !== null) {
        // Keep the existing Parties UI usable: editing "Due Amount" becomes a
        // controlled opening-balance adjustment instead of directly overwriting
        // the derived ledger balance.
        const derived = money(party.currentBalance);
        const delta = money(requestedCurrent - derived);
        updates.openingBalance = money(requestedOpening + delta);
      } else if (req.body.openingBalance !== undefined) {
        // Opening balance can only be changed directly when there is no ledger.
        if (billCount || paymentCount) {
          return res.status(409).json({ error: 'Opening balance cannot be changed directly after bills/payments exist. Use Due Amount to make an opening-balance adjustment.' });
        }
        updates.openingBalance = requestedOpening;
      }

      const updated = await Party.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
      await rebuildPartyLedger(updated._id);
      res.json(await Party.findById(updated._id));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/parties/:id', async (req, res) => {
    try {
      const party = await Party.findById(req.params.id);
      if (!party) return res.status(404).json({ error: 'Party not found' });
      const billCount = await Bill.countDocuments({ partyId: party._id });
      const paymentCount = await PartyPayment.countDocuments({ partyId: party._id });
      if (billCount > 0 || paymentCount > 0) {
        return res.status(409).json({ error: 'This party has bills or payments. Delete/reconcile those records before deleting the party.' });
      }
      await Party.findByIdAndDelete(req.params.id);
      res.json({ message: 'Party deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

module.exports = registerRoutes;
