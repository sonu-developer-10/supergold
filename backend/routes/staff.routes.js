const Staff = require('../models/Staff.js');
const StaffRecord = require('../models/StaffRecord.js');
const StaffSalaryPayment = require('../models/StaffSalaryPayment.js');
const StaffLeave = require('../models/StaffLeave.js');


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

app.put('/api/staff-records/:id', async (req, res) => {
  try {
    const amount = Number(req.body.amount ?? req.body.advanceAmount ?? 0);
    if (!req.body.date || amount <= 0) return res.status(400).json({ error: 'date and positive amount are required' });
    const updated = await StaffRecord.findByIdAndUpdate(
      req.params.id,
      { date: req.body.date, advanceAmount: amount, remark: req.body.reason || req.body.remark || 'Staff Advance', status: 'Present' },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Staff record not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/staff-records/:id', async (req, res) => {
  try {
    const deleted = await StaffRecord.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Staff record not found' });
    res.json({ message: 'Staff record deleted' });
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

app.put('/api/staff-salary-payments/:id', async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (!req.body.month || !req.body.date || amount <= 0) return res.status(400).json({ error: 'month, date and positive amount are required' });
    const updated = await StaffSalaryPayment.findByIdAndUpdate(
      req.params.id,
      { month: req.body.month, date: req.body.date, amount, remark: req.body.remark || '' },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Salary payment not found' });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/staff-salary-payments/:id', async (req, res) => {
  try {
    const deleted = await StaffSalaryPayment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Salary payment not found' });
    res.json({ message: 'Salary payment deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// --- STAFF LEAVE MANAGEMENT ROUTES ---

// Leave list: authenticated Admin only
app.get('/api/staff-leaves', async (req, res) => {
try {
if (req.user?.role !== 'admin') {
return res.status(403).json({ error: 'Admin access required.' });
}

const filter = {};
if (req.query.staffId) filter.staffId = req.query.staffId;

if (req.query.month) {
  const month = String(req.query.month);
  const monthStart = `${month}-01`;
  const nextMonthDate = new Date(`${month}-01T00:00:00`);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(
    nextMonthDate.getMonth() + 1
  ).padStart(2, '0')}-01`;

  filter.startDate = { $lt: nextMonth };
  filter.endDate = { $gte: monthStart };
}

const leaves = await StaffLeave.find(filter)
  .sort({ createdAt: -1 });

res.json(leaves);


} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Create leave request
app.post('/api/staff-leaves', async (req, res) => {
try {
if (req.user?.role !== 'admin') {
return res.status(403).json({ error: 'Admin access required.' });
}


const { staffId, startDate, endDate, reason } = req.body;

if (!staffId || !startDate || !endDate) {
  return res.status(400).json({
    error: 'Staff, start date and end date are required.'
  });
}

if (
  !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
  !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
  startDate > endDate
) {
  return res.status(400).json({ error: 'Invalid leave dates.' });
}

const staff = await Staff.findById(staffId);
if (!staff) {
  return res.status(404).json({ error: 'Staff not found.' });
}

const leave = await StaffLeave.create({
  staffId,
  startDate,
  endDate,
  reason: reason || '',
  status: 'Pending'
});

res.status(201).json(leave);


} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Approve or reject leave — Admin only
app.patch('/api/staff-leaves/:id/status', async (req, res) => {
try {
if (req.user?.role !== 'admin') {
return res.status(403).json({ error: 'Admin access required.' });
}


const { status } = req.body;

if (!['Approved', 'Rejected'].includes(status)) {
  return res.status(400).json({
    error: 'Status must be Approved or Rejected.'
  });
}

const leave = await StaffLeave.findByIdAndUpdate(
  req.params.id,
  {
    $set: {
      status,
      reviewedBy: req.user.username || 'Admin',
      reviewedAt: new Date()
    }
  },
  { new: true, runValidators: true }
);

if (!leave) {
  return res.status(404).json({ error: 'Leave request not found.' });
}

res.json(leave);


} catch (err) {
res.status(500).json({ error: err.message });
}
});


}

module.exports = registerRoutes;
