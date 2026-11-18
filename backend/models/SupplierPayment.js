const mongoose = require('mongoose');
const supplierPaymentSchema = new mongoose.Schema({
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true }, supplierName: { type: String, default: '' }, receiptNo: { type: String, unique: true, sparse: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseInvoice', default: null }, invoiceNo: { type: String, default: '' }, paymentDate: { type: Date, default: Date.now }, amount: { type: Number, required: true, min: 0.01 }, paymentMode: { type: String, enum: ['Cash', 'Online', 'Bank', 'Cheque'], default: 'Cash' }, reference: { type: String, default: '' }, remarks: { type: String, default: '' }, createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);
