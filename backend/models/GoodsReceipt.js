const mongoose = require('mongoose');
const goodsReceiptSchema = new mongoose.Schema({
  grnNo: { type: String, required: true, unique: true, index: true },
  purchaseOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true, index: true },
  poNo: { type: String, default: '' }, supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true }, supplierName: { type: String, default: '' },
  receivedDate: { type: Date, default: Date.now },
  items: [{ poItemIndex: Number, articleCode: String, brand: String, color: String, sizeRange: String, mrp: Number, purchaseRate: Number, sellingPrice: Number, pairsPerCarton: Number, receivedQty: Number, acceptedQty: Number, rejectedQty: Number, remarks: String }],
  totalAcceptedQty: { type: Number, default: 0 }, totalValue: { type: Number, default: 0 }, notes: { type: String, default: '' }, createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('GoodsReceipt', goodsReceiptSchema);
