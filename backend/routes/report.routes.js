const Bill = require('../models/Bill');
const Party = require('../models/Party');
const PartyPayment = require('../models/PartyPayment');
const Stock = require('../models/Stock');
const Expense = require('../models/Expense');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const Supplier = require('../models/Supplier');
const SupplierPayment = require('../models/SupplierPayment');
const Article = require('../models/Article');
const money = v => { const n=Number(v); return Number.isFinite(n)?Number(n.toFixed(2)):0; };
const dateRange = (from,to,field='createdAt') => { const f={}; if(from||to){f[field]={};if(from)f[field].$gte=new Date(`${from}T00:00:00.000Z`);if(to)f[field].$lte=new Date(`${to}T23:59:59.999Z`);}return f; };

function registerReportRoutes(app) {
  app.get('/api/reports/summary', async (req,res)=>{
    try {
      const from=req.query.from||new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10);
      const to=req.query.to||new Date().toISOString().slice(0,10);
      const [bills,payments,invoices,supplierPayments,expenses,stocks,parties,suppliers,articles] = await Promise.all([
        Bill.find({billDate:dateRange(from,to,'billDate').billDate||{$exists:true}}).lean(),
        PartyPayment.find({paymentDate:{$gte:from,$lte:to}}).lean(),
        PurchaseInvoice.find({invoiceDate:dateRange(from,to,'invoiceDate').invoiceDate||{$exists:true}}).lean(),
        SupplierPayment.find({paymentDate:{$gte:new Date(`${from}T00:00:00`),$lte:new Date(`${to}T23:59:59`)}}).lean(),
        Expense.find({date:{$gte:from,$lte:to}}).lean(), Stock.find().lean(), Party.find().lean(), Supplier.find({active:true}).lean(), Article.find().lean()
      ]);
      const grossSales=money(bills.reduce((s,b)=>s+Number(b.rawTotal||0),0));
      const salesReturns=money(bills.reduce((s,b)=>s+Number(b.returnTotal||0),0));
      const sales=money(bills.reduce((s,b)=>s+Number(b.todayTotal||0),0));
      const billCollections=money(bills.reduce((s,b)=>s+Math.max(0,Number(b.amountPaid||0)-Number(b.allocatedPartyCashPaid||0)-Number(b.allocatedPartyOnlinePaid||0)),0));
      const otherCollections=money(payments.reduce((s,p)=>s+Number(p.amount||0),0));
      const purchaseTotal=money(invoices.reduce((s,p)=>s+Number(p.grandTotal||0),0));
      const purchasePaid=money(supplierPayments.reduce((s,p)=>s+Number(p.amount||0),0));
      const expenseTotal=money(expenses.reduce((s,e)=>s+Number(e.amount||0),0));
      const stockValue=money(stocks.reduce((s,x)=>s+Number(x.totalPairs||0)*Number(x.purchaseRate||0),0));
      const partyOutstanding=money(parties.reduce((s,p)=>s+Number(p.currentBalance||0),0));
      const supplierOutstanding=money((await Promise.all(suppliers.map(async supplier=>{
        const [inv,pay]=await Promise.all([PurchaseInvoice.find({supplierId:supplier._id}).select('grandTotal'),SupplierPayment.find({supplierId:supplier._id}).select('amount')]);
        return Number(supplier.openingBalance||0)+inv.reduce((a,x)=>a+Number(x.grandTotal||0),0)-pay.reduce((a,x)=>a+Number(x.amount||0),0);
      }))).reduce((a,b)=>a+b,0));
      const articleCostMap=new Map(articles.map(a=>[`${String(a.articleCode||'').toUpperCase()}|${String(a.sizeRange||'')}`,Number(a.purchaseRate||0)]));
      let cogs=0; const topMap=new Map();
      for(const bill of bills){for(const item of (bill.items||[])){const q=Number(item.totalPairs||item.loosePairs||0);const key=`${String(item.articleCode||'').toUpperCase()}|${String(item.size||item.sizeRange||'')}`;const rate=Number(item.purchaseRate||articleCostMap.get(key)||0);cogs+=q*rate;const name=String(item.articleCode||'Unknown');topMap.set(name,(topMap.get(name)||0)+q);}}
      for(const bill of bills){for(const item of (bill.returnItems||[])){const q=Number(item.totalPairs||0);const key=`${String(item.articleCode||'').toUpperCase()}|${String(item.size||item.sizeRange||'')}`;const rate=Number(item.purchaseRate||articleCostMap.get(key)||0);cogs-=q*rate;}}
      const topArticles=[...topMap.entries()].map(([articleCode,pairs])=>({articleCode,pairs})).sort((a,b)=>b.pairs-a.pairs).slice(0,10);
      const dailyMap=new Map();
      for(const b of bills){const d=new Date(b.billDate||Date.now()).toISOString().slice(0,10);dailyMap.set(d,(dailyMap.get(d)||0)+Number(b.todayTotal||0));}
      const dailySales=[...dailyMap.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,amount])=>({date,amount:money(amount)}));
      const supplierPayableBySupplier=await Promise.all(suppliers.map(async s=>{const [inv,pay]=await Promise.all([PurchaseInvoice.find({supplierId:s._id}).select('grandTotal'),SupplierPayment.find({supplierId:s._id}).select('amount')]);return{name:s.name,balance:money(Number(s.openingBalance||0)+inv.reduce((a,x)=>a+Number(x.grandTotal||0),0)-pay.reduce((a,x)=>a+Number(x.amount||0),0))};}));
      res.json({period:{from,to},grossSales,sales,salesReturns,netSales:sales,billCollections,otherCollections,totalCollections:money(billCollections+otherCollections),purchaseTotal,purchasePaid,expenseTotal,estimatedCogs:money(cogs),estimatedGrossProfit:money(sales-cogs),estimatedNetProfit:money(sales-cogs-expenseTotal),stockValue,partyOutstanding,supplierOutstanding,topArticles,dailySales,supplierPayableBySupplier,counts:{bills:bills.length,purchaseInvoices:invoices.length,parties:parties.length,suppliers:suppliers.length,stockVariants:stocks.length}});
    } catch(e){console.error('Reports summary error',e);res.status(500).json({error:e.message});}
  });
}
module.exports=registerReportRoutes;
