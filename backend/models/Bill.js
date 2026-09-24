const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  billNo: { type: Number, required: true },
  billDate: { type: Date, default: Date.now },
  partyName: { type: String, required: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party' },
  deliveryMode: { type: String, default: 'Self Delivery' },
  vehicleInfo: { type: String, default: '' },
  items: [{
    articleCode: String,
    size: String,
    color: String,
    mrp: Number,
    cartons: Number,
    loosePairs: Number,
    totalPairs: Number,
    rate: Number,
    totalAmount: Number
  }],
  todayTotal: { type: Number, default: 0 },
  previousBalance: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  dueBalance: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Bill', billSchema);