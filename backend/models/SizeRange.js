const mongoose = require('mongoose');
// Shared size-range master list (same on every device/login).
const sizeRangeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('SizeRange', sizeRangeSchema);
