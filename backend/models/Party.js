const mongoose = require('mongoose');

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


module.exports = Party;
