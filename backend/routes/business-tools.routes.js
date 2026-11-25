const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const Party = require('../models/Party');
const Bill = require('../models/Bill');
const PartyPayment = require('../models/PartyPayment');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const SupplierPayment = require('../models/SupplierPayment');
const Expense = require('../models/Expense');
const StockMovement = require('../models/StockMovement');
const CashBookEntry = require('../models/CashBookEntry');
const AuditLog = require('../models/AuditLog');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const GoodsReceipt = require('../models/GoodsReceipt');
const Article = require('../models/Article');
const DailyCashClosing = require('../models/DailyCashClosing');
const { listAutomaticBackups, readAutomaticBackup } = require('../services/backupScheduler');
const money = v => { const n=Number(v); return Number.isFinite(n)?Number(n.toFixed(2)):0; };
const localDateText = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const no = () => `SG-CB-${Date.now()}-${Math.floor(Math.random()*1000)}`;
const admin = (req,res,next) => req.user?.role === 'admin' ? next() : res.status(403).json({error:'Admin access required'});

function registerBusinessToolsRoutes(app) {
  // Owner dashboard data is deliberately admin-only; it includes business-wide margin and cash figures.
  app.get('/api/business-tools/owner-dashboard', admin, async (req,res) => {
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const since90 = new Date(today.getTime()-90*86400000);
      const range = String(req.query.range || 'ALL').toUpperCase();
      let from = null;
      if (range === 'LAST_7_DAYS') { from = new Date(todayStart); from.setDate(from.getDate()-6); }
      else if (range === 'WEEK') { from = new Date(todayStart); const day=from.getDay(); from.setDate(from.getDate()-(day===0?6:day-1)); }
      else if (range === 'MONTH') from = new Date(today.getFullYear(), today.getMonth(), 1);
      else if (range === 'YEAR') from = new Date(today.getFullYear(), 0, 1);
      else if (range !== 'ALL') return res.status(400).json({ error: 'Invalid dashboard range' });
      const to = today;
      const billFilter = from ? { billDate: { $gte: from, $lt: todayEnd } } : {};
      const paymentFilter = from ? { paymentDate: { $gte: localDateText(from), $lte: localDateText(today) } } : {};
      const expenseFilter = from ? { date: { $gte: localDateText(from), $lte: localDateText(today) } } : {};
      const invoiceFilter = from ? { invoiceDate: { $gte: from, $lt: todayEnd } } : {};
      const [bills, bills90, parties, stocks, expenses, cashRowsToday, invoices, partyPayments, articleRows] = await Promise.all([
        Bill.find(billFilter).lean(), Bill.find({ billDate: { $gte: since90, $lt: todayEnd } }).lean(), Party.find().lean(), Stock.find().lean(),
        Expense.find(expenseFilter).lean(),
        CashBookEntry.find({ date: { $gte: todayStart, $lt: todayEnd } }).lean(),
        PurchaseInvoice.find(invoiceFilter).lean(),
        PartyPayment.find(paymentFilter).lean(),
        Article.find().select('articleCode sizeRange mrp purchaseRate').lean()
      ]);
      const sales = money(bills.reduce((n,b)=>n+Number(b.todayTotal||0),0));
      // Calculate collections from the original business records, not CashBookEntry.
      // Bill payment fields include party-payment allocations, so subtract those here
      // before adding PartyPayment records once; this avoids both missing legacy receipts
      // and double-counting bill-wise allocated receipts.
      const billCollections = bills.reduce((sum,b) => sum
        + Math.max(0, Number(b.cashPaid||0) - Number(b.allocatedPartyCashPaid||0))
        + Math.max(0, Number(b.onlinePaid||0) - Number(b.allocatedPartyOnlinePaid||0))
        + Number(b.advancePaid||0), 0);
      const partyPaymentCollections = partyPayments.reduce((sum,p) => sum + Number(p.amount||0), 0);
      const collections = money(billCollections + partyPaymentCollections);
      const cashIn = money(cashRowsToday.filter(x=>x.account==='Cash'&&x.direction==='IN').reduce((n,x)=>n+Number(x.amount||0),0));
      const cashOut = money(cashRowsToday.filter(x=>x.account==='Cash'&&x.direction==='OUT').reduce((n,x)=>n+Number(x.amount||0),0));
      // Always flag completely out-of-stock variants, even when no reorder level has been configured.
      // For positive stock, use the variant's configured reorder level.
      const isLowStock = x => Number(x.totalPairs||0) <= 0 || (Number(x.reorderLevel||0) > 0 && Number(x.totalPairs||0) <= Number(x.reorderLevel||0));
      const lowStock = stocks.filter(isLowStock);
      const costMap = new Map(stocks.map(x=>[`${String(x.articleCode||'').toUpperCase()}|${x.sizeRange||''}`,Number(x.purchaseRate||0)]));
      const ASSUMED_PROFIT_PERCENT = 8;
      const articleCostExact = new Map(); const articleCostLoose = new Map();
      for (const a of articleRows) {
        const rate = Number(a.purchaseRate || 0); if (!(rate > 0)) continue;
        const code = String(a.articleCode || '').toUpperCase(); const size = a.sizeRange || '';
        articleCostExact.set(`${code}|${size}|${Number(a.mrp || 0)}`, rate);
        if (!articleCostLoose.has(`${code}|${size}`)) articleCostLoose.set(`${code}|${size}`, rate);
      }
      const lineKey = i => `${String(i.articleCode||'Unknown').toUpperCase()}|${i.size||i.sizeRange||''}`;
      const articleRate = i => articleCostExact.get(`${lineKey(i)}|${Number(i.mrp || 0)}`) || articleCostLoose.get(lineKey(i)) || 0;
      const legacyLineCost = i => Number(i.purchaseRate||costMap.get(lineKey(i))||0);
      const lineCost = i => Number(i.purchaseRate||0) || articleRate(i) || Number(costMap.get(lineKey(i))||0);
      const lineQty = i => Number(i.totalPairs||i.loosePairs||0);
      // Total cost of one line: known unit cost x qty, or (if unknown) 92% of the line's selling value.
      const lineCostTotal = (i, q, revenue) => { const c = lineCost(i); return c > 0 ? q*c : revenue*(1-ASSUMED_PROFIT_PERCENT/100); };
      let cogs=0; const partySales=new Map(); const articleMetrics=new Map();
      for(const b of bills){ partySales.set(String(b.partyId), (partySales.get(String(b.partyId))||0)+Number(b.todayTotal||0)); for(const i of (b.items||[])){const code=String(i.articleCode||'Unknown');const key=`${code.toUpperCase()}|${i.size||i.sizeRange||''}`;const q=Number(i.totalPairs||i.loosePairs||0);const amount=Number(i.totalAmount||q*Number(i.rate||0));const billGross=Number(b.rawTotal||0);const discountFactor=billGross>0?Math.max(0,(billGross-Number(b.discountVal||0))/billGross):1;const lc=lineCostTotal(i,q,amount*discountFactor);cogs+=lc;const m=articleMetrics.get(code)||{articleCode:code,sales:0,cost:0,pairs:0};m.sales+=amount*discountFactor;m.cost+=lc;m.pairs+=q;articleMetrics.set(code,m);} for(const i of (b.returnItems||[])){const code=String(i.articleCode||'Unknown');const key=`${code.toUpperCase()}|${i.size||i.sizeRange||''}`;const q=Number(i.totalPairs||0);const amount=Number(i.totalAmount||q*Number(i.rate||0));const lc=lineCostTotal(i,q,amount);cogs-=lc;const m=articleMetrics.get(code)||{articleCode:code,sales:0,cost:0,pairs:0};m.sales-=amount;m.cost-=lc;m.pairs-=q;articleMetrics.set(code,m);} }
      const partyRanks=[...partySales.entries()].map(([id,amount])=>({partyId:id,name:parties.find(p=>String(p._id)===id)?.name||'Unknown',city:parties.find(p=>String(p._id)===id)?.city||'',sales:money(amount)})).sort((a,b)=>b.sales-a.sales).slice(0,10);
      const demandByVariant = new Map();
      for (const b of bills90) for (const item of (b.items || [])) { const key = `${String(item.articleCode||'').toUpperCase()}|${String(item.size||item.sizeRange||'')}`; demandByVariant.set(key,(demandByVariant.get(key)||0)+Number(item.totalPairs||item.loosePairs||0)); }
      const reorder=stocks.map(x=>{const key=`${String(x.articleCode||'').toUpperCase()}|${String(x.sizeRange||'')}`;const daily=(demandByVariant.get(key)||0)/90;const leadDemand=daily*21;const target=Math.max(Number(x.reorderLevel||0),leadDemand);const suggestedOrderQty=Math.max(Number(x.totalPairs||0)<=0?1:0,Math.ceil(target-Number(x.totalPairs||0)));return {...x,dailyDemand:money(daily),daysOfCover:daily?Math.floor(Number(x.totalPairs||0)/daily):null,suggestedOrderQty};}).filter(x=>x.suggestedOrderQty>0).sort((a,b)=>b.suggestedOrderQty-a.suggestedOrderQty).slice(0,25);
      const profit=money(sales-cogs); const expenseTotal=money(expenses.reduce((n,x)=>n+Number(x.amount||0),0));
      const articleMargins=[...articleMetrics.values()].map(x=>({articleCode:x.articleCode,sales:money(x.sales),estimatedCost:money(x.cost),estimatedGrossProfit:money(x.sales-x.cost),marginPercent:x.sales>0?money((x.sales-x.cost)/x.sales*100):0,pairs:money(x.pairs)})).sort((a,b)=>b.estimatedGrossProfit-a.estimatedGrossProfit).slice(0,10);
      // Per-bill profit (Bill-wise profit section only; other dashboard figures are unchanged).
      // Cost of each bill line is resolved in this order:
      //   1) purchaseRate snapshot saved on the bill line,
      //   2) the article's current Purchasing Price (Articles tab) - so as soon as the owner
      //      fills it in, it is picked up automatically,
      //   3) current stock purchase rate,
      //   4) if still unknown: assume ASSUMED_PROFIT_PERCENT profit on that line,
      //      i.e. cost = 92% of the line's selling value.
      const billProfits = bills.map(b => {
        const saleItems=b.items||[]; const retItems=b.returnItems||[];
        const billGross=Number(b.rawTotal||0);
        const discountFactor=billGross>0?Math.max(0,(billGross-Number(b.discountVal||0))/billGross):1;
        let cost=0, assumedCost=0, assumedLines=0, legacyCost=0;
        for (const i of saleItems) {
          const q=lineQty(i); if (q<=0) continue;
          legacyCost += q*legacyLineCost(i);
          const c=lineCost(i);
          if (c>0) cost += q*c;
          else { const revenue=Number(i.totalAmount||q*Number(i.rate||0))*discountFactor; assumedCost += revenue*(1-ASSUMED_PROFIT_PERCENT/100); assumedLines++; }
        }
        for (const i of retItems) {
          const q=Number(i.totalPairs||0); if (q<=0) continue;
          legacyCost -= q*legacyLineCost(i);
          const c=lineCost(i);
          if (c>0) cost -= q*c;
          else { const revenue=Number(i.totalAmount||q*Number(i.rate||0)); assumedCost -= revenue*(1-ASSUMED_PROFIT_PERCENT/100); assumedLines++; }
        }
        const totalCost=cost+assumedCost; const net=Number(b.todayTotal||0);
        return {
          billId:String(b._id), billNo:b.billNo, billDate:b.billDate,
          partyName:b.partyName||parties.find(p=>String(p._id)===String(b.partyId))?.name||'Unknown',
          pairs:saleItems.reduce((n,i)=>n+lineQty(i),0),
          sales:money(net), cost:money(totalCost), profit:money(net-totalCost),
          marginPercent:net>0?money((net-totalCost)/net*100):0,
          // costMissing is kept for backward compatibility; it now means "some lines use the assumed 8% profit".
          costMissing:assumedLines>0, usesAssumedCost:assumedLines>0, assumedLineCount:assumedLines,
          assumedProfitPercent:ASSUMED_PROFIT_PERCENT, assumedCost:money(assumedCost),
          legacyProfit:money(net-legacyCost)
        };
      }).sort((a,b)=>new Date(b.billDate)-new Date(a.billDate) || b.billNo-a.billNo);
      const todayBills = billProfits.filter(x=>{const d=new Date(x.billDate);return d>=todayStart&&d<todayEnd;});
      const todaySummary = {
        date: localDateText(todayStart),
        sales: money(todayBills.reduce((n,x)=>n+x.sales,0)),
        bills: todayBills.length,
        pairs: money(todayBills.reduce((n,x)=>n+x.pairs,0)),
        // Same method as Bill-wise profit (uses the 8% assumption where purchase price is missing).
        profit: money(todayBills.reduce((n,x)=>n+x.profit,0))
      };
      res.json({billProfits:billProfits.map(({legacyProfit,...row})=>row),today:todaySummary,period:{range,from:from?localDateText(from):null,to:localDateText(today)},sales,collections,partyOutstanding:money(parties.reduce((n,p)=>n+Number(p.currentBalance||0),0)),stockValue:money(stocks.reduce((n,x)=>n+Number(x.totalPairs||0)*Number(x.purchaseRate||0),0)),purchaseTotal:money(invoices.reduce((n,x)=>n+Number(x.grandTotal||0),0)),expenseTotal,estimatedGrossProfit:profit,estimatedGrossMarginPercent:sales>0?money(profit/sales*100):0,estimatedNetProfit:money(profit-expenseTotal),articleMargins,profitIsEstimate:true,lowStockCount:lowStock.length,lowStock,partyRanks,reorderSuggestions:reorder,cash:{cashIn,cashOut,net:money(cashIn-cashOut),allAccountCollections:collections},counts:{bills:bills.length,parties:parties.length,stockVariants:stocks.length}});
    } catch(e){res.status(500).json({error:e.message});}
  });

  // Day-wise Cash vs Online collections between two dates (inclusive).
  // Uses the same original records as the dashboard "Collections" card: cash/online paid on bills
  // (minus the part that came from separately recorded party payments) plus party payments.
  // Dates are bucketed in Indian Standard Time so a bill made late evening is not shifted by the server clock.
  app.get('/api/business-tools/daily-collections', admin, async (req,res) => {
    try {
      const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v||'')) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
      const todayIst = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
      const to = isDate(req.query.to) ? String(req.query.to) : todayIst;
      const from = isDate(req.query.from) ? String(req.query.from) : to.slice(0,8)+'01';
      if (from > to) return res.status(400).json({error:'From date must not be after To date'});
      if ((new Date(`${to}T00:00:00Z`)-new Date(`${from}T00:00:00Z`))/86400000 > 731) return res.status(400).json({error:'Please select a range of 2 years or less'});
      const istDay = d => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date(d));
      const start = new Date(`${from}T00:00:00+05:30`), end = new Date(`${to}T23:59:59.999+05:30`);
      const [bills, payments] = await Promise.all([
        Bill.find({billDate:{$gte:start,$lte:end}}).select('billDate cashPaid onlinePaid allocatedPartyCashPaid allocatedPartyOnlinePaid').lean(),
        PartyPayment.find({paymentDate:{$gte:from,$lte:to}}).select('paymentDate amount paymentMode').lean()
      ]);
      const days = new Map();
      const day = key => { if(!days.has(key)) days.set(key,{date:key,cash:0,online:0,billCash:0,billOnline:0,partyCash:0,partyOnline:0}); return days.get(key); };
      for (const b of bills) {
        const row = day(istDay(b.billDate));
        const cash = Math.max(0, Number(b.cashPaid||0)-Number(b.allocatedPartyCashPaid||0));
        const online = Math.max(0, Number(b.onlinePaid||0)-Number(b.allocatedPartyOnlinePaid||0));
        row.billCash += cash; row.billOnline += online;
      }
      for (const p of payments) {
        const row = day(String(p.paymentDate).slice(0,10)); const amt = Number(p.amount||0);
        if (p.paymentMode === 'Online') row.partyOnline += amt; else row.partyCash += amt;
      }
      const rows = [...days.values()].map(r => ({date:r.date, cash:money(r.billCash+r.partyCash), online:money(r.billOnline+r.partyOnline), total:money(r.billCash+r.partyCash+r.billOnline+r.partyOnline), billCash:money(r.billCash), billOnline:money(r.billOnline), partyCash:money(r.partyCash), partyOnline:money(r.partyOnline)})).sort((a,b)=>b.date.localeCompare(a.date));
      const totals = rows.reduce((t,r)=>({cash:t.cash+r.cash, online:t.online+r.online, total:t.total+r.total}),{cash:0,online:0,total:0});
      res.json({from,to,rows,totals:{cash:money(totals.cash),online:money(totals.online),total:money(totals.total)}});
    } catch(e){res.status(500).json({error:e.message});}
  });

  app.get('/api/business-tools/purchase-prediction', admin, async(req,res)=>{
    try {
      const days=Math.min(180,Math.max(30,Number(req.query.days)||90)); const since=new Date(Date.now()-days*86400000);
      const bills=await Bill.find({billDate:{$gte:since}}).lean(); const parties=await Party.find().lean(); const sums=new Map();
      for(const b of bills){const k=String(b.partyId);sums.set(k,(sums.get(k)||0)+Number(b.todayTotal||0));}
      const rows=[...sums.entries()].map(([partyId,total])=>({partyId,partyName:parties.find(p=>String(p._id)===partyId)?.name||bills.find(b=>String(b.partyId)===partyId)?.partyName||'Unknown',partyCity:parties.find(p=>String(p._id)===partyId)?.city||'',periodPurchase:money(total),averageMonthly:money(total/days*30),next30DayEstimate:money(total/days*30)})).sort((a,b)=>b.next30DayEstimate-a.next30DayEstimate);
      res.json({basedOnDays:days,generatedAt:new Date(),note:'Estimate based on recorded bill totals; not a guaranteed order.',rows});
    }catch(e){res.status(500).json({error:e.message});}
  });

  app.get('/api/business-tools/daily-cash-closing', admin, async(req,res)=>{
    try {
      const date=String(req.query.date||new Date().toISOString().slice(0,10)); const start=new Date(`${date}T00:00:00`), end=new Date(`${date}T23:59:59.999`);
      const [entries,closing,previousClosing]=await Promise.all([CashBookEntry.find({date:{$gte:start,$lte:end}}).lean(),DailyCashClosing.findOne({date}).lean(),DailyCashClosing.findOne({date:{$lt:date}}).sort({date:-1}).lean()]);
      const cashIn=money(entries.filter(x=>x.account==='Cash'&&x.direction==='IN').reduce((n,x)=>n+Number(x.amount||0),0));
      const cashOut=money(entries.filter(x=>x.account==='Cash'&&x.direction==='OUT').reduce((n,x)=>n+Number(x.amount||0),0));
      const openingCash=Number(closing?.openingCash ?? previousClosing?.actualClosing ?? 0); const expectedClosing=money(openingCash+cashIn-cashOut);
      res.json({date,openingCash,cashIn,cashOut,expectedClosing,closing,entries});
    }catch(e){res.status(500).json({error:e.message});}
  });
  app.post('/api/business-tools/daily-cash-closing', admin, async(req,res)=>{
    try {
      const date=String(req.body.date||new Date().toISOString().slice(0,10));
      const start=new Date(`${date}T00:00:00`), end=new Date(`${date}T23:59:59.999`);
      const entries=await CashBookEntry.find({date:{$gte:start,$lte:end}}).lean();
      if (req.body.actualClosing === undefined || req.body.actualClosing === '' || !Number.isFinite(Number(req.body.actualClosing)) || Number(req.body.actualClosing) < 0) return res.status(400).json({error:'Enter the actual counted closing cash amount'});
      const previousClosing = req.body.openingCash === undefined ? await DailyCashClosing.findOne({date:{$lt:date}}).sort({date:-1}).lean() : null;
      const openingCash=money(req.body.openingCash ?? previousClosing?.actualClosing ?? 0); const cashIn=money(entries.filter(x=>x.account==='Cash'&&x.direction==='IN').reduce((n,x)=>n+Number(x.amount||0),0));
      const cashOut=money(entries.filter(x=>x.account==='Cash'&&x.direction==='OUT').reduce((n,x)=>n+Number(x.amount||0),0));
      const expectedClosing=money(openingCash+cashIn-cashOut); const actualClosing=money(req.body.actualClosing);
      const saved=await DailyCashClosing.findOneAndUpdate({date},{$set:{date,openingCash,cashIn,cashOut,expectedClosing,actualClosing,difference:money(actualClosing-expectedClosing),notes:String(req.body.notes||''),closedBy:req.user?.username||'',closedAt:new Date()}},{new:true,upsert:true,setDefaultsOnInsert:true});
      res.json({success:true,closing:saved});
    }catch(e){res.status(400).json({error:e.message});}
  });
  app.get('/api/business-tools/stock-matrix', async (req,res)=>{
    try { const stocks=await Stock.find().sort({articleCode:1,sizeRange:1,color:1}).lean();
      const grouped={}; for(const s of stocks){const k=String(s.articleCode||'').toUpperCase(); if(!grouped[k])grouped[k]={articleCode:s.articleCode,brand:s.brand||'',variants:[],totalPairs:0}; grouped[k].variants.push({id:s._id,sizeRange:s.sizeRange||'',color:s.color||'',totalPairs:Number(s.totalPairs||0),cartons:Number(s.cartons||0),loosePairs:Number(s.loosePairs||0),purchaseRate:Number(s.purchaseRate||0),sellingPrice:Number(s.sellingPrice||0),reorderLevel:Number(s.reorderLevel||0)});grouped[k].totalPairs+=Number(s.totalPairs||0);}
      res.json(Object.values(grouped));
    } catch(e){res.status(500).json({error:e.message});}
  });
  app.get('/api/business-tools/reorder-alerts', async(req,res)=>{try{const rows=await Stock.find().lean();res.json(rows.filter(x=>Number(x.totalPairs||0)<=0||(Number(x.reorderLevel||0)>0&&Number(x.totalPairs||0)<=Number(x.reorderLevel||0))).map(x=>({...x,suggestedOrderQty:Math.max(Number(x.totalPairs||0)<=0?1:0,Number(x.reorderLevel||0)*2-Number(x.totalPairs||0),Number(x.reorderLevel||0))})));}catch(e){res.status(500).json({error:e.message});}});
  app.patch('/api/business-tools/stock/:id/reorder-level', async(req,res)=>{try{const level=Number(req.body.reorderLevel);if(!Number.isFinite(level)||level<0)return res.status(400).json({error:'Reorder level must be zero or more'});const row=await Stock.findByIdAndUpdate(req.params.id,{reorderLevel:level},{new:true});if(!row)return res.status(404).json({error:'Stock variant not found'});res.json(row);}catch(e){res.status(500).json({error:e.message});}});
  app.get('/api/business-tools/stock-movements',async(req,res)=>{try{const f={};if(req.query.articleCode)f.articleCode=new RegExp(String(req.query.articleCode).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');if(req.query.from||req.query.to){f.createdAt={};if(req.query.from)f.createdAt.$gte=new Date(`${req.query.from}T00:00:00`);if(req.query.to)f.createdAt.$lte=new Date(`${req.query.to}T23:59:59`);}res.json(await StockMovement.find(f).sort({createdAt:-1}).limit(Math.min(500,Number(req.query.limit)||200)).lean());}catch(e){res.status(500).json({error:e.message});}});

  app.get('/api/business-tools/cashbook',async(req,res)=>{try{const f={};if(req.query.from||req.query.to){f.date={};if(req.query.from)f.date.$gte=new Date(`${req.query.from}T00:00:00`);if(req.query.to)f.date.$lte=new Date(`${req.query.to}T23:59:59`);}const rows=await CashBookEntry.find(f).sort({date:-1,createdAt:-1}).limit(1000).lean();const summary={cashIn:0,cashOut:0,bankIn:0,bankOut:0,upiIn:0,upiOut:0};for(const x of rows){const k=x.account.toLowerCase()+(x.direction==='IN'?'In':'Out');summary[k]=(summary[k]||0)+Number(x.amount||0);}res.json({rows,summary,net:money(rows.reduce((s,x)=>s+(x.direction==='IN'?1:-1)*Number(x.amount||0),0))});}catch(e){res.status(500).json({error:e.message});}});
  app.post('/api/business-tools/cashbook',async(req,res)=>{try{const amount=money(req.body.amount);if(amount<=0)throw new Error('Amount must be greater than zero');if(!['IN','OUT'].includes(req.body.direction))throw new Error('Select IN or OUT');const row=await CashBookEntry.create({entryNo:no(),date:req.body.date||new Date(),direction:req.body.direction,account:['Cash','Bank','UPI'].includes(req.body.account)?req.body.account:'Cash',category:req.body.category||'General',amount,partyName:req.body.partyName||'',reference:req.body.reference||'',remarks:req.body.remarks||'',createdBy:req.user?.username||''});res.status(201).json(row);}catch(e){res.status(400).json({error:e.message});}});
  app.delete('/api/business-tools/cashbook/:id',admin,async(req,res)=>{try{const row=await CashBookEntry.findOneAndDelete({_id:req.params.id,sourceType:'Manual'});if(!row)return res.status(404).json({error:'Manual entry not found'});res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});

  app.get('/api/business-tools/audit',admin,async(req,res)=>{try{const f={};if(req.query.from||req.query.to){f.createdAt={};if(req.query.from)f.createdAt.$gte=new Date(`${req.query.from}T00:00:00`);if(req.query.to)f.createdAt.$lte=new Date(`${req.query.to}T23:59:59`);}if(req.query.username)f.username=req.query.username;res.json(await AuditLog.find(f).sort({createdAt:-1}).limit(500).lean());}catch(e){res.status(500).json({error:e.message});}});

  app.post('/api/business-tools/assistant',async(req,res)=>{try{const q=String(req.body.question||'').toLowerCase();if(!q.trim())return res.status(400).json({error:'Question is required'});const [parties,stocks,bills,invoices,expenses]=await Promise.all([Party.find().lean(),Stock.find().lean(),Bill.find().lean(),PurchaseInvoice.find().lean(),Expense.find().lean()]);const due=money(parties.reduce((s,p)=>s+Number(p.currentBalance||0),0));const stockValue=money(stocks.reduce((s,x)=>s+Number(x.totalPairs||0)*Number(x.purchaseRate||0),0));const sales=money(bills.reduce((s,b)=>s+Number(b.todayTotal||0),0));const purchase=money(invoices.reduce((s,x)=>s+Number(x.grandTotal||0),0));const exp=money(expenses.reduce((s,x)=>s+Number(x.amount||0),0));let answer;
      if(/stock|inventory|maal/.test(q)){const low=stocks.filter(x=>Number(x.totalPairs||0)<=0||(Number(x.reorderLevel||0)>0&&Number(x.totalPairs||0)<=Number(x.reorderLevel||0)));answer=`Current stock value (purchase cost) is ₹${stockValue.toLocaleString('en-IN')}. ${stocks.length} stock variants are recorded; ${low.length} are at or below their reorder level.`;}
      else if(/party|customer|outstanding|due|lene/.test(q)){const top=[...parties].sort((a,b)=>Number(b.currentBalance||0)-Number(a.currentBalance||0)).slice(0,5);answer=`Total party outstanding is ₹${due.toLocaleString('en-IN')}. Highest balances: ${top.map(p=>`${p.name}: ₹${Number(p.currentBalance||0).toLocaleString('en-IN')}`).join('; ')||'No parties found'}.`;}
      else if(/purchase|supplier|kharid/.test(q)){answer=`Recorded purchase invoice total is ₹${purchase.toLocaleString('en-IN')} across ${invoices.length} invoices.`;}
      else if(/profit|munafa|earning/.test(q)){answer=`Available all-time summary: recorded sales ₹${sales.toLocaleString('en-IN')}, purchase invoices ₹${purchase.toLocaleString('en-IN')}, recorded expenses ₹${exp.toLocaleString('en-IN')}. This is not a reliable net-profit figure because invoice-level COGS, returns, opening stock and expense period matching must be reconciled. Open Reports for the estimated profit calculation.`;}
      else if(/sale|bikri/.test(q)){answer=`Recorded sales total is ₹${sales.toLocaleString('en-IN')} across ${bills.length} bills.`;}
      else answer=`I can answer questions about current stock, low-stock alerts, party outstanding, recorded sales, purchase invoices and profit-report limitations. Try: “Which parties have the highest due?” or “How much stock value do we have?”`;
      res.json({answer,generatedAt:new Date(),scope:'Live ERP database snapshot'});
    }catch(e){res.status(500).json({error:e.message});}});

  const backupModels={parties:Party,articles:Article,stocks:Stock,bills:Bill,dailyCashClosings:DailyCashClosing,partyPayments:PartyPayment,suppliers:Supplier,purchaseOrders:PurchaseOrder,goodsReceipts:GoodsReceipt,purchaseInvoices:PurchaseInvoice,supplierPayments:SupplierPayment,expenses:Expense,stockMovements:StockMovement,cashBook:CashBookEntry,auditLogs:AuditLog};
  app.get('/api/business-tools/automatic-backups',admin,async(req,res)=>{try{res.json(await listAutomaticBackups());}catch(e){res.status(500).json({error:e.message});}});
  app.get('/api/business-tools/automatic-backups/:filename',admin,async(req,res)=>{try{res.json(await readAutomaticBackup(req.params.filename));}catch(e){res.status(404).json({error:e.message});}});

  app.get('/api/business-tools/backup',admin,async(req,res)=>{try{const data={product:'Supergold ERP',formatVersion:1,createdAt:new Date().toISOString(),collections:{}};for(const [key,Model] of Object.entries(backupModels))data.collections[key]=await Model.find().lean();res.setHeader('Content-Disposition',`attachment; filename="supergold-backup-${new Date().toISOString().slice(0,10)}.json"`);res.json(data);}catch(e){res.status(500).json({error:e.message});}});
  app.post('/api/business-tools/restore',admin,async(req,res)=>{try{if(req.body.confirmation!=='RESTORE_SUPERGOLD_BACKUP')return res.status(400).json({error:'Explicit restore confirmation is required'});const backup=req.body.backup;if(backup?.product!=='Supergold ERP'||backup?.formatVersion!==1||!backup.collections||typeof backup.collections!=='object')return res.status(400).json({error:'Unsupported or invalid Supergold backup'});const keys=Object.keys(backupModels);for(const key of keys){if(key==='dailyCashClosings' && backup.collections[key] === undefined) backup.collections[key]=[]; if(!Array.isArray(backup.collections[key]))return res.status(400).json({error:`Backup collection missing or invalid: ${key}`});}for(const key of keys){const Model=backupModels[key];await Model.deleteMany({});if(backup.collections[key].length)await Model.insertMany(backup.collections[key],{ordered:true});}res.json({success:true,message:'Operational data restored. User accounts and login sessions were not changed.'});}catch(e){res.status(500).json({error:`Restore failed: ${e.message}`});}});
}

// Record every successful API mutation without storing request bodies or secrets.
function auditMutationMiddleware(req,res,next){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method)||req.path.startsWith('/auth/'))return next();
  res.on('finish',()=>{if(res.statusCode<400){AuditLog.create({userId:req.user?.id||'',username:req.user?.username||'unknown',role:req.user?.role||'',method:req.method,path:req.originalUrl,statusCode:res.statusCode,ip:req.ip,summary:`${req.method} ${req.path}`}).catch(err=>console.error('Audit log write failed:',err.message));}});
  next();
}
module.exports={registerBusinessToolsRoutes,auditMutationMiddleware};
