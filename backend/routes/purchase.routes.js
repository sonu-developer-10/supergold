const mongoose = require('mongoose');
const Supplier = require('../models/Supplier');
const Party = require('../models/Party');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceipt = require('../models/GoodsReceipt');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const SupplierPayment = require('../models/SupplierPayment');
const Stock = require('../models/Stock');
const Article = require('../models/Article');
const StockMovement = require('../models/StockMovement');
const { syncCashEntry } = require('../utils-cashbook');

const money = (v) => { const n = Number(v); return Number.isFinite(n) ? Number(n.toFixed(2)) : 0; };
const qty = (v) => Math.floor(Math.max(0, Number(v) || 0));
const code = (v) => String(v || '').trim().toUpperCase();
const nextNo = (prefix) => `${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-6)}`;
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

async function supplierBalance(supplierId) {
  const supplier = await Supplier.findById(supplierId);
  if (!supplier) return null;
  const [invoices, payments] = await Promise.all([
    PurchaseInvoice.find({ supplierId }).sort({ invoiceDate: 1, createdAt: 1 }),
    SupplierPayment.find({ supplierId }).sort({ paymentDate: 1, createdAt: 1 })
  ]);
  const invoiceTotal = money(invoices.reduce((s, x) => s + Number(x.grandTotal || 0), 0));
  const paymentTotal = money(payments.reduce((s, x) => s + Number(x.amount || 0), 0));
  return { supplier, invoices, payments, invoiceTotal, paymentTotal, balance: money(Number(supplier.openingBalance || 0) + invoiceTotal - paymentTotal) };
}

