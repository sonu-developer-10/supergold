const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  articleCode: { type: String, required: true, unique: true },
  brand: { type: String, default: '' },
  color: { type: String, default: '' },
  defaultSize: { type: String, default: '6*9 (Gents)' },
  mrp: { type: Number, default: 0 },
  wholesaleRate: { type: Number, default: 0 },
  pairsInPeti: { type: Number, default: 12 }
}, { timestamps: true });

module.exports = mongoose.model('Article', articleSchema);