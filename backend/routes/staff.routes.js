const Staff = require('../models/Staff.js');
const StaffRecord = require('../models/StaffRecord.js');
const StaffSalaryPayment = require('../models/StaffSalaryPayment.js');

function registerRoutes(app) {
// --- STAFF & EXPENSE ROUTES ---
app.get('/api/staff', async (req, res) => {
  try {
    const staff = await Staff.find().sort({ active: -1, joiningDate: -1 });
    res.json(staff);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/staff', async (req, res) => {
  try {
    const saved = await new Staff({
      name: req.body.name,
      phone: req.body.phone || '',
      role: req.body.role || 'Helper',
      monthlySalary: Number(req.body.monthlySalary || 0),
      joiningDate: req.body.joiningDate || Date.now(),
      active: req.body.active !== false
    }).save();
    res.status(201).json(saved);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      phone: req.body.phone || '',
      role: req.body.role || 'Helper',
      monthlySalary: Number(req.body.monthlySalary || 0),
      active: req.body.active !== false
    };
    if (req.body.joiningDate) payload.joiningDate = req.body.joiningDate;
    const updated = await Staff.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Staff not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    await StaffRecord.deleteMany({ staffId: req.params.id });
    await StaffSalaryPayment.deleteMany({ staffId: req.params.id });
    res.json({ message: 'Staff and staff records deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/staff-records', async (req, res) => {
  try {
    const filter = {};
    if (req.query.month) filter.date = { $regex: `^${req.query.month}-` };
    const records = await StaffRecord.find(filter).sort({ date: 1, createdAt: 1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/staff/:id/attendance', async (req, res) => {
  try {
    const { date, status, remark } = req.body;
    if (!date || !status) return res.status(400).json({ error: 'date and status are required' });
    const normalizedStatus = status === 'Half Day' ? 'Half-Day' : status;
    if (!['Present', 'Absent', 'Half-Day'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid attendance status' });
    }
    const record = await StaffRecord.findOneAndUpdate(
      { staffId: req.params.id, date, advanceAmount: { $in: [0, null] } },
      { $set: { status: normalizedStatus, remark: remark || '', advanceAmount: 0 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/staff/:id/advance', async (req, res) => {
  try {
    const { date, amount, reason } = req.body;
    const numericAmount = Number(amount || 0);
    if (!date || numericAmount <= 0) return res.status(400).json({ error: 'date and positive amount are required' });
    const record = await new StaffRecord({
      staffId: req.params.id,
      date,
      status: 'Present',
      advanceAmount: numericAmount,
      remark: reason || 'Staff Advance'
    }).save();
    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/staff-salary-payments', async (req, res) => {
  try {
    const filter = req.query.month ? { month: req.query.month } : {};
    const payments = await StaffSalaryPayment.find(filter).sort({ date: -1, createdAt: -1 });
    res.json(payments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/staff/:id/salary-payment', async (req, res) => {
  try {
    const { month, date, amount, remark } = req.body;
    const numericAmount = Number(amount || 0);
    if (!month || !date || numericAmount <= 0) {
      return res.status(400).json({ error: 'month, date and positive amount are required' });
    }
    const payment = await new StaffSalaryPayment({
      staffId: req.params.id, month, date, amount: numericAmount, remark: remark || ''
    }).save();
    res.status(201).json(payment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

}

module.exports = registerRoutes;