function registerPurchaseRoutes(app) {
  // Suppliers can be standalone or linked to an existing wholesale Party.
  app.get('/api/suppliers', async (req, res) => {
    try {
      const suppliers = await Supplier.find().sort({ name: 1 }).lean();
      const partyIds = suppliers.map(s => s.linkedPartyId).filter(Boolean);
      const parties = await Party.find({ _id: { $in: partyIds } }, 'name phone city').lean();
      const partyMap = new Map(parties.map(p => [String(p._id), p]));
      res.json(suppliers.map(s => ({ ...s, linkedParty: s.linkedPartyId ? partyMap.get(String(s.linkedPartyId)) || null : null })));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/suppliers', async (req, res) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name) throw fail('Supplier name is required');
      let linkedPartyId = req.body.linkedPartyId || null;
      if (linkedPartyId) {
        const party = await Party.findById(linkedPartyId);
        if (!party) throw fail('Linked wholesale party was not found', 404);
        const already = await Supplier.findOne({ linkedPartyId });
        if (already) throw fail('This wholesale party is already linked to another supplier', 409);
      }
      const supplier = await Supplier.create({ name, phone: req.body.phone || '', city: req.body.city || '', address: req.body.address || '', gstin: req.body.gstin || '', linkedPartyId, openingBalance: money(req.body.openingBalance), openingBalanceDate: req.body.openingBalanceDate || new Date(), active: req.body.active !== false });
      res.status(201).json(supplier);
    } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
  });

  app.put('/api/suppliers/:id', async (req, res) => {
    try {
      const supplier = await Supplier.findById(req.params.id);
      if (!supplier) throw fail('Supplier not found', 404);
      if (req.body.name !== undefined) supplier.name = String(req.body.name).trim();
      for (const key of ['phone','city','address','gstin','active']) if (req.body[key] !== undefined) supplier[key] = req.body[key];
      if (req.body.openingBalance !== undefined) supplier.openingBalance = money(req.body.openingBalance);
      if (req.body.openingBalanceDate !== undefined) supplier.openingBalanceDate = req.body.openingBalanceDate || new Date();
      if (req.body.linkedPartyId !== undefined) {
        const link = req.body.linkedPartyId || null;
        if (link) {
          if (!await Party.exists({ _id: link })) throw fail('Linked wholesale party was not found', 404);
          if (await Supplier.exists({ _id: { $ne: supplier._id }, linkedPartyId: link })) throw fail('This wholesale party is already linked to another supplier', 409);
        }
        supplier.linkedPartyId = link;
      }
      await supplier.save(); res.json(supplier);
    } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
  });

  app.delete('/api/suppliers/:id', async (req,res)=>{ try {
    const id=req.params.id; const [po,grn,inv,pay]=await Promise.all([PurchaseOrder.exists({supplierId:id}),GoodsReceipt.exists({supplierId:id}),PurchaseInvoice.exists({supplierId:id}),SupplierPayment.exists({supplierId:id})]);
    if(po||grn||inv||pay) throw fail('Supplier has purchase history. Deletion blocked; edit supplier or mark it inactive instead.',409);
    const deleted=await Supplier.findByIdAndDelete(id); if(!deleted) throw fail('Supplier not found',404); res.json({message:'Supplier deleted'});
  } catch(e){res.status(e.statusCode||500).json({error:e.message});} });

  app.get('/api/suppliers/:id/ledger', async (req, res) => {
    try { const data = await supplierBalance(req.params.id); if (!data) throw fail('Supplier not found', 404); res.json(data); }
    catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
  });

  app.get('/api/purchase-orders', async (req, res) => {
    try { const filter = req.query.supplierId ? { supplierId: req.query.supplierId } : {}; res.json(await PurchaseOrder.find(filter).sort({ createdAt: -1 })); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/purchase-orders', async (req, res) => {
    try {
      const supplier = await Supplier.findById(req.body.supplierId);
      if (!supplier) throw fail('Select a valid supplier');
      const items = (Array.isArray(req.body.items) ? req.body.items : []).map(x => ({
        articleCode: code(x.articleCode), brand: x.brand || '', color: x.color || '', sizeRange: x.sizeRange || '', mrp: money(x.mrp), purchaseRate: money(x.purchaseRate), sellingPrice: money(x.sellingPrice), pairsPerCarton: Math.max(1, qty(x.pairsPerCarton) || 12), orderedQty: qty(x.orderedQty), receivedQty: 0, remarks: x.remarks || ''
      })).filter(x => x.articleCode && x.orderedQty > 0);
      if (!items.length) throw fail('Add at least one article with ordered quantity');
      const subtotal = money(items.reduce((s,x) => s + x.orderedQty * x.purchaseRate, 0));
      const discount = Math.min(subtotal, Math.max(0, money(req.body.discount))); const freight = Math.max(0, money(req.body.freight));
      const po = await PurchaseOrder.create({ poNo: nextNo('SG-PO'), supplierId: supplier._id, supplierName: supplier.name, orderDate: req.body.orderDate || new Date(), expectedDate: req.body.expectedDate || null, items, subtotal, discount, freight, grandTotal: money(subtotal - discount + freight), status: req.body.status === 'Draft' ? 'Draft' : 'Ordered', notes: req.body.notes || '' });
      res.status(201).json(po);
    } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
  });
  app.patch('/api/purchase-orders/:id/status', async (req, res) => {
    try { const po = await PurchaseOrder.findById(req.params.id); if (!po) throw fail('Purchase order not found',404); if (!['Ordered','Cancelled'].includes(req.body.status)) throw fail('Invalid purchase order status'); if (po.items.some(i => Number(i.receivedQty) > 0) && req.body.status === 'Cancelled') throw fail('A purchase order with received goods cannot be cancelled'); po.status=req.body.status; po.updatedAt=new Date(); await po.save(); res.json(po); }
    catch(e){res.status(e.statusCode||500).json({error:e.message});}
  });

  app.delete('/api/purchase-orders/:id', async(req,res)=>{try{const po=await PurchaseOrder.findById(req.params.id);if(!po)throw fail('Purchase order not found',404);if(po.items.some(x=>Number(x.receivedQty||0)>0)||await GoodsReceipt.exists({purchaseOrderId:po._id}))throw fail('Goods have already been received. This order cannot be deleted.',409);await po.deleteOne();res.json({message:'Purchase order deleted'});}catch(e){res.status(e.statusCode||500).json({error:e.message});}});

  app.get('/api/goods-receipts', async (req, res) => {
    try { const filter = req.query.purchaseOrderId ? { purchaseOrderId: req.query.purchaseOrderId } : {}; res.json(await GoodsReceipt.find(filter).sort({ receivedDate: -1 })); }
    catch(e){res.status(500).json({error:e.message});}
  });
  app.post('/api/goods-receipts', async (req, res) => {
    try {
      const po = await PurchaseOrder.findById(req.body.purchaseOrderId);
      if (!po) throw fail('Purchase order not found',404);
      if (['Draft','Cancelled','Received'].includes(po.status)) throw fail('This purchase order is not open for receiving');
      const input = Array.isArray(req.body.items) ? req.body.items : [];
      const receiptItems = [];
      const seenPoItems = new Set();
      for (const line of input) {
        const idx = Number(line.poItemIndex);
        if (seenPoItems.has(idx)) throw fail('A purchase order line can only be received once per GRN');
        seenPoItems.add(idx); const ordered = po.items[idx];
        if (!ordered) throw fail('Invalid purchase order item selected');
        const receivedQty = qty(line.receivedQty); const acceptedQty = qty(line.acceptedQty === undefined ? receivedQty : line.acceptedQty); const rejectedQty = qty(line.rejectedQty);
        if (receivedQty <= 0 || acceptedQty + rejectedQty !== receivedQty) throw fail(`Accepted + rejected quantity must equal received quantity for ${ordered.articleCode}`);
        if (receivedQty + Number(ordered.receivedQty || 0) > Number(ordered.orderedQty || 0)) throw fail(`Receiving quantity exceeds pending order quantity for ${ordered.articleCode}`);
        const item = { ...ordered.toObject(), receivedQty, acceptedQty, rejectedQty, poItemIndex: idx, remarks: line.remarks || '' };
        receiptItems.push(item);
      }
      if (!receiptItems.length) throw fail('Enter at least one received quantity');
      // GRN is the only point where inventory increases.
      for (const item of receiptItems) {
        if (item.acceptedQty <= 0) { po.items[item.poItemIndex].receivedQty = Number(po.items[item.poItemIndex].receivedQty || 0) + item.receivedQty; continue; }
        const stockFilter = { articleCode: item.articleCode, sizeRange: item.sizeRange || '', mrp: money(item.mrp) };
        let stock = await Stock.findOne(stockFilter);
        if (stock) {
          const oldQty = Number(stock.totalPairs || 0); const newQty = oldQty + item.acceptedQty;
          stock.purchaseRate = newQty > 0 ? money(((oldQty * Number(stock.purchaseRate || 0)) + (item.acceptedQty * item.purchaseRate)) / newQty) : item.purchaseRate;
          stock.totalPairs = newQty; stock.pairsPerCarton = Math.max(1, Number(item.pairsPerCarton || stock.pairsPerCarton || 12)); stock.cartons = Math.floor(newQty / stock.pairsPerCarton); stock.loosePairs = newQty % stock.pairsPerCarton; stock.mrp = money(item.mrp); stock.brand = item.brand || stock.brand; stock.color = item.color || stock.color; stock.lastUpdated = new Date(); await stock.save();
        } else {
          const ppt = Math.max(1, Number(item.pairsPerCarton || 12));
          stock = await Stock.create({ articleCode:item.articleCode, brand:item.brand, color:item.color, sizeRange:item.sizeRange || '', cartons:Math.floor(item.acceptedQty/ppt), pairsPerCarton:ppt, loosePairs:item.acceptedQty%ppt, totalPairs:item.acceptedQty, mrp:money(item.mrp), purchaseRate:money(item.purchaseRate), sellingPrice:money(item.sellingPrice), lastUpdated:new Date() });
        }
        await StockMovement.create({ articleCode:item.articleCode, sizeRange:item.sizeRange || '', color:item.color || '', movementType:'Purchase Receipt', quantity:item.acceptedQty, direction:'IN', referenceType:'GRN', referenceNo:po.poNo, remarks:'Accepted quantity received against purchase order' });
        await Article.findOneAndUpdate({ articleCode:item.articleCode, sizeRange:item.sizeRange || '', mrp:money(item.mrp) }, { $set:{ brand:item.brand || '', color:item.color || '', mrp:money(item.mrp), purchaseRate:money(item.purchaseRate), wholesaleRate:money(item.sellingPrice), sellingPrice:money(item.sellingPrice), pairsInPeti:Math.max(1,Number(item.pairsPerCarton||12)) }, $setOnInsert:{ articleCode:item.articleCode, sizeRange:item.sizeRange || '' } }, { upsert:true, new:true, setDefaultsOnInsert:true });
        po.items[item.poItemIndex].receivedQty = Number(po.items[item.poItemIndex].receivedQty || 0) + item.receivedQty;
      }
      const allReceived = po.items.every(i => Number(i.receivedQty || 0) >= Number(i.orderedQty || 0));
      po.status = allReceived ? 'Received' : 'Partially Received'; po.updatedAt = new Date(); await po.save();
      const grn = await GoodsReceipt.create({ grnNo:nextNo('SG-GRN'), purchaseOrderId:po._id, poNo:po.poNo, supplierId:po.supplierId, supplierName:po.supplierName, receivedDate:req.body.receivedDate || new Date(), items:receiptItems, totalAcceptedQty:receiptItems.reduce((s,x)=>s+x.acceptedQty,0), totalValue:money(receiptItems.reduce((s,x)=>s+x.acceptedQty*x.purchaseRate,0)), notes:req.body.notes||'' });
      res.status(201).json({ goodsReceipt:grn, purchaseOrder:po });
    } catch(e){ console.error('GRN error:',e); res.status(e.statusCode||500).json({error:e.message}); }
  });

  app.get('/api/purchase-invoices', async (req,res)=>{try{const filter=req.query.supplierId?{supplierId:req.query.supplierId}:{};res.json(await PurchaseInvoice.find(filter).sort({invoiceDate:-1}));}catch(e){res.status(500).json({error:e.message});}});
  app.post('/api/purchase-invoices', async (req,res)=>{
    try {
      const supplier = await Supplier.findById(req.body.supplierId); if(!supplier) throw fail('Select a valid supplier');
      const grnIds = Array.isArray(req.body.goodsReceiptIds) ? req.body.goodsReceiptIds : [];
      const grns = grnIds.length ? await GoodsReceipt.find({ _id: { $in: grnIds }, supplierId: supplier._id }) : [];
      if (grnIds.length && grns.length !== grnIds.length) throw fail('One or more selected GRNs do not belong to this supplier');
      if (grns.length) { const alreadyInvoiced = await PurchaseInvoice.findOne({ goodsReceiptIds: { $in: grnIds } }); if (alreadyInvoiced) throw fail('One or more selected GRNs are already included in a purchase invoice'); }
      let items = Array.isArray(req.body.items) ? req.body.items : [];
      if (!items.length && grns.length) items = grns.flatMap(g => g.items.map(i => ({ articleCode:i.articleCode, brand:i.brand, color:i.color, sizeRange:i.sizeRange, qty:i.acceptedQty, rate:i.purchaseRate })));
      items = items.map(i=>({articleCode:code(i.articleCode),brand:i.brand||'',color:i.color||'',sizeRange:i.sizeRange||'',qty:qty(i.qty),rate:money(i.rate),amount:money(qty(i.qty)*money(i.rate))})).filter(i=>i.articleCode&&i.qty>0);
      if(!items.length) throw fail('Select at least one received GRN or add invoice items');
      const subtotal=money(items.reduce((s,i)=>s+i.amount,0)); const discount=Math.min(subtotal,Math.max(0,money(req.body.discount))); const tax=Math.max(0,money(req.body.tax)); const freight=Math.max(0,money(req.body.freight)); const grandTotal=money(subtotal-discount+tax+freight); const paidAmount=Math.max(0,money(req.body.paidAmount));
      if(paidAmount>grandTotal) throw fail('Paid amount cannot exceed invoice total');
      const invoice=await PurchaseInvoice.create({invoiceNo:nextNo('SG-PI'),supplierInvoiceNo:req.body.supplierInvoiceNo||'',supplierId:supplier._id,supplierName:supplier.name,purchaseOrderId:req.body.purchaseOrderId||grns[0]?.purchaseOrderId||null,goodsReceiptIds:grns.map(g=>g._id),invoiceDate:req.body.invoiceDate||new Date(),dueDate:req.body.dueDate||null,items,subtotal,discount,tax,freight,grandTotal,paidAmount,dueAmount:money(grandTotal-paidAmount),notes:req.body.notes||''});
      if(paidAmount>0) { const initialPayment=await SupplierPayment.create({supplierId:supplier._id,supplierName:supplier.name,invoiceId:invoice._id,invoiceNo:invoice.invoiceNo,receiptNo:nextNo('SG-SPAY'),amount:paidAmount,paymentDate:req.body.invoiceDate||new Date(),paymentMode:req.body.paymentMode||'Cash',reference:'Initial invoice payment',remarks:'Payment recorded with purchase invoice'}); await syncCashEntry({sourceType:'SupplierPayment',sourceId:initialPayment._id,date:initialPayment.paymentDate,direction:'OUT',account:initialPayment.paymentMode,category:'Supplier Payment',amount:initialPayment.amount,partyName:supplier.name,reference:initialPayment.reference,remarks:initialPayment.remarks,createdBy:req.user?.username||''}); }
      res.status(201).json(invoice);
    }catch(e){res.status(e.statusCode||500).json({error:e.message});}
  });
  app.put('/api/purchase-invoices/:id',async(req,res)=>{try{const inv=await PurchaseInvoice.findById(req.params.id);if(!inv)throw fail('Purchase invoice not found',404);if(await SupplierPayment.exists({invoiceId:inv._id}))throw fail('This invoice has linked supplier payments. Edit or remove those payments first.',409);const supplier=await Supplier.findById(req.body.supplierId||inv.supplierId);if(!supplier)throw fail('Supplier not found');const items=(req.body.items||inv.items||[]).map(i=>({articleCode:code(i.articleCode),brand:i.brand||'',color:i.color||'',sizeRange:i.sizeRange||'',qty:qty(i.qty),rate:money(i.rate),amount:money(qty(i.qty)*money(i.rate))})).filter(i=>i.articleCode&&i.qty>0);if(!items.length)throw fail('Invoice needs at least one item');const subtotal=money(items.reduce((n,i)=>n+i.amount,0)),discount=Math.min(subtotal,Math.max(0,money(req.body.discount))),tax=Math.max(0,money(req.body.tax)),freight=Math.max(0,money(req.body.freight)),grandTotal=money(subtotal-discount+tax+freight),paidAmount=Math.max(0,money(req.body.paidAmount??inv.paidAmount));if(paidAmount>grandTotal)throw fail('Paid amount cannot exceed invoice total');Object.assign(inv,{supplierId:supplier._id,supplierName:supplier.name,supplierInvoiceNo:req.body.supplierInvoiceNo??inv.supplierInvoiceNo,invoiceDate:req.body.invoiceDate||inv.invoiceDate,dueDate:req.body.dueDate||null,items,subtotal,discount,tax,freight,grandTotal,paidAmount,dueAmount:money(grandTotal-paidAmount)});await inv.save();res.json(inv);}catch(e){res.status(e.statusCode||500).json({error:e.message});}});
  app.delete('/api/purchase-invoices/:id',async(req,res)=>{try{const inv=await PurchaseInvoice.findById(req.params.id);if(!inv)throw fail('Purchase invoice not found',404);if(await SupplierPayment.exists({invoiceId:inv._id}))throw fail('Invoice has linked supplier payments. Delete/reassign payments first.',409);await inv.deleteOne();res.json({message:'Purchase invoice deleted'});}catch(e){res.status(e.statusCode||500).json({error:e.message});}});

  app.post('/api/supplier-payments', async(req,res)=>{
    try{
      const supplier=await Supplier.findById(req.body.supplierId);if(!supplier)throw fail('Supplier not found',404);
      const amount=money(req.body.amount);if(amount<=0)throw fail('Payment amount must be greater than zero');
      let invoice=null;if(req.body.invoiceId){invoice=await PurchaseInvoice.findOne({_id:req.body.invoiceId,supplierId:supplier._id});if(!invoice)throw fail('Invoice does not belong to this supplier');}
      if(invoice && amount>Number(invoice.dueAmount||0))throw fail('Payment amount exceeds selected invoice due');
      const payment=await SupplierPayment.create({supplierId:supplier._id,supplierName:supplier.name,invoiceId:invoice?invoice._id:null,invoiceNo:invoice?invoice.invoiceNo:'',receiptNo:nextNo('SG-SPAY'),paymentDate:req.body.paymentDate||new Date(),amount,paymentMode:req.body.paymentMode||'Cash',reference:req.body.reference||'',remarks:req.body.remarks||''});
      if(invoice){invoice.paidAmount=money(invoice.paidAmount+amount);invoice.dueAmount=money(Math.max(0,invoice.grandTotal-invoice.paidAmount));await invoice.save();}
      await syncCashEntry({sourceType:'SupplierPayment',sourceId:payment._id,date:payment.paymentDate,direction:'OUT',account:payment.paymentMode,category:'Supplier Payment',amount:payment.amount,partyName:supplier.name,reference:payment.reference,remarks:payment.remarks,createdBy:req.user?.username||''});
      res.status(201).json(payment);
    }catch(e){res.status(e.statusCode||500).json({error:e.message});}
  });
  app.put('/api/supplier-payments/:id',async(req,res)=>{try{const p=await SupplierPayment.findById(req.params.id);if(!p)throw fail('Supplier payment not found',404);const supplier=await Supplier.findById(req.body.supplierId||p.supplierId);if(!supplier)throw fail('Supplier not found');const amount=money(req.body.amount);if(amount<=0)throw fail('Payment amount must be greater than zero');const oldInv=p.invoiceId?await PurchaseInvoice.findById(p.invoiceId):null;const newInvoiceId=req.body.invoiceId!==undefined?(req.body.invoiceId||null):p.invoiceId;const newInv=newInvoiceId?await PurchaseInvoice.findOne({_id:newInvoiceId,supplierId:supplier._id}):null;if(newInvoiceId&&!newInv)throw fail('Selected invoice does not belong to this supplier');if(oldInv){oldInv.paidAmount=money(Math.max(0,Number(oldInv.paidAmount||0)-Number(p.amount||0)));oldInv.dueAmount=money(Math.max(0,oldInv.grandTotal-oldInv.paidAmount));await oldInv.save();}if(newInv){if(amount>Number(newInv.dueAmount||0))throw fail('Payment exceeds selected invoice due');newInv.paidAmount=money(Number(newInv.paidAmount||0)+amount);newInv.dueAmount=money(Math.max(0,newInv.grandTotal-newInv.paidAmount));await newInv.save();}Object.assign(p,{supplierId:supplier._id,supplierName:supplier.name,invoiceId:newInv?newInv._id:null,invoiceNo:newInv?newInv.invoiceNo:'',paymentDate:req.body.paymentDate||p.paymentDate,amount,paymentMode:req.body.paymentMode||p.paymentMode,reference:req.body.reference||'',remarks:req.body.remarks||''});await p.save();await syncCashEntry({sourceType:'SupplierPayment',sourceId:p._id,date:p.paymentDate,direction:'OUT',account:p.paymentMode,category:'Supplier Payment',amount:p.amount,partyName:supplier.name,reference:p.reference,remarks:p.remarks,createdBy:req.user?.username||''});res.json(p);}catch(e){res.status(e.statusCode||500).json({error:e.message});}});
  app.delete('/api/supplier-payments/:id',async(req,res)=>{try{const p=await SupplierPayment.findById(req.params.id);if(!p)throw fail('Supplier payment not found',404);if(p.invoiceId){const inv=await PurchaseInvoice.findById(p.invoiceId);if(inv){inv.paidAmount=money(Math.max(0,Number(inv.paidAmount||0)-Number(p.amount||0)));inv.dueAmount=money(Math.max(0,inv.grandTotal-inv.paidAmount));await inv.save();}}await require('../models/CashBookEntry').deleteOne({sourceType:'SupplierPayment',sourceId:String(p._id)});await p.deleteOne();res.json({message:'Supplier payment deleted and invoice due recalculated'});}catch(e){res.status(e.statusCode||500).json({error:e.message});}});

  app.get('/api/supplier-payments',async(req,res)=>{try{const f=req.query.supplierId?{supplierId:req.query.supplierId}:{};res.json(await SupplierPayment.find(f).sort({paymentDate:-1,createdAt:-1}));}catch(e){res.status(500).json({error:e.message});}});
}
module.exports = registerPurchaseRoutes;
