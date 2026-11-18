const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  billNo: { type: Number, required: true },
  idempotencyKey: { type: String, default: undefined },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true },
  partyName: String,
  deliveryMode: String,
  items: Array,          // Beche gaye items
  stockWarnings: { type: [mongoose.Schema.Types.Mixed], default: [] },
  returnItems: Array,    // Return kiye huye items
  rawTotal: { type: Number, default: 0 },
  returnTotal: { type: Number, default: 0 },
  discountVal: { type: Number, default: 0 },
  manualDiscountVal: { type: Number, default: 0 },
  schemeDiscountVal: { type: Number, default: 0 },
  appliedScheme: { type: mongoose.Schema.Types.Mixed, default: null },
  todayTotal: { type: Number, default: 0 },
  previousBalance: { type: Number, default: 0 },
  advancePaid: { type: Number, default: 0 },
  cashPaid: { type: Number, default: 0 },
  onlinePaid: { type: Number, default: 0 },
  allocatedPartyCashPaid: { type: Number, default: 0 },
  allocatedPartyOnlinePaid: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  dueBalance: { type: Number, default: 0 },
  billDate: { type: Date, default: Date.now },
  deliveryDate: { type: Date, default: null },
  deliveryStatus: { type: String, enum: ['Pending', 'Delivered'], default: 'Pending' },
  createdBy: { type: String, default: '' },
  createdByRole: { type: String, default: '' }
});
billSchema.index({ billNo: 1 }, { unique: true });
billSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const Bill = mongoose.model('Bill', billSchema);


module.exports = Bill;
