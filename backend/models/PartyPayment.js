const mongoose = require('mongoose');

const partyPaymentSchema = new mongoose.Schema({
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Party',
    required: true
  },

  partyName: {
    type: String,
    default: ''
  },

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