const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  date: { type: String, required: true },
  category: { type: String, default: 'General' },
  amount: { type: Number, default: 0 },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Expense = mongoose.model('Expense', expenseSchema);


module.exports = Expense;
