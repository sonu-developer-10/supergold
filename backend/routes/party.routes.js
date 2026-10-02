const Party = require('../models/Party.js');

function registerRoutes(app) {
// --- PARTIES ROUTES ---
app.get('/api/parties', async (req, res) => {
  try {
    const parties = await Party.find().sort({ createdAt: -1 });
    res.json(parties);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/parties', async (req, res) => {
  try {
    const { name, phone, city, openingBalance } = req.body;
    const initialBal = parseFloat(openingBalance || 0);
    const newParty = new Party({ name, phone, city, openingBalance: initialBal, currentBalance: initialBal });
    const savedParty = await newParty.save();
    res.status(201).json(savedParty);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/parties/:id', async (req, res) => {
  try {
    const updated = await Party.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/parties/:id', async (req, res) => {
  try {
    await Party.findByIdAndDelete(req.params.id);
    res.json({ message: 'Party deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

}

module.exports = registerRoutes;
