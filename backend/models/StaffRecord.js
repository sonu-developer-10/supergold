const mongoose = require('mongoose');

const staffRecordSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true },
  status: { type: String, enum: ['Present', 'Absent', 'Half-Day', 'Half Day'], default: 'Present' },
  advanceAmount: { type: Number, default: 0 },
  paymentMode: { type: String, enum: ['Cash', 'Online', 'Bank', 'Other'], default: 'Cash' },
  // Only used when paymentMode === 'Other' (custom mode typed by the owner).
  paymentModeLabel: { type: String, default: '' },
  // Which Cash Book account an 'Other' advance affects. 'None' = no Cash Book entry.
  cashbookAccount: { type: String, enum: ['', 'Cash', 'UPI', 'Bank', 'None'], default: '' },
  remark: String,
  createdAt: { type: Date, default: Date.now }
});
const StaffRecord = mongoose.model('StaffRecord', staffRecordSchema);


module.exports = StaffRecord;
