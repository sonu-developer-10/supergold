const mongoose = require('mongoose');

const staffLeaveSchema = new mongoose.Schema({
staffId: {
type: mongoose.Schema.Types.ObjectId,
ref: 'Staff',
required: true,
index: true
},
startDate: {
type: String,
required: true
},
endDate: {
type: String,
required: true
},
reason: {
type: String,
trim: true,
default: ''
},
status: {
type: String,
enum: ['Pending', 'Approved', 'Rejected'],
default: 'Pending',
index: true
},
reviewedBy: {
type: String,
default: ''
},
reviewedAt: {
type: Date,
default: null
}
}, { timestamps: true });

module.exports = mongoose.model('StaffLeave', staffLeaveSchema);
