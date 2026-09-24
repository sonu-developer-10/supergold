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
  mrp: { type: Number, default: 0 },
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
  cartons: { type: Number, default: 0 },
  pairsPerCarton: { type: Number, default: 12 },
  loosePairs: { type: Number, default: 0 },
  totalPairs: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});
const Stock = mongoose.model('Stock', stockSchema);

// 4. Wholesale Bill Schema
const billSchema = new mongoose.Schema({
  billNo: { type: Number, required: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  partyName: String,
  deliveryMode: String,
  items: Array,
  rawTotal: { type: Number, default: 0 },
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
  monthlySalary: { type: Number, default: 0 },
  joiningDate: { type: Date, default: Date.now }
});
const Staff = mongoose.model('Staff', staffSchema);

// 6. Staff Attendance & Advance Record Schema
const staffRecordSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Half-Day'], default: 'Present' },
  advanceAmount: { type: Number, default: 0 },
  remark: String
});
const StaffRecord = mongoose.model('StaffRecord', staffRecordSchema);

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

// --- ARTICLES ROUTES ---
app.get('/api/articles', async (req, res) => {
  try {
    const articles = await Article.find().sort({ articleCode: 1 });
    res.json(articles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/articles', async (req, res) => {
  try {
    const article = new Article(req.body);
    const saved = await article.save();
    res.status(201).json(saved);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/articles/:id', async (req, res) => {
  try {
    const updated = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    await Article.findByIdAndDelete(req.params.id);
    res.json({ message: 'Article deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STOCK ROUTES ---
app.get('/api/stock', async (req, res) => {
  try {
    const stocks = await Stock.find();
    res.json(stocks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/stock/inward', async (req, res) => {
  try {
    const { articleCode, brand, color, cartons, pairsPerCarton, loosePairs, mrp, purchaseRate } = req.body;
    const totalPairs = (parseInt(cartons || 0) * parseInt(pairsPerCarton || 12)) + parseInt(loosePairs || 0);

    let stockItem = await Stock.findOne({ articleCode });
    if (stockItem) {
      stockItem.cartons += parseInt(cartons || 0);
      stockItem.loosePairs += parseInt(loosePairs || 0);
      stockItem.totalPairs += totalPairs;
      stockItem.lastUpdated = Date.now();
      await stockItem.save();
    } else {
      stockItem = new Stock({
        articleCode, brand, color,
        cartons: parseInt(cartons || 0),
        pairsPerCarton: parseInt(pairsPerCarton || 12),
        loosePairs: parseInt(loosePairs || 0),
        totalPairs,
        mrp: parseFloat(mrp || 0),
        purchaseRate: parseFloat(purchaseRate || 0)
      });
      await stockItem.save();
    }
    res.status(200).json(stockItem);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/stock/:id', async (req, res) => {
  try {
    const { cartons, pairsPerCarton, loosePairs } = req.body;
    const totalPairs = (parseInt(cartons || 0) * parseInt(pairsPerCarton || 12)) + parseInt(loosePairs || 0);
    const updated = await Stock.findByIdAndUpdate(req.params.id, { ...req.body, totalPairs }, { new: true });
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

    const newBill = new Bill({
      billNo,
      ...req.body
    });

    const savedBill = await newBill.save();

    // Update Party Current Ledger Due Balance
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

// --- STAFF ROUTES ---
app.get('/api/staff', async (req, res) => {
  try {
    const staff = await Staff.find().sort({ joiningDate: -1 });
    res.json(staff);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/staff', async (req, res) => {
  try {
    const newStaff = new Staff(req.body);
    const saved = await newStaff.save();
    res.status(201).json(saved);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const updated = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    await StaffRecord.deleteMany({ staffId: req.params.id });
    res.json({ message: 'Staff deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STAFF RECORDS ROUTES ---
app.get('/api/staff/records/:staffId', async (req, res) => {
  try {
    const records = await StaffRecord.find({ staffId: req.params.staffId }).sort({ date: -1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/staff/records', async (req, res) => {
  try {
    const record = new StaffRecord(req.body);
    const saved = await record.save();
    res.status(201).json(saved);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/staff/records/:id', async (req, res) => {
  try {
    const updated = await StaffRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/staff/records/:id', async (req, res) => {
  try {
    await StaffRecord.findByIdAndDelete(req.params.id);
    res.json({ message: 'Record deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));