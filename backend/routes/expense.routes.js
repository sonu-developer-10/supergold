const Expense = require('../models/Expense.js');
const { syncCashEntry } = require('../utils-cashbook');

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
    await syncCashEntry({sourceType:'Expense',sourceId:expense._id,date:expense.date,direction:'OUT',account:req.body.paymentMode||'Cash',category:expense.category,amount:expense.amount,partyName:'',reference:req.body.reference||'',remarks:expense.description,createdBy:req.user?.username||''});
    res.status(201).json(expense);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (!req.body.date || amount <= 0) return res.status(400).json({ error: 'date and positive amount are required' });
    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      { date: req.body.date, category: req.body.category || 'General', amount, description: req.body.description || '' },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    await syncCashEntry({sourceType:'Expense',sourceId:updated._id,date:updated.date,direction:'OUT',account:req.body.paymentMode||'Cash',category:updated.category,amount:updated.amount,remarks:updated.description,createdBy:req.user?.username||''});
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    const CashBookEntry = require('../models/CashBookEntry'); await CashBookEntry.deleteOne({sourceType:'Expense',sourceId:String(req.params.id)});
    res.json({ message: 'Expense deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

}

module.exports = registerRoutes;
