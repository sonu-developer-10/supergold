const Staff = require('../models/Staff.js');
const StaffRecord = require('../models/StaffRecord.js');
const StaffSalaryPayment = require('../models/StaffSalaryPayment.js');
const StaffLeave = require('../models/StaffLeave.js');
const StaffSalaryRevision = require('../models/StaffSalaryRevision.js');
const AuthUser = require('../models/AuthUser.js');
const { syncCashEntry } = require('../utils-cashbook');

const validDate = value => { const text = String(value || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false; const [y, m, d] = text.split('-').map(Number); const parsed = new Date(Date.UTC(y, m - 1, d)); return parsed.toISOString().slice(0, 10) === text; };
const safeMode = value => ['Cash', 'Online', 'Bank'].includes(value) ? value : 'Cash';

function registerRoutes(app) {
  app.get('/api/staff', async (req, res) => {
    try { res.json(await Staff.find().sort({ active: -1, joiningDate: -1 })); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/staff', async (req, res) => {
    try {
      const openingBalance = Math.max(0, Number(req.body.openingBalance || 0));
      const openingBalanceAsOf = String(req.body.openingBalanceAsOf || '').slice(0, 10);
      if (openingBalance > 0 && !validDate(openingBalanceAsOf)) return res.status(400).json({ error: 'Opening balance ke liye valid As On date required hai.' });
      let loginUserId = null;
      if (req.user?.role === 'admin' && req.body.loginUserId) {
        const login = await AuthUser.findOne({ _id: req.body.loginUserId, role: 'staff', active: true });
        if (!login) return res.status(400).json({ error: 'Linked login must be an active Staff account.' });
        if (await Staff.exists({ loginUserId: login._id })) return res.status(409).json({ error: 'This staff login is already linked to another profile.' });
        loginUserId = login._id;
      }
      const saved = await new Staff({
        name: req.body.name, phone: req.body.phone || '', role: req.body.role || 'Helper',
        monthlySalary: Number(req.body.monthlySalary || 0), joiningDate: req.body.joiningDate || Date.now(),
        openingBalance, openingBalanceAsOf, loginUserId,
        active: req.body.active !== false
      }).save();
      if (Number(saved.monthlySalary || 0) > 0) await StaffSalaryRevision.create({ staffId: saved._id, monthlySalary: saved.monthlySalary, effectiveDate: new Date(saved.joiningDate).toISOString().slice(0, 10), note: 'Initial salary' });
      res.status(201).json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/staff/:id', async (req, res) => {
    try {
      const existing = await Staff.findById(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Staff not found' });
      const nextSalary = Number(req.body.monthlySalary ?? existing.monthlySalary ?? 0);
      const payload = {
        name: req.body.name ?? existing.name, phone: req.body.phone ?? existing.phone,
        role: req.body.role ?? existing.role, monthlySalary: nextSalary,
        active: req.body.active !== false
      };
      if (req.body.active === false) payload.deactivatedAt = existing.deactivatedAt || new Date();
      else if (req.body.active === true) payload.deactivatedAt = null;
      if (req.body.joiningDate) payload.joiningDate = req.body.joiningDate;
      if (req.body.openingBalance !== undefined) payload.openingBalance = Math.max(0, Number(req.body.openingBalance || 0));
      if (req.body.openingBalanceAsOf !== undefined) payload.openingBalanceAsOf = String(req.body.openingBalanceAsOf || '').slice(0, 10);
      const finalOpeningBalance = Number(payload.openingBalance ?? existing.openingBalance ?? 0);
      const finalOpeningAsOf = String(payload.openingBalanceAsOf ?? existing.openingBalanceAsOf ?? '').slice(0, 10);
      if (finalOpeningBalance > 0 && !validDate(finalOpeningAsOf)) return res.status(400).json({ error: 'Opening balance ke liye valid As On date required hai.' });
      if (req.user?.role === 'admin' && req.body.loginUserId !== undefined) {
        if (req.body.loginUserId) {
          const login = await AuthUser.findOne({ _id: req.body.loginUserId, role: 'staff', active: true });
          if (!login) return res.status(400).json({ error: 'Linked login must be an active Staff account.' });
          const alreadyLinked = await Staff.findOne({ loginUserId: login._id, _id: { $ne: existing._id } }).select('_id');
          if (alreadyLinked) return res.status(409).json({ error: 'This staff login is already linked to another profile.' });
          payload.loginUserId = login._id;
        } else payload.loginUserId = null;
      }
      const salaryChanged = Math.abs(nextSalary - Number(existing.monthlySalary || 0)) > 0.009;
      if (salaryChanged && req.body.salaryEffectiveDate && !validDate(req.body.salaryEffectiveDate)) return res.status(400).json({ error: 'Salary effective date is invalid.' });
      const updated = await Staff.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
      if (salaryChanged) {
        const existingRevisions = await StaffSalaryRevision.find({ staffId: existing._id }).sort({ effectiveDate: 1 });
        if (!existingRevisions.length && Number(existing.monthlySalary || 0) > 0) {
          await StaffSalaryRevision.create({ staffId: existing._id, monthlySalary: Number(existing.monthlySalary), effectiveDate: new Date(existing.joiningDate || existing.createdAt || Date.now()).toISOString().slice(0, 10), note: 'Legacy salary baseline' });
        }
        const effectiveDate = req.body.salaryEffectiveDate || new Date().toISOString().slice(0, 10);
        await StaffSalaryRevision.create({ staffId: existing._id, monthlySalary: nextSalary, effectiveDate, note: 'Salary revised', createdBy: req.user?.username || '' });
      }
      res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Financial history is retained. Deleting a staff member now deactivates the profile.
  app.delete('/api/staff/:id', async (req, res) => {
    try {
      const staff = await Staff.findByIdAndUpdate(req.params.id, { $set: { active: false, deactivatedAt: new Date() } }, { new: true });
      if (!staff) return res.status(404).json({ error: 'Staff not found' });
      res.json({ message: 'Staff deactivated. Financial history preserved.', staff });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/staff-salary-revisions', async (req, res) => {
    try {
      const filter = req.query.staffId ? { staffId: req.query.staffId } : {};
      res.json(await StaffSalaryRevision.find(filter).sort({ effectiveDate: 1, createdAt: 1 }));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/staff-records', async (req, res) => {
    try {
      const filter = {};
      if (req.query.month) filter.date = { $regex: `^${String(req.query.month).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-` };
      const records = await StaffRecord.find(filter).sort({ date: 1, createdAt: 1 });
      res.json(records);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/staff/:id/attendance', async (req, res) => {
    try {
      const { date, status, remark } = req.body;
      if (!validDate(date) || !status) return res.status(400).json({ error: 'Valid date and status are required' });
      const normalizedStatus = status === 'Half Day' ? 'Half-Day' : status;
      if (!['Present', 'Absent', 'Half-Day'].includes(normalizedStatus)) return res.status(400).json({ error: 'Invalid attendance status' });
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
      if (!validDate(date) || numericAmount <= 0) return res.status(400).json({ error: 'Valid date and positive amount are required' });
      const staff = await Staff.findById(req.params.id);
      if (!staff) return res.status(404).json({ error: 'Staff not found' });
      const paymentMode = safeMode(req.body.paymentMode);
      const record = await new StaffRecord({ staffId: req.params.id, date, status: 'Present', advanceAmount: numericAmount, paymentMode, remark: reason || 'Staff Advance' }).save();
      await syncCashEntry({ sourceType: 'StaffAdvance', sourceId: record._id, date, direction: 'OUT', account: paymentMode, category: 'Staff Advance', amount: numericAmount, partyName: staff.name, reference: 'Staff Advance', remarks: reason || 'Staff Advance', createdBy: req.user?.username || '' });
      res.status(201).json(record);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/staff-records/:id', async (req, res) => {
    try {
      const existing = await StaffRecord.findById(req.params.id);
      if (!existing || Number(existing.advanceAmount || 0) <= 0) return res.status(404).json({ error: 'Staff advance record not found' });
      const amount = Number(req.body.amount ?? req.body.advanceAmount ?? 0);
      if (!validDate(req.body.date) || amount <= 0) return res.status(400).json({ error: 'Valid date and positive amount are required' });
      const paymentMode = safeMode(req.body.paymentMode || existing.paymentMode);
      Object.assign(existing, { date: req.body.date, advanceAmount: amount, paymentMode, remark: req.body.reason || req.body.remark || 'Staff Advance', status: 'Present' });
      await existing.save();
      const staff = await Staff.findById(existing.staffId);
      await syncCashEntry({ sourceType: 'StaffAdvance', sourceId: existing._id, date: existing.date, direction: 'OUT', account: paymentMode, category: 'Staff Advance', amount, partyName: staff?.name || '', reference: 'Staff Advance', remarks: existing.remark, createdBy: req.user?.username || '' });
      res.json(existing);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/staff-records/:id', async (req, res) => {
    try {
      const deleted = await StaffRecord.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Staff record not found' });
      if (Number(deleted.advanceAmount || 0) > 0) await syncCashEntry({ sourceType: 'StaffAdvance', sourceId: deleted._id, amount: 0 });
      res.json({ message: 'Staff record deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/staff-salary-payments', async (req, res) => {
    try {
      const filter = req.query.month ? { month: req.query.month } : {};
      res.json(await StaffSalaryPayment.find(filter).sort({ date: -1, createdAt: -1 }));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/staff/:id/salary-payment', async (req, res) => {
    try {
      const { month, date, amount, remark } = req.body;
      const numericAmount = Number(amount || 0);
      if (!/^\d{4}-\d{2}$/.test(String(month || '')) || !validDate(date) || numericAmount <= 0) return res.status(400).json({ error: 'Valid month, date and positive amount are required' });
      const staff = await Staff.findById(req.params.id);
      if (!staff) return res.status(404).json({ error: 'Staff not found' });
      const paymentMode = safeMode(req.body.paymentMode);
      const payment = await StaffSalaryPayment.create({ staffId: req.params.id, month, date, amount: numericAmount, paymentMode, remark: remark || '' });
      await syncCashEntry({ sourceType: 'StaffSalaryPayment', sourceId: payment._id, date, direction: 'OUT', account: paymentMode, category: 'Staff Salary', amount: numericAmount, partyName: staff.name, reference: `Salary ${month}`, remarks: remark || 'Staff salary payment', createdBy: req.user?.username || '' });
      res.status(201).json(payment);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/staff-salary-payments/:id', async (req, res) => {
    try {
      const payment = await StaffSalaryPayment.findById(req.params.id);
      if (!payment) return res.status(404).json({ error: 'Salary payment not found' });
      const amount = Number(req.body.amount || 0);
      if (!/^\d{4}-\d{2}$/.test(String(req.body.month || '')) || !validDate(req.body.date) || amount <= 0) return res.status(400).json({ error: 'Valid month, date and positive amount are required' });
      Object.assign(payment, { month: req.body.month, date: req.body.date, amount, paymentMode: safeMode(req.body.paymentMode || payment.paymentMode), remark: req.body.remark || '' });
      await payment.save();
      const staff = await Staff.findById(payment.staffId);
      await syncCashEntry({ sourceType: 'StaffSalaryPayment', sourceId: payment._id, date: payment.date, direction: 'OUT', account: payment.paymentMode, category: 'Staff Salary', amount, partyName: staff?.name || '', reference: `Salary ${payment.month}`, remarks: payment.remark || 'Staff salary payment', createdBy: req.user?.username || '' });
      res.json(payment);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/staff-salary-payments/:id', async (req, res) => {
    try {
      const deleted = await StaffSalaryPayment.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Salary payment not found' });
      await syncCashEntry({ sourceType: 'StaffSalaryPayment', sourceId: deleted._id, amount: 0 });
      res.json({ message: 'Salary payment deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Admin/Special Staff see the leave queue. A linked staff login sees only its own requests.
  app.get('/api/staff-leaves', async (req, res) => {
    try {
      const filter = {};
      if (req.user?.role === 'staff') {
        const linked = await Staff.findOne({ loginUserId: req.user.id }).select('_id');
        if (!linked) return res.status(403).json({ error: 'Your staff profile is not linked. Please contact Admin.' });
        filter.staffId = linked._id;
      } else {
        if (req.query.staffId) filter.staffId = req.query.staffId;
        if (req.query.month) {
          const month = String(req.query.month);
          if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'Invalid month.' });
          const [year, mm] = month.split('-').map(Number);
          const nextMonth = new Date(Date.UTC(year, mm, 1)).toISOString().slice(0, 10);
          filter.startDate = { $lt: nextMonth };
          filter.endDate = { $gte: `${month}-01` };
        }
      }
      res.json(await StaffLeave.find(filter).sort({ createdAt: -1 }));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/staff-leaves', async (req, res) => {
    try {
      const role = req.user?.role;
      const isSelfRequest = role === 'staff';
      const { startDate, endDate, reason } = req.body;
      if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return res.status(400).json({ error: 'Valid leave dates are required.' });
      let staffId = req.body.staffId;
      let entryMode = req.body.entryMode === 'Direct' ? 'Direct' : 'Request';
      if (isSelfRequest) {
        const linked = await Staff.findOne({ loginUserId: req.user.id, active: { $ne: false } });
        if (!linked) return res.status(403).json({ error: 'Your staff profile is not linked. Please contact Admin.' });
        staffId = linked._id;
        entryMode = 'Request';
      }
      if (!['admin', 'special_staff', 'staff'].includes(role)) return res.status(403).json({ error: 'Not allowed.' });
      if (entryMode === 'Direct' && role !== 'admin') return res.status(403).json({ error: 'Only Admin can directly mark leave.' });
      const staff = await Staff.findById(staffId);
      if (!staff) return res.status(404).json({ error: 'Staff not found.' });
      if (staff.active === false) return res.status(400).json({ error: 'Inactive staff ke liye nayi leave mark/request nahi ho sakti.' });
      const overlap = await StaffLeave.findOne({ staffId, status: { $in: ['Pending', 'Approved'] }, startDate: { $lte: endDate }, endDate: { $gte: startDate } });
      if (overlap) return res.status(409).json({ error: 'Is date range mein pehle se pending/approved leave maujood hai.' });
      const leave = await StaffLeave.create({
        staffId, startDate, endDate, reason: reason || '',
        status: entryMode === 'Direct' ? 'Approved' : 'Pending', entryMode,
        createdByUserId: req.user?.id || null, createdByUsername: req.user?.username || '',
        reviewedBy: entryMode === 'Direct' ? (req.user?.username || 'Admin') : '',
        reviewedAt: entryMode === 'Direct' ? new Date() : null
      });
      res.status(201).json(leave);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.patch('/api/staff-leaves/:id/status', async (req, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
      const { status } = req.body;
      if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Status must be Approved or Rejected.' });
      const leave = await StaffLeave.findByIdAndUpdate(req.params.id, { $set: { status, reviewedBy: req.user.username || 'Admin', reviewedAt: new Date() } }, { new: true, runValidators: true });
      if (!leave) return res.status(404).json({ error: 'Leave request not found.' });
      res.json(leave);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

module.exports = registerRoutes;
