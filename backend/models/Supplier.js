const mongoose = require('mongoose');
const supplierSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '' },
  city: { type: String, default: '' },
  address: { type: String, default: '' },
  gstin: { type: String, default: '' },
  linkedPartyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
  openingBalance: { type: Number, default: 0 },
  openingBalanceDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
supplierSchema.index({ linkedPartyId: 1 }, { unique: true, partialFilterExpression: { linkedPartyId: { $type: 'objectId' } } });
supplierSchema.index({ name: 1 });
module.exports = mongoose.model('Supplier', supplierSchema);
