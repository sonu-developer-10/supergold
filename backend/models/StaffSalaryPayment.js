const mongoose = require('mongoose');

const staffSalaryPaymentSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  month: { type: String, required: true },
  date: { type: String, required: true },
  amount: { type: Number, default: 0 },
  remark: String,
  createdAt: { type: Date, default: Date.now }
});
const StaffSalaryPayment = mongoose.model('StaffSalaryPayment', staffSalaryPaymentSchema);


module.exports = StaffSalaryPayment;
