const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  date: { type: String, required: true, unique: true, index: true },
  openingCash: { type: Number, default: 0 }, cashIn: { type: Number, default: 0 }, cashOut: { type: Number, default: 0 },
  expectedClosing: { type: Number, default: 0 }, actualClosing: { type: Number, default: 0 }, difference: { type: Number, default: 0 },
  notes: { type: String, default: '' }, closedBy: { type: String, default: '' }, closedAt: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.models.DailyCashClosing || mongoose.model('DailyCashClosing', schema);
