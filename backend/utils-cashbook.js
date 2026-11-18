const CashBookEntry = require('./models/CashBookEntry');
const mapAccount = mode => mode === 'Online' || mode === 'UPI' ? 'UPI' : (mode === 'Bank' || mode === 'Cheque' ? 'Bank' : 'Cash');
async function syncCashEntry({sourceType,sourceId,date,direction,account,category,amount,partyName,reference,remarks,createdBy=''}){
 const id=String(sourceId); const value=Number(amount||0);
 if(value<=0){await CashBookEntry.deleteOne({sourceType,sourceId:id});return null;}
 return CashBookEntry.findOneAndUpdate({sourceType,sourceId:id},{$set:{date:date||new Date(),direction,account:mapAccount(account),category:category||sourceType,amount:Number(value.toFixed(2)),partyName:partyName||'',reference:reference||'',remarks:remarks||'',createdBy}},{$setOnInsert:{entryNo:`SG-CB-${Date.now()}-${Math.floor(Math.random()*10000)}`},upsert:true,new:true});
}
module.exports={syncCashEntry,mapAccount};
