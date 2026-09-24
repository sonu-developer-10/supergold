const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  articleCode: { type: String, required: true },
  brand: { type: String, default: '' },
  sizeRange: { type: String, default: '' },
  color: { type: String, default: '' },
  cartons: { type: Number, default: 0 },
  loosePairs: { type: Number, default: 0 },
  pairsPerPeti: { type: Number, default: 12 },
  totalPairs: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Stock', stockSchema);