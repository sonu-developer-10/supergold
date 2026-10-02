const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  billNo: { type: Number, required: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  partyName: String,
  deliveryMode: String,
  items: Array,          // Beche gaye items
  returnItems: Array,    // Return kiye huye items
  rawTotal: { type: Number, default: 0 },
  returnTotal: { type: Number, default: 0 },
  discountVal: { type: Number, default: 0 },
  todayTotal: { type: Number, default: 0 },
  previousBalance: { type: Number, default: 0 },
  advancePaid: { type: Number, default: 0 },
  cashPaid: { type: Number, default: 0 },
  onlinePaid: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  dueBalance: { type: Number, default: 0 },
  billDate: { type: Date, default: Date.now }
});
const Bill = mongoose.model('Bill', billSchema);


module.exports = Bill;
