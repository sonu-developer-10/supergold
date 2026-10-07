const mongoose = require('mongoose');

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
stockSchema.index({ articleCode: 1, sizeRange: 1, sellingPrice: 1 }, { unique: true });

const Stock = mongoose.model('Stock', stockSchema);


module.exports = Stock;
