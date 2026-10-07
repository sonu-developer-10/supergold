const mongoose = require('mongoose');

const staffRecordSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Half-Day', 'Half Day'], default: 'Present' },
  advanceAmount: { type: Number, default: 0 },
  remark: String,
  createdAt: { type: Date, default: Date.now }
});
const StaffRecord = mongoose.model('StaffRecord', staffRecordSchema);


module.exports = StaffRecord;
