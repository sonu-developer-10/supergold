const Party = require('../models/Party.js');
const Bill = require('../models/Bill.js');
const PartyPayment = require('../models/PartyPayment.js');
const { rebuildPartyLedger } = require('./bill.routes.js');

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

function registerRoutes(app) {
  app.get('/api/parties', async (req, res) => {
    try {
      const parties = await Party.find().sort({ createdAt: -1 });
      res.json(parties);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/parties', async (req, res) => {
    try {
      const { name, phone, city, openingBalance } = req.body;
      if (!String(name || '').trim()) return res.status(400).json({ error: 'Party name is required' });
      const initialBal = money(openingBalance);
      const savedParty = await new Party({
        name: String(name).trim(),
        phone: phone || '',
        city: city || '',
        openingBalance: initialBal,
        currentBalance: initialBal
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
