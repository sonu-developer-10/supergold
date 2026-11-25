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
  reorderLevel: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});
// Index changes are applied by the explicit migration script after duplicate checks.
stockSchema.set('autoIndex', false);
// One inventory row per Article Code + Size Range + MRP.
stockSchema.index({ articleCode: 1, sizeRange: 1, mrp: 1 }, { unique: true, name: 'stock_variant_article_size_mrp_unique' });

const Stock = mongoose.model('Stock', stockSchema);


module.exports = Stock;
