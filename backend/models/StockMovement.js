const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  articleCode: { type: String, index: true }, sizeRange: { type: String, default: '' }, color: { type: String, default: '' },
  movementType: { type: String, enum: ['Purchase Receipt','Sale','Sales Return','Stock Inward','Adjustment'], required: true },
  quantity: { type: Number, required: true }, direction: { type: String, enum: ['IN','OUT'], required: true },
  referenceType: { type: String, default: '' }, referenceId: { type: String, default: '' }, referenceNo: { type: String, default: '' },
  remarks: { type: String, default: '' }, userId: { type: String, default: '' }, username: { type: String, default: '' }, createdAt: { type: Date, default: Date.now, index: true }
});
module.exports = mongoose.model('StockMovement', schema);
