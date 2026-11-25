const mongoose = require('mongoose');
const purchaseOrderSchema = new mongoose.Schema({
  poNo: { type: String, required: true, unique: true, index: true },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  supplierName: { type: String, default: '' },
  orderDate: { type: Date, default: Date.now },
  expectedDate: { type: Date, default: null },
  items: [{ articleCode: String, brand: String, color: String, sizeRange: String, mrp: { type: Number, default: 0 }, purchaseRate: { type: Number, default: 0 }, sellingPrice: { type: Number, default: 0 }, pairsPerCarton: { type: Number, default: 12 }, orderedQty: { type: Number, default: 0 }, receivedQty: { type: Number, default: 0 }, remarks: String }],
  subtotal: { type: Number, default: 0 }, discount: { type: Number, default: 0 }, freight: { type: Number, default: 0 }, grandTotal: { type: Number, default: 0 },
  status: { type: String, enum: ['Draft', 'Ordered', 'Partially Received', 'Received', 'Cancelled'], default: 'Draft' },
  notes: { type: String, default: '' }, createdAt: { type: Date, default: Date.now }, updatedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
