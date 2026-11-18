const mongoose = require('mongoose');

const partyPaymentSchema = new mongoose.Schema({
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true
  },

  partyName: { type: String, default: '' },
  // Permanent receipt identifier, generated when the payment is saved.
  receiptNo: { type: String, unique: true, sparse: true, index: true },
  allocationType: { type: String, enum: ['General', 'Bill'], default: 'General' },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill', default: null },
  billNo: { type: String, default: '' },

  paymentDate: {
    type: String,
    required: true
  },

  amount: {
    type: Number,
    default: 0
  },

  paymentMode: {
    type: String,
    enum: ['Cash', 'Online'],
    default: 'Cash'
  },

  reference: {
    type: String,
    default: ''
  },

  remark: {
    type: String,
    default: ''
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PartyPayment', partyPaymentSchema);