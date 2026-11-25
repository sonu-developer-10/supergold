const mongoose = require('mongoose');
const Article = require('../models/Article');
const Stock = require('../models/Stock');
const Bill = require('../models/Bill');
const Party = require('../models/Party');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceipt = require('../models/GoodsReceipt');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const StockMovement = require('../models/StockMovement');
const SizeRange = require('../models/SizeRange');

const clean = value => String(value ?? '').trim();

// Renames a size range everywhere it is stored. Every update below changes ONLY the size text
// of matching rows; quantities, rates, prices and balances are never touched.
async function renameEverywhere(from, to, session) {
  const opts = session ? { session } : {};
  const report = {};
  const count = r => Number(r?.modifiedCount ?? r?.nModified ?? 0);

  report.articles = count(await Article.collection.updateMany({ sizeRange: from }, { $set: { sizeRange: to } }, opts));
  report.stocks = count(await Stock.collection.updateMany({ sizeRange: from }, { $set: { sizeRange: to } }, opts));
  report.stockMovements = count(await StockMovement.collection.updateMany({ sizeRange: from }, { $set: { sizeRange: to } }, opts));

  // Bill lines store the size either as `size` or `sizeRange`, for both sold and returned items.
  let billsTouched = 0;
  for (const arrayName of ['items', 'returnItems']) {
    for (const field of ['size', 'sizeRange']) {
      billsTouched += count(await Bill.collection.updateMany(
        { [`${arrayName}.${field}`]: from },
        { $set: { [`${arrayName}.$[line].${field}`]: to } },
        { ...opts, arrayFilters: [{ [`line.${field}`]: from }] }
      ));
    }
  }
  report.billUpdates = billsTouched;

  report.partyPriceRules = count(await Party.collection.updateMany(
    { 'priceRules.sizeRange': from },
    { $set: { 'priceRules.$[rule].sizeRange': to } },
    { ...opts, arrayFilters: [{ 'rule.sizeRange': from }] }
  ));
  for (const [key, Model] of [['purchaseOrders', PurchaseOrder], ['goodsReceipts', GoodsReceipt], ['purchaseInvoices', PurchaseInvoice]]) {
    report[key] = count(await Model.collection.updateMany(
      { 'items.sizeRange': from },
      { $set: { 'items.$[line].sizeRange': to } },
      { ...opts, arrayFilters: [{ 'line.sizeRange': from }] }
    ));
  }
  return report;
}

// Article and Stock have a unique (articleCode, sizeRange, mrp) index. If the new size name
// would collide with an existing row, stop before changing anything.
async function findCollisions(from, to) {
  const collisions = [];
  for (const [label, Model] of [['Article', Article], ['Stock', Stock]]) {
    const rows = await Model.find({ sizeRange: from }).select('articleCode mrp').lean();
    for (const row of rows) {
      const clash = await Model.exists({ articleCode: row.articleCode, mrp: row.mrp, sizeRange: to });
      if (clash) collisions.push(`${label}: ${row.articleCode} (MRP ${row.mrp})`);
    }
  }
  return collisions;
}

const listNames = async () => (await SizeRange.find().sort({ order: 1, createdAt: 1 }).lean()).map(r => r.name);
const escapeRegex = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function addName(name) {
  const exists = await SizeRange.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') }).lean();
  if (exists) return;
  const last = await SizeRange.findOne().sort({ order: -1 }).lean();
  await SizeRange.create({ name, order: (last?.order ?? 0) + 1 });
}

function registerSizeRangeRoutes(app) {
  app.get('/api/size-ranges', async (req, res) => {
    try { res.json(await listNames()); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/size-ranges', async (req, res) => {
    try {
      const name = clean(req.body.name);
      if (!name || name.length > 60) return res.status(400).json({ error: 'Valid size range required.' });
      await addName(name);
      res.status(201).json(await listNames());
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // One-time seed from a device's existing list; ignored once the shared list has data.
  app.post('/api/size-ranges/bulk', async (req, res) => {
    try {
      if (!(await SizeRange.estimatedDocumentCount())) {
        const names = [...new Set((Array.isArray(req.body.names) ? req.body.names : []).map(clean).filter(n => n && n.length <= 60))].slice(0, 200);
        for (const n of names) await addName(n);
      }
      res.json(await listNames());
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Removes only from the master list (existing articles/bills keep their size). Admin-only via access control.
  app.delete('/api/size-ranges', async (req, res) => {
    try {
      await SizeRange.deleteOne({ name: clean(req.query.name) });
      res.json(await listNames());
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/size-ranges/rename', async (req, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Only Admin can rename a size range.' });
      const from = clean(req.body.from); const to = clean(req.body.to);
      if (!from || !to) return res.status(400).json({ error: 'Old and new size range are required.' });
      if (from === to) return res.status(400).json({ error: 'New size range is the same as the old one.' });
      if (to.length > 60) return res.status(400).json({ error: 'Size range is too long.' });

      const collisions = await findCollisions(from, to);
      if (collisions.length) {
        return res.status(409).json({ error: `"${to}" pehle se in records me use ho raha hai, isliye rename nahi ho sakta: ${collisions.slice(0, 5).join(', ')}${collisions.length > 5 ? ` +${collisions.length - 5} more` : ''}` });
      }

      let report;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => { report = await renameEverywhere(from, to, session); });
      } catch (err) {
        // Standalone MongoDB (no replica set) cannot run transactions; fall back to plain updates.
        if (err?.code === 20 || /Transaction numbers are only allowed/i.test(String(err?.message))) report = await renameEverywhere(from, to, null);
        else throw err;
      } finally { await session.endSession(); }

      try { // keep the shared master list in step with the rename
        const row = await SizeRange.findOne({ name: from });
        if (row) { if (await SizeRange.exists({ name: to })) await SizeRange.deleteOne({ _id: row._id }); else { row.name = to; await row.save(); } }
        else await addName(to);
      } catch (e) { /* list sync is best-effort; data rename already done */ }
      res.json({ success: true, from, to, updated: report });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

module.exports = registerSizeRangeRoutes;
