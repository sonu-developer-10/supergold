const mongoose = require('mongoose');
const partySchemeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  schemeType: { type: String, enum: ['discount_percent', 'discount_amount', 'target_bonus'], default: 'discount_percent' },
  value: { type: Number, default: 0 },
  targetAmount: { type: Number, default: 0 },
  gift: { type: String, default: '' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  active: { type: Boolean, default: true },
  createdBy: { type: String, default: '' }
}, { timestamps: true });
module.exports = mongoose.models.PartyScheme || mongoose.model('PartyScheme', partySchemeSchema);
