const Bill = require('../models/Bill');
const Party = require('../models/Party');
const PartyScheme = require('../models/PartyScheme');
const GiftAnnouncement = require('../models/GiftAnnouncement');
const { adminOnly } = require('../middleware/auth');
const money = n => Number((Number(n || 0)).toFixed(2));

function registerPartyGrowthRoutes(app) {
  app.get('/api/party-growth/overview', adminOnly, async (req, res) => {
    try {
      const [parties, bills, schemes, announcements] = await Promise.all([
        Party.find().lean(), Bill.find().sort({ billDate: -1 }).lean(),
        PartyScheme.find().sort({ createdAt: -1 }).lean(), GiftAnnouncement.find().sort({ announcedAt: -1 }).limit(100).lean()
      ]);
      const partyMap = new Map(parties.map(p => [String(p._id), { partyId: String(p._id), partyName: p.name, partyCity: p.city || '', totalPurchase: 0, billCount: 0, totalPairs: 0, lastPurchase: null }]));
      const salesmanMap = new Map();
      for (const b of bills) {
        const id = String(b.partyId || ''); const row = partyMap.get(id);
        if (row) { row.totalPurchase += Number(b.todayTotal || 0); row.billCount++; row.lastPurchase = !row.lastPurchase || new Date(b.billDate) > new Date(row.lastPurchase) ? b.billDate : row.lastPurchase; }
        const salesman = b.createdBy || 'Not recorded (old bills)';
        const sr = salesmanMap.get(salesman) || { salesman, sales: 0, bills: 0, collections: 0 };
        sr.sales += Number(b.todayTotal || 0); sr.bills++; sr.collections += Number(b.amountPaid || 0); salesmanMap.set(salesman, sr);
      }
      for (const row of partyMap.values()) row.totalPurchase = money(row.totalPurchase);
      const ranking = [...partyMap.values()].sort((a,b) => b.totalPurchase-a.totalPurchase).map((p,i)=>({...p, rank:i+1}));
      const salesmanReport = [...salesmanMap.values()].map(x=>({...x,sales:money(x.sales),collections:money(x.collections)})).sort((a,b)=>b.sales-a.sales);
      res.json({ ranking, salesmanReport, schemes, announcements });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/party-growth/history/:partyId', adminOnly, async (req,res) => {
    try { res.json(await Bill.find({ partyId: req.params.partyId }).sort({ billDate: -1 }).lean()); }
    catch(e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/party-growth/schemes', adminOnly, async (req,res) => {
    try {
      const party = await Party.findById(req.body.partyId);
      if (!party) return res.status(404).json({ error: 'Party not found' });
      const scheme = await PartyScheme.create({ name: req.body.name, partyId: party._id, schemeType: req.body.schemeType, value: Number(req.body.value||0), targetAmount: Number(req.body.targetAmount||0), gift: req.body.gift||'', startDate: req.body.startDate||new Date(), endDate: req.body.endDate||null, active: true, createdBy: req.user.username });
      res.status(201).json(scheme);
    } catch(e) { res.status(400).json({ error: e.message }); }
  });
  app.patch('/api/party-growth/schemes/:id', adminOnly, async (req,res) => {
    try { const row = await PartyScheme.findByIdAndUpdate(req.params.id, { active: !!req.body.active }, { new: true }); if(!row) return res.status(404).json({error:'Scheme not found'}); res.json(row); }
    catch(e) { res.status(400).json({error:e.message}); }
  });
  app.post('/api/party-growth/announcements', adminOnly, async (req,res) => {
    try {
      const party = await Party.findById(req.body.partyId); if(!party) return res.status(404).json({error:'Party not found'});
      const row = await GiftAnnouncement.create({ partyId: party._id, partyName: party.name, title: req.body.title, message: req.body.message||'', gift: req.body.gift||'', createdBy: req.user.username });
      res.status(201).json(row);
    } catch(e) { res.status(400).json({error:e.message}); }
  });
}
module.exports = registerPartyGrowthRoutes;
