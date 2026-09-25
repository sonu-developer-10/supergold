const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wholesale_erp';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// ==================== SCHEMAS & MODELS ====================

// 1. Party Schema
const partySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  city: String,
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Party = mongoose.model('Party', partySchema);

// 2. Master Article Schema
const articleSchema = new mongoose.Schema({
  articleCode: { type: String, required: true, unique: true },
  brand: String,
  color: { type: String, default: '' },
  sizeRange: { type: String, default: '6*9 (Gents)' },
  mrp: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 },
  wholesaleRate: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  pairsInPeti: { type: Number, default: 12 },
  createdAt: { type: Date, default: Date.now }
});
const Article = mongoose.model('Article', articleSchema);

// 3. Stock Inventory Schema
const stockSchema = new mongoose.Schema({
  articleCode: String,
  brand: String,
  color: String,
  sizeRange: { type: String, default: '6*9 (Gents)' },
  cartons: { type: Number, default: 0 },
  pairsPerCarton: { type: Number, default: 12 },
  loosePairs: { type: Number, default: 0 },
  totalPairs: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});
const Stock = mongoose.model('Stock', stockSchema);

// 4. Wholesale Bill Schema
const billSchema = new mongoose.Schema({
  billNo: { type: Number, required: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  partyName: String,
  deliveryMode: String,
  items: Array,          // Beche gaye items
  returnItems: Array,    // Return kiye huye items
  rawTotal: { type: Number, default: 0 },
  returnTotal: { type: Number, default: 0 },
  discountVal: { type: Number, default: 0 },
  todayTotal: { type: Number, default: 0 },
  previousBalance: { type: Number, default: 0 },
  advancePaid: { type: Number, default: 0 },
  cashPaid: { type: Number, default: 0 },
  onlinePaid: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  dueBalance: { type: Number, default: 0 },
  billDate: { type: Date, default: Date.now }
});
const Bill = mongoose.model('Bill', billSchema);

// 5. Staff Profile Schema
const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  role: { type: String, default: 'Helper' },
  monthlySalary: { type: Number, default: 0 },
  joiningDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Staff = mongoose.model('Staff', staffSchema);

// 6. Staff Attendance Record Schema
const staffRecordSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Half-Day', 'Half Day'], default: 'Present' },
  advanceAmount: { type: Number, default: 0 },
  remark: String,
  createdAt: { type: Date, default: Date.now }
});
const StaffRecord = mongoose.model('StaffRecord', staffRecordSchema);

// 7. Staff Salary Payment Schema
const staffSalaryPaymentSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  month: { type: String, required: true },
  date: { type: String, required: true },
  amount: { type: Number, default: 0 },
  remark: String,
  createdAt: { type: Date, default: Date.now }
});
const StaffSalaryPayment = mongoose.model('StaffSalaryPayment', staffSalaryPaymentSchema);

