const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  role: { type: String, default: 'Helper' },
  monthlySalary: { type: Number, default: 0 },
  openingBalance: { type: Number, default: 0, min: 0 },
  openingBalanceAsOf: { type: String, default: '' },
  loginUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'AuthUser', default: null, index: true },
  joiningDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  deactivatedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});
const Staff = mongoose.model('Staff', staffSchema);


module.exports = Staff;
