const Expense = require('../models/Expense.js');

function registerRoutes(app) {
app.get('/api/expenses', async (req, res) => {
  try {
    const filter = {};
    if (req.query.month) filter.date = { $regex: `^${req.query.month}-` };
    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (!req.body.date || amount <= 0) return res.status(400).json({ error: 'date and positive amount are required' });
    const expense = await new Expense({
      date: req.body.date,
      category: req.body.category || 'General',
      amount,
      description: req.body.description || ''
    }).save();
    res.status(201).json(expense);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

}

module.exports = registerRoutes;
