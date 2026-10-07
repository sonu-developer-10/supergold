const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  articleCode: { type: String, required: true },
  brand: String,
  color: { type: String, default: '' },
  sizeRange: { type: String, default: '6*9 (Gents)' },
  mrp: { type: Number, default: 0 },
  purchaseRate: { type: Number, default: 0 },
  wholesaleRate: { type: Number, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  purchaseDiscountPercent: { type: Number, default: 0 },
  sellingDiscountPercent: { type: Number, default: 0 },
  pairsInPeti: { type: Number, default: 12 },
  createdAt: { type: Date, default: Date.now }
});
articleSchema.index({ articleCode: 1, sizeRange: 1, sellingPrice: 1 }, { unique: true });

const Article = mongoose.model('Article', articleSchema);


module.exports = Article;
