const mongoose = require('mongoose');
const staffSalaryRevisionSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true, index: true },
  monthlySalary: { type: Number, required: true, min: 0 },
  effectiveDate: { type: String, required: true, index: true },
  note: { type: String, default: '' },
  createdBy: { type: String, default: '' }
}, { timestamps: true });
staffSalaryRevisionSchema.index({ staffId: 1, effectiveDate: 1 });
module.exports = mongoose.model('StaffSalaryRevision', staffSalaryRevisionSchema);
