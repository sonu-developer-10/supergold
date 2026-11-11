import React, { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, CalendarCheck, IndianRupee, RefreshCw, Save, TrendingUp, Users } from 'lucide-react';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

export default function OwnerDashboard({ API_BASE, apiFetch, parties = [], articles = [] }) {
  const [data, setData] = useState(null);
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [prediction, setPrediction] = useState([]);
  const [cash, setCash] = useState(null);
  const [cashDate, setCashDate] = useState(today());
  const [openingCash, setOpeningCash] = useState('0');
  const [actualClosing, setActualClosing] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [rules, setRules] = useState([{ articleCode: '*', sizeRange: '*', fixedRate: '', discountPercent: '', active: true }]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [billSearch, setBillSearch] = useState('');
  const [billLimit, setBillLimit] = useState(30);

  const load = async () => {
    setLoading(true);
    try {
      const [d, p, c] = await Promise.all([
        apiFetch(`${API_BASE}/business-tools/owner-dashboard?range=${timeFilter}`).then(r => r.json()),
        apiFetch(`${API_BASE}/business-tools/purchase-prediction?days=90`).then(r => r.json()),
        apiFetch(`${API_BASE}/business-tools/daily-cash-closing?date=${cashDate}`).then(r => r.json())
      ]);
      if (d.error) throw new Error(d.error);
      setData(d); setPrediction(p.rows || []); setCash(c);
      if (c.closing) { setOpeningCash(String(c.closing.openingCash || 0)); setActualClosing(String(c.closing.actualClosing || '')); setCashNotes(c.closing.notes || ''); }
      else { setOpeningCash('0'); setActualClosing(''); setCashNotes(''); }
    } catch (e) { setMessage(e.message || 'Dashboard load failed'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [cashDate, timeFilter]);

  useEffect(() => {
    if (!selectedParty) { setRules([{ articleCode: '*', sizeRange: '*', fixedRate: '', discountPercent: '', active: true }]); return; }
    const party = parties.find(p => String(p._id) === String(selectedParty));
    setRules((party?.priceRules || []).length ? party.priceRules.map(r => ({ ...r, fixedRate: r.fixedRate ?? '', discountPercent: r.discountPercent ?? '' })) : [{ articleCode: '*', sizeRange: '*', fixedRate: '', discountPercent: '', active: true }]);
  }, [selectedParty, parties]);

  const saveRates = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/parties/${selectedParty}/price-rules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Rate save failed');
      setMessage('Party-wise rates saved successfully.');
    } catch (e) { setMessage(e.message); }
  };
  const saveClosing = async () => {
    if (actualClosing === '') { setMessage('Please enter the actual counted closing cash.'); return; }
    try {
      const res = await apiFetch(`${API_BASE}/business-tools/daily-cash-closing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: cashDate, openingCash: Number(openingCash || 0), actualClosing: Number(actualClosing || 0), notes: cashNotes }) });
      const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Cash closing failed');
      setMessage(`Cash closing saved. Difference: ${money(result.closing.difference)}`); await load();
    } catch (e) { setMessage(e.message); }
  };

  const filteredBillProfits = (data?.billProfits || []).filter(b => {
    const q = billSearch.trim().toLowerCase();
    return !q || String(b.billNo).includes(q) || String(b.partyName || '').toLowerCase().includes(q);
  });

  const cards = data ? [
    ['Sales', data.sales, IndianRupee], ['Collections', data.collections, IndianRupee], ['Party Outstanding', data.partyOutstanding, Users], ['Stock Value', data.stockValue, Boxes], ['Estimated Net Profit', data.estimatedNetProfit, TrendingUp], ['Low Stock Variants', data.lowStockCount, AlertTriangle, true]
  ] : [];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.25em] text-amber-400 font-black">Owner control centre</p><h1 className="text-2xl md:text-3xl font-black text-white">Smart Business Dashboard</h1><p className="text-xs text-slate-400 mt-1">Mobile-friendly live overview • Admin only</p></div><button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-bold"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> Refresh</button></div>
    {message && <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-3 text-sm text-amber-200">{message}</div>}
    <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900 p-4">
      <div className="flex items-center justify-between gap-2"><h2 className="font-black text-lg flex items-center gap-2"><CalendarCheck size={18} className="text-amber-400"/> Today's Sale</h2><span className="text-xs text-slate-400">{data?.today?.date ? new Date(`${data.today.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span></div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Sale', money(data?.today?.sales)], ['Bills', Number(data?.today?.bills || 0)], ['Pairs sold', Number(data?.today?.pairs || 0)], ['Est. profit', money(data?.today?.profit), Number(data?.today?.profit || 0) < 0]].map(([label, value, neg]) => <div key={label} className="rounded-xl bg-slate-950/70 p-3"><div className="text-xs text-slate-400">{label}</div><div className={`mt-1 text-xl font-black ${neg ? 'text-rose-400' : 'text-white'}`}>{value}</div></div>)}
      </div>
    </section>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
      <span className="mr-2 text-xs font-bold text-slate-400">Financial period:</span>
      {[['ALL','All Time'],['LAST_7_DAYS','Last 7 Days'],['WEEK','This Week'],['MONTH','This Month'],['YEAR','This Year']].map(([value,label])=><button key={value} onClick={()=>setTimeFilter(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${timeFilter===value?'bg-amber-500 text-slate-950':'bg-slate-800 text-slate-300 hover:text-white'}`}>{label}</button>)}
    </div>
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">{cards.map(([label,value,Icon,isCount])=><div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg"><div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-400">{label}</span><Icon size={18} className="text-amber-400"/></div><div className="mt-3 text-xl md:text-2xl font-black text-white">{isCount ? Number(value || 0) : money(value)}</div></div>)}</div>
    {data?.profitIsEstimate && <p className="text-xs text-amber-300/80">Profit is an estimate based on saved bill-line purchase cost snapshots. Historical opening stock, landed costs and all past costs may be incomplete.</p>}
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black text-lg flex items-center gap-2"><TrendingUp size={18} className="text-amber-400"/> Bill-wise profit</h2><p className="text-xs text-slate-400 mt-1">Estimated profit on every bill in the selected period (net bill total − purchase cost of items).</p></div>
        <input value={billSearch} onChange={e=>{setBillSearch(e.target.value);setBillLimit(30);}} placeholder="Search bill no / party" className="w-full sm:w-64 rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"/></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-slate-950 p-2"><small className="text-slate-500">Bills</small><b className="block text-sm">{filteredBillProfits.length}</b></div><div className="rounded-lg bg-slate-950 p-2"><small className="text-slate-500">Sales</small><b className="block text-sm">{money(filteredBillProfits.reduce((n,x)=>n+x.sales,0))}</b></div><div className="rounded-lg bg-slate-950 p-2"><small className="text-slate-500">Profit</small><b className={`block text-sm ${filteredBillProfits.reduce((n,x)=>n+x.profit,0)<0?'text-rose-400':'text-emerald-300'}`}>{money(filteredBillProfits.reduce((n,x)=>n+x.profit,0))}</b></div></div>
      {/* Mobile: cards (no horizontal scroll) */}
      <div className="md:hidden mt-3 space-y-2">{filteredBillProfits.slice(0,billLimit).map(b=><div key={b.billId} className="rounded-xl bg-slate-950/70 p-3"><div className="flex justify-between gap-2"><div className="min-w-0"><b>Bill #{b.billNo}</b><div className="text-xs text-slate-400 truncate">{b.partyName}</div><div className="text-[11px] text-slate-500">{new Date(b.billDate).toLocaleDateString('en-IN')} · {b.pairs} pairs</div></div><div className="text-right"><b className={b.profit<0?'text-rose-400':'text-emerald-300'}>{money(b.profit)}</b><div className="text-xs text-slate-400">{b.marginPercent.toFixed(1)}%</div></div></div><div className="mt-2 flex justify-between text-xs text-slate-400"><span>Sale {money(b.sales)}</span><span>Cost {money(b.cost)}{b.costMissing?' ⚠':''}</span></div></div>)}</div>
      {/* Desktop: table */}
      <div className="hidden md:block mt-3 rounded-xl border border-slate-800 overflow-hidden"><table className="w-full text-left text-sm"><thead className="bg-slate-800/60 text-slate-400 uppercase text-xs"><tr><th className="p-3">Bill</th><th className="p-3">Date</th><th className="p-3">Party</th><th className="p-3 text-right">Pairs</th><th className="p-3 text-right">Sale</th><th className="p-3 text-right">Cost</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Margin</th></tr></thead><tbody className="divide-y divide-slate-800/50">{filteredBillProfits.slice(0,billLimit).map(b=><tr key={b.billId} className="hover:bg-slate-800/30"><td className="p-3 font-bold">#{b.billNo}</td><td className="p-3 text-slate-400">{new Date(b.billDate).toLocaleDateString('en-IN')}</td><td className="p-3 text-slate-200">{b.partyName}</td><td className="p-3 text-right">{b.pairs}</td><td className="p-3 text-right">{money(b.sales)}</td><td className="p-3 text-right text-slate-400">{money(b.cost)}{b.costMissing?' ⚠':''}</td><td className={`p-3 text-right font-bold ${b.profit<0?'text-rose-400':'text-emerald-300'}`}>{money(b.profit)}</td><td className="p-3 text-right">{b.marginPercent.toFixed(1)}%</td></tr>)}</tbody></table></div>
      {!filteredBillProfits.length && <p className="mt-3 text-sm text-slate-500">No bills in this period.</p>}
      {filteredBillProfits.length > billLimit && <button onClick={()=>setBillLimit(v=>v+30)} className="mt-3 w-full rounded-xl bg-slate-800 py-2 text-sm font-bold">Show more ({filteredBillProfits.length - billLimit} remaining)</button>}
      {filteredBillProfits.some(b=>b.costMissing) && <p className="mt-2 text-xs text-amber-300/80">⚠ Purchase cost is not recorded for some items on these bills, so their profit may be overstated.</p>}
    </section>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-black text-lg flex items-center gap-2"><Users size={18} className="text-amber-400"/> Party ranking</h2><div className="mt-3 space-y-2">{(data?.partyRanks || []).map((p,i)=><div key={p.partyId} className="flex justify-between gap-3 rounded-xl bg-slate-950/70 px-3 py-2 text-sm"><span className="text-slate-300">{i+1}. {p.name}<small className="block pl-4 text-xs text-slate-500">{p.city||'City not set'}</small></span><b>{money(p.sales)}</b></div>)}{!data?.partyRanks?.length && <p className="text-sm text-slate-500">No sales in this period.</p>}</div></section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-black text-lg flex items-center gap-2"><AlertTriangle size={18} className="text-amber-400"/> Low stock & reorder suggestions</h2><div className="mt-3 max-h-72 overflow-auto space-y-2">{(data?.lowStock || []).map(x=><div key={x._id} className="flex justify-between gap-3 rounded-xl bg-slate-950/70 px-3 py-2 text-sm"><div><b>{x.articleCode}</b><div className="text-xs text-slate-400">{x.sizeRange} · {x.color || 'No color'} · Available {Number(x.totalPairs || 0)} pairs</div></div><span className="text-amber-300 font-bold">{Number(x.totalPairs || 0) <= 0 ? 'Out of stock' : `Reorder at ${x.reorderLevel}`}</span></div>)}{!data?.lowStock?.length && <p className="text-sm text-slate-500">No low-stock variants. Set reorder levels in Business Tools to detect low positive stock.</p>}</div></section>
    </div>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-black text-lg flex items-center gap-2"><IndianRupee size={18} className="text-amber-400"/> Article profit margin analysis</h2><p className="text-xs text-slate-400 mt-1">Top article-wise sales and estimated gross margin for the selected period.</p><div className="mt-3 grid md:grid-cols-2 gap-2">{(data?.articleMargins || []).map(a=><div key={a.articleCode} className="rounded-xl bg-slate-950/70 p-3"><div className="flex justify-between gap-2"><b>{a.articleCode}</b><span className="text-emerald-300 font-bold">{a.marginPercent.toFixed(1)}%</span></div><div className="mt-1 flex justify-between text-xs text-slate-400"><span>Sales {money(a.sales)}</span><span>Est. profit {money(a.estimatedGrossProfit)}</span></div></div>)}{!data?.articleMargins?.length && <p className="text-sm text-slate-500">No article sales in this period.</p>}</div></section>
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-black text-lg flex items-center gap-2"><TrendingUp size={18} className="text-amber-400"/> Party purchase prediction</h2><p className="text-xs text-slate-400 mt-1">90-day bill history projected to the next 30 days.</p><div className="mt-3 max-h-64 overflow-auto space-y-2">{prediction.slice(0,12).map(p=><div key={p.partyId} className="flex justify-between gap-3 rounded-xl bg-slate-950/70 px-3 py-2 text-sm"><span>{p.partyName}<small className="block text-xs text-slate-500">{p.partyCity||'City not set'}</small></span><b>{money(p.next30DayEstimate)}</b></div>)}{!prediction.length && <p className="text-sm text-slate-500">Purchase history is not yet sufficient.</p>}</div></section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-black text-lg flex items-center gap-2"><CalendarCheck size={18} className="text-amber-400"/> Daily cash closing</h2><label className="mt-3 block text-xs text-slate-400">Closing date</label><input type="date" value={cashDate} onChange={e=>setCashDate(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"/><div className="grid grid-cols-2 gap-2 mt-3"><div><label className="text-xs text-slate-400">Opening cash</label><input type="number" value={openingCash} onChange={e=>setOpeningCash(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2"/></div><div><label className="text-xs text-slate-400">Actual closing cash</label><input type="number" min="0" required value={actualClosing} onChange={e=>setActualClosing(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2"/></div></div><div className="grid grid-cols-3 gap-2 mt-3 text-center"><div className="rounded-lg bg-slate-950 p-2"><small className="text-slate-500">Cash In</small><b className="block text-sm">{money(cash?.cashIn)}</b></div><div className="rounded-lg bg-slate-950 p-2"><small className="text-slate-500">Cash Out</small><b className="block text-sm">{money(cash?.cashOut)}</b></div><div className="rounded-lg bg-slate-950 p-2"><small className="text-slate-500">Expected</small><b className="block text-sm">{money(Number(openingCash||0)+Number(cash?.cashIn||0)-Number(cash?.cashOut||0))}</b></div></div><input value={cashNotes} onChange={e=>setCashNotes(e.target.value)} placeholder="Closing notes (optional)" className="mt-3 w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-sm"/><button onClick={saveClosing} className="mt-3 flex w-full justify-center items-center gap-2 rounded-xl bg-amber-500 text-slate-950 font-black p-3"><Save size={16}/> Save daily closing</button></section>
    </div>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="font-black text-lg flex items-center gap-2"><IndianRupee size={18} className="text-amber-400"/> Party-wise flexible pricing</h2><p className="text-xs text-slate-400 mt-1">Fixed article rate OR percentage discount. Exact article/size rule takes priority over wildcard.</p><div className="mt-3 grid md:grid-cols-[1fr_auto] gap-2"><select value={selectedParty} onChange={e=>setSelectedParty(e.target.value)} className="rounded-lg bg-slate-950 border border-slate-700 p-2"><option value="">Select party to manage rates</option>{parties.map(p=><option key={p._id} value={p._id}>{p.name} {p.city?`(${p.city})`:''}</option>)}</select><button disabled={!selectedParty} onClick={()=>setRules(v=>[...v,{articleCode:'*',sizeRange:'*',fixedRate:'',discountPercent:'',active:true}])} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold disabled:opacity-40">+ Add rule</button></div>{selectedParty && <div className="mt-3 space-y-2">{rules.map((r,i)=><div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-xl bg-slate-950 p-2"><input value={r.articleCode} onChange={e=>setRules(v=>v.map((x,j)=>j===i?{...x,articleCode:e.target.value}:x))} placeholder="Article code or *" className="min-w-0 rounded bg-slate-900 border border-slate-700 p-2 text-sm"/><input value={r.sizeRange} onChange={e=>setRules(v=>v.map((x,j)=>j===i?{...x,sizeRange:e.target.value}:x))} placeholder="Size or *" className="min-w-0 rounded bg-slate-900 border border-slate-700 p-2 text-sm"/><input type="number" value={r.fixedRate} onChange={e=>setRules(v=>v.map((x,j)=>j===i?{...x,fixedRate:e.target.value,discountPercent:''}:x))} placeholder="Fixed rate ₹" className="min-w-0 rounded bg-slate-900 border border-slate-700 p-2 text-sm"/><input type="number" value={r.discountPercent} onChange={e=>setRules(v=>v.map((x,j)=>j===i?{...x,discountPercent:e.target.value,fixedRate:''}:x))} placeholder="Discount %" className="min-w-0 rounded bg-slate-900 border border-slate-700 p-2 text-sm"/><button onClick={()=>setRules(v=>v.filter((_,j)=>j!==i))} className="rounded bg-rose-950 text-rose-300 text-xs font-bold">Remove</button></div>)}<button onClick={saveRates} className="rounded-xl bg-amber-500 text-slate-950 px-5 py-2 font-black">Save party rates</button></div>}</section>
    <p className="text-xs text-slate-500">Smart reorder and purchase prediction are advisory estimates. Confirm supplier lead time, seasonality and current orders before purchasing.</p>
  </div>;
}
