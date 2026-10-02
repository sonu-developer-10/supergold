const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  role: { type: String, default: 'Helper' },
  monthlySalary: { type: Number, default: 0 },
  joiningDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
const Staff = mongoose.model('Staff', staffSchema);


module.exports = Staff;
