const mongoose = require('mongoose');

// 1. Party Schema
const partySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  city: String,
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  // Optional per-party pricing rules. fixedRate wins over discountPercent.
  priceRules: [{ articleCode: { type: String, default: '*' }, sizeRange: { type: String, default: '*' }, fixedRate: { type: Number, default: null }, discountPercent: { type: Number, default: null }, active: { type: Boolean, default: true }, updatedAt: { type: Date, default: Date.now } }],
  createdAt: { type: Date, default: Date.now }
});
const Party = mongoose.model('Party', partySchema);


module.exports = Party;
