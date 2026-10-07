const mongoose = require('mongoose');
const PartyPayment = require('../models/PartyPayment.js');
const Party = require('../models/Party.js');
const { rebuildPartyLedger } = require('./bill.routes.js');

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

function transactionUnsupported(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 20 || message.includes('transaction numbers are only allowed') || message.includes('replica set') || message.includes('mongos');
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => { result = await work(session); });
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
  app.get('/api/party-payments', async (req, res) => {
    try {
      const filter = req.query.partyId ? { partyId: req.query.partyId } : {};
      const payments = await PartyPayment.find(filter).sort({ paymentDate: -1, createdAt: -1 });
      res.json(payments);
    } catch (err) {
      console.error('Party payment fetch error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/party-payments', async (req, res) => {
    try {
      const result = await withTransaction(async (session) => {
        const { partyId, paymentDate, amount, paymentMode, reference, remark } = req.body;
        if (!partyId) throw Object.assign(new Error('Party is required'), { statusCode: 400 });
        const party = await Party.findById(partyId).session(session);
        if (!party) throw Object.assign(new Error('Party not found'), { statusCode: 404 });
        const paymentAmount = money(amount);
        if (paymentAmount <= 0) throw Object.assign(new Error('Payment amount must be greater than 0'), { statusCode: 400 });

        const payment = await new PartyPayment({
          partyId: party._id,
          partyName: party.name,
          paymentDate: paymentDate || new Date().toISOString().slice(0, 10),
          amount: paymentAmount,
          paymentMode: paymentMode === 'Online' ? 'Online' : 'Cash',
          reference: reference || '',
          remark: remark || ''
        }).save({ session });

        const currentBalance = await rebuildPartyLedger(party._id, null, session);
        const updatedParty = await Party.findById(party._id).session(session);
        return { payment, party: updatedParty, currentBalance };
      });
      res.status(201).json(result);
    } catch (err) {
      console.error('Party payment create error:', err);
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  app.put('/api/party-payments/:id', async (req, res) => {
    try {
      const result = await withTransaction(async (session) => {
        const existing = await PartyPayment.findById(req.params.id).session(session);
        if (!existing) throw Object.assign(new Error('Party payment not found'), { statusCode: 404 });
        const party = await Party.findById(existing.partyId).session(session);
        if (!party) throw Object.assign(new Error('Party not found'), { statusCode: 404 });

        const newAmount = money(req.body.amount);
        if (newAmount <= 0) throw Object.assign(new Error('Payment amount must be greater than 0'), { statusCode: 400 });

        existing.paymentDate = req.body.paymentDate || existing.paymentDate;
        existing.amount = newAmount;
        existing.paymentMode = req.body.paymentMode === 'Online' ? 'Online' : 'Cash';
        if (req.body.reference !== undefined) existing.reference = req.body.reference;
        if (req.body.remark !== undefined) existing.remark = req.body.remark;
        await existing.save({ session });

        await rebuildPartyLedger(party._id, null, session);
        const updatedParty = await Party.findById(party._id).session(session);
        return { payment: existing, party: updatedParty };
      });
      res.json(result);
    } catch (err) {
      console.error('Party payment update error:', err);
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  app.delete('/api/party-payments/:id', async (req, res) => {
    try {
      const result = await withTransaction(async (session) => {
        const payment = await PartyPayment.findById(req.params.id).session(session);
        if (!payment) throw Object.assign(new Error('Party payment not found'), { statusCode: 404 });
        await PartyPayment.findByIdAndDelete(req.params.id, { session });
        const currentBalance = await rebuildPartyLedger(payment.partyId, null, session);
        return { message: 'Party payment deleted successfully', currentBalance };
      });
      res.json(result);
    } catch (err) {
      console.error('Party payment delete error:', err);
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });
}

module.exports = registerRoutes;
