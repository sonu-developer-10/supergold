const mongoose = require('mongoose');
const purchaseInvoiceSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true, index: true }, supplierInvoiceNo: { type: String, default: '' },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true }, supplierName: { type: String, default: '' },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null }, goodsReceiptIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GoodsReceipt' }],
  invoiceDate: { type: Date, default: Date.now }, dueDate: { type: Date, default: null }, items: [{ articleCode: String, brand: String, color: String, sizeRange: String, qty: Number, rate: Number, amount: Number }],
  subtotal: { type: Number, default: 0 }, discount: { type: Number, default: 0 }, tax: { type: Number, default: 0 }, freight: { type: Number, default: 0 }, grandTotal: { type: Number, default: 0 }, paidAmount: { type: Number, default: 0 }, dueAmount: { type: Number, default: 0 }, notes: { type: String, default: '' }, createdAt: { type: Date, default: Date.now }
});
purchaseInvoiceSchema.index({ goodsReceiptIds: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