// 8. General Business Expense Schema
const expenseSchema = new mongoose.Schema({
  date: { type: String, required: true },
  category: { type: String, default: 'General' },
  amount: { type: Number, default: 0 },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Expense = mongoose.model('Expense', expenseSchema);

// ==================== API ROUTES ====================

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

// --- ARTICLES ROUTES (WITH AUTOMATIC STOCK SYNCHRONIZATION) ---
app.get('/api/articles', async (req, res) => {
  try {
    const articles = await Article.find().sort({ articleCode: 1 });
    res.json(articles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/articles', async (req, res) => {
  try {
    const { articleCode, brand, color, sizeRange, mrp, purchaseRate, wholesaleRate, sellingPrice, pairsInPeti, cartons, loosePairs } = req.body;
    
    const article = new Article({
      articleCode,
      brand,
      color,
      sizeRange,
      mrp: parseFloat(mrp || 0),
      purchaseRate: parseFloat(purchaseRate || 0),
      wholesaleRate: parseFloat(wholesaleRate || sellingPrice || 0),
      sellingPrice: parseFloat(sellingPrice || wholesaleRate || 0),
      pairsInPeti: parseInt(pairsInPeti || 12)
    });
    const savedArticle = await article.save();

    // Auto-Sync to Stock Collection
    const c = parseInt(cartons || 0);
    const l = parseInt(loosePairs || 0);
    const ppt = parseInt(pairsInPeti || 12);
    const totalPairs = (c * ppt) + l;

    let stockItem = await Stock.findOne({ articleCode });
    if (stockItem) {
      stockItem.brand = brand || stockItem.brand;
      stockItem.color = color || stockItem.color;
      stockItem.sizeRange = sizeRange || stockItem.sizeRange;
      stockItem.mrp = parseFloat(mrp || stockItem.mrp);
      stockItem.purchaseRate = parseFloat(purchaseRate || stockItem.purchaseRate);
      stockItem.sellingPrice = parseFloat(sellingPrice || wholesaleRate || stockItem.sellingPrice);
      stockItem.cartons += c;
      stockItem.loosePairs += l;
      stockItem.totalPairs += totalPairs;
      stockItem.lastUpdated = Date.now();
      await stockItem.save();
    } else {
      await Stock.create({
        articleCode,
        brand,
        color,
        sizeRange,
        cartons: c,
        pairsPerCarton: ppt,
        loosePairs: l,
        totalPairs,
        mrp: parseFloat(mrp || 0),
        purchaseRate: parseFloat(purchaseRate || 0),
        sellingPrice: parseFloat(sellingPrice || wholesaleRate || 0)
      });
    }

    res.status(201).json(savedArticle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/articles/:id', async (req, res) => {
  try {
    const { articleCode, brand, color, sizeRange, mrp, purchaseRate, wholesaleRate, sellingPrice, pairsInPeti, cartons, loosePairs } = req.body;
    
    const updatedArticle = await Article.findByIdAndUpdate(req.params.id, {
      brand, color, sizeRange,
      mrp: parseFloat(mrp || 0),
      purchaseRate: parseFloat(purchaseRate || 0),
      wholesaleRate: parseFloat(wholesaleRate || sellingPrice || 0),
      sellingPrice: parseFloat(sellingPrice || wholesaleRate || 0),
      pairsInPeti: parseInt(pairsInPeti || 12)
    }, { new: true });

    // Sync Update to Stock Record
    const stockItem = await Stock.findOne({ articleCode: updatedArticle.articleCode });
    if (stockItem) {
      stockItem.brand = brand;
      stockItem.color = color;
      stockItem.sizeRange = sizeRange;
      stockItem.mrp = parseFloat(mrp || 0);
      stockItem.purchaseRate = parseFloat(purchaseRate || 0);
      stockItem.sellingPrice = parseFloat(sellingPrice || wholesaleRate || 0);
      if (cartons !== undefined) stockItem.cartons = parseInt(cartons || 0);
      if (loosePairs !== undefined) stockItem.loosePairs = parseInt(loosePairs || 0);
      stockItem.totalPairs = (stockItem.cartons * stockItem.pairsPerCarton) + stockItem.loosePairs;
      stockItem.lastUpdated = Date.now();
      await stockItem.save();
    }

    res.json(updatedArticle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (article) {
      await Stock.deleteOne({ articleCode: article.articleCode });
      await Article.findByIdAndDelete(req.params.id);
    }
    res.json({ message: 'Article and synced stock deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STOCK ROUTES ---
app.get('/api/stock', async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ articleCode: 1 });
    res.json(stocks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/stock/inward', async (req, res) => {
  try {
    const { articleCode, brand, color, sizeRange, cartons, pairsPerCarton, loosePairs, mrp, purchaseRate, sellingPrice } = req.body;
    const c = parseInt(cartons || 0);
    const l = parseInt(loosePairs || 0);
    const ppt = parseInt(pairsPerCarton || 12);
    const totalPairs = (c * ppt) + l;

    let stockItem = await Stock.findOne({ articleCode });
    if (stockItem) {
      stockItem.brand = brand || stockItem.brand;
      stockItem.color = color || stockItem.color;
      stockItem.sizeRange = sizeRange || stockItem.sizeRange;
      stockItem.cartons += c;
      stockItem.loosePairs += l;
      stockItem.totalPairs += totalPairs;
      stockItem.mrp = parseFloat(mrp || stockItem.mrp);
      stockItem.purchaseRate = parseFloat(purchaseRate || stockItem.purchaseRate);
      stockItem.sellingPrice = parseFloat(sellingPrice || stockItem.sellingPrice);
      stockItem.lastUpdated = Date.now();
      await stockItem.save();
    } else {
      stockItem = new Stock({
        articleCode, brand, color, sizeRange,
        cartons: c,
        pairsPerCarton: ppt,
        loosePairs: l,
        totalPairs,
        mrp: parseFloat(mrp || 0),
        purchaseRate: parseFloat(purchaseRate || 0),
        sellingPrice: parseFloat(sellingPrice || 0)
      });
      await stockItem.save();
    }

    // Sync purchaseRate / sellingPrice back to Article
    await Article.findOneAndUpdate({ articleCode }, {
      brand: brand || undefined,
      color: color || undefined,
      sizeRange: sizeRange || undefined,
      mrp: parseFloat(mrp || 0),
      purchaseRate: parseFloat(purchaseRate || 0),
      sellingPrice: parseFloat(sellingPrice || 0),
      wholesaleRate: parseFloat(sellingPrice || 0)
    });

    res.status(200).json(stockItem);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/stock/:id', async (req, res) => {
  try {
    const { cartons, pairsPerCarton, loosePairs, purchaseRate, sellingPrice, mrp } = req.body;
    
    const currentStock = await Stock.findById(req.params.id);
    if (!currentStock) return res.status(404).json({ error: 'Stock item not found' });

    const c = cartons !== undefined ? parseInt(cartons) : currentStock.cartons;
    const l = loosePairs !== undefined ? parseInt(loosePairs) : currentStock.loosePairs;
    const ppt = pairsPerCarton !== undefined ? parseInt(pairsPerCarton) : currentStock.pairsPerCarton;
    const totalPairs = (c * ppt) + l;

    const updated = await Stock.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, cartons: c, loosePairs: l, pairsPerCarton: ppt, totalPairs, lastUpdated: Date.now() }, 
      { new: true }
    );

    // Sync updated price back to Article
    if (updated && updated.articleCode) {
      await Article.findOneAndUpdate({ articleCode: updated.articleCode }, {
        purchaseRate: updated.purchaseRate,
        sellingPrice: updated.sellingPrice,
        wholesaleRate: updated.sellingPrice,
        mrp: updated.mrp
      });
    }

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/stock/:id', async (req, res) => {
  try {
    await Stock.findByIdAndDelete(req.params.id);
    res.json({ message: 'Stock deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- BILLS ROUTES ---
app.get('/api/bills', async (req, res) => {
  try {
    const bills = await Bill.find().sort({ billDate: -1 });
    res.json(bills);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bills/:id', async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json(bill);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/bills', async (req, res) => {
  try {
    const lastBill = await Bill.findOne().sort({ billNo: -1 });
    const billNo = lastBill ? lastBill.billNo + 1 : 1001;

    const newBill = new Bill({ billNo, ...req.body });
    const savedBill = await newBill.save();

    // 1. Stock Adjustment for New Sold Items (Deduct Stock if article exists in Stock)
    if (req.body.items && Array.isArray(req.body.items)) {
      for (let item of req.body.items) {
        if (item.articleCode && item.totalPairs > 0) {
          const st = await Stock.findOne({ articleCode: item.articleCode });
          if (st) {
            st.totalPairs = Math.max(0, st.totalPairs - item.totalPairs);
            st.cartons = Math.floor(st.totalPairs / (st.pairsPerCarton || 12));
            st.loosePairs = st.totalPairs % (st.pairsPerCarton || 12);
            await st.save();
          }
        }
      }
    }

    // 2. Stock Adjustment for Return Items (Add Back Stock if article exists in Stock)
    if (req.body.returnItems && Array.isArray(req.body.returnItems)) {
      for (let rItem of req.body.returnItems) {
        if (rItem.articleCode && rItem.totalPairs > 0) {
          const st = await Stock.findOne({ articleCode: rItem.articleCode });
          if (st) {
            st.totalPairs += rItem.totalPairs;
            st.cartons = Math.floor(st.totalPairs / (st.pairsPerCarton || 12));
            st.loosePairs = st.totalPairs % (st.pairsPerCarton || 12);
            await st.save();
          }
        }
      }
    }

    // 3. Update Party Ledger Dues
    if (req.body.partyId) {
      await Party.findByIdAndUpdate(req.body.partyId, {
        currentBalance: req.body.dueBalance
      });
    }

    res.status(201).json(savedBill);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/bills/:id', async (req, res) => {
  try {
    const updated = await Bill.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    await Bill.findByIdAndDelete(req.params.id);
    res.json({ message: 'Bill deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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

// SERVER LISTEN
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Super Gold ERP Server running on port ${PORT}`));