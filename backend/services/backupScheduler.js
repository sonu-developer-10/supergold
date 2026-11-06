const fs = require('fs/promises');
const path = require('path');
const models = {
  parties: require('../models/Party'), articles: require('../models/Article'), stocks: require('../models/Stock'),
  bills: require('../models/Bill'), partyPayments: require('../models/PartyPayment'), suppliers: require('../models/Supplier'),
  purchaseOrders: require('../models/PurchaseOrder'), goodsReceipts: require('../models/GoodsReceipt'), purchaseInvoices: require('../models/PurchaseInvoice'),
  supplierPayments: require('../models/SupplierPayment'), expenses: require('../models/Expense'), stockMovements: require('../models/StockMovement'), cashBook: require('../models/CashBookEntry'), auditLogs: require('../models/AuditLog')
};
const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
let lastBackupDay = '';
async function createDailyBackup(){
  const day=new Date().toISOString().slice(0,10); if(lastBackupDay===day)return null;
  await fs.mkdir(backupDir,{recursive:true});
  const collections={}; for(const [key,Model] of Object.entries(models))collections[key]=await Model.find().lean();
  const payload={product:'Supergold ERP',formatVersion:1,createdAt:new Date().toISOString(),automatic:true,collections};
  const filename=`supergold-auto-${day}.json`; const target=path.join(backupDir,filename);
  await fs.writeFile(target,JSON.stringify(payload),{encoding:'utf8',mode:0o600});
  lastBackupDay=day;
  const files=(await fs.readdir(backupDir)).filter(x=>/^supergold-auto-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort();
  for(const old of files.slice(0,Math.max(0,files.length-30)))await fs.unlink(path.join(backupDir,old)).catch(()=>{});
  return {filename,createdAt:payload.createdAt,collections:Object.fromEntries(Object.entries(collections).map(([k,v])=>[k,v.length]))};
}
function startBackupScheduler(){
  const run=()=>createDailyBackup().then(x=>{if(x)console.log('Automatic Supergold backup created:',x.filename);}).catch(e=>console.error('Automatic backup failed:',e.message));
  run(); setInterval(run,60*60*1000).unref();
}
async function listAutomaticBackups(){await fs.mkdir(backupDir,{recursive:true});const files=(await fs.readdir(backupDir)).filter(x=>/^supergold-auto-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().reverse();return Promise.all(files.map(async filename=>{const stat=await fs.stat(path.join(backupDir,filename));return{filename,size:stat.size,createdAt:stat.mtime.toISOString()};}));}
async function readAutomaticBackup(filename){if(!/^supergold-auto-\d{4}-\d{2}-\d{2}\.json$/.test(filename))throw new Error('Invalid backup filename');return JSON.parse(await fs.readFile(path.join(backupDir,filename),'utf8'));}
module.exports={startBackupScheduler,listAutomaticBackups,readAutomaticBackup};
