const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  city: { type: String, default: '' },
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Party', partySchema);