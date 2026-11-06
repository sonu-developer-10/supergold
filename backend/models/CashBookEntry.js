const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  entryNo: { type: String, trim: true }, date: { type: Date, default: Date.now, index: true },
  direction: { type: String, enum: ['IN','OUT'], required: true },
  account: { type: String, enum: ['Cash','Bank','UPI'], default: 'Cash' }, category: { type: String, default: 'General' },
  amount: { type: Number, required: true }, partyName: { type: String, default: '' }, reference: { type: String, default: '' },
  sourceType: { type: String, default: 'Manual' }, sourceId: { type: String, default: null }, remarks: { type: String, default: '' },
  createdBy: { type: String, default: '' }, createdAt: { type: Date, default: Date.now }
});
schema.index({ entryNo: 1 }, { unique: true, partialFilterExpression: { entryNo: { $type: 'string' } } });
schema.index({ sourceType: 1, sourceId: 1 }, { unique: true, partialFilterExpression: { sourceId: { $type: 'string' } } });
module.exports = mongoose.model('CashBookEntry', schema);
