import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, LayoutDashboard, Receipt, Package, Users, Tag, 
  Plus, Printer, ArrowLeft, Trash2, ShoppingBag, DollarSign, Wallet,
  UserCheck, Filter, Edit, Share2, Download, CheckSquare, Square, Send,
  Calendar, CheckCircle, XCircle, Clock, FileText, CreditCard
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_BASE = 'https://supergold-backend.onrender.com/api'; // ye new dala hai

const DEFAULT_SIZE_RANGES = [
  '6*10 (Gents)', '6*9 (Gents)', '7*10 (Gents)', 
  '1*5 (Kids/Boys)', '11*1 (Kids)', '4*7 (Ladies)', 
  '5*8 (Ladies)', '8*11 (Kids)', '9*1 (Kids)', '11*3 (Kids)'
];

export default function App() {
  const [route, setRoute] = useState(window.location.hash || '#staff-billing');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedBillId, setSelectedBillId] = useState(null);

  const [parties, setParties] = useState([]);
  const [articles, setArticles] = useState([]);
  const [bills, setBills] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [sizeRanges, setSizeRanges] = useState(DEFAULT_SIZE_RANGES);

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#staff-billing');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = () => {
    fetchParties();
    fetchArticles();
    fetchBills();
    fetchStocks();
    fetchStaff();
  };

  const fetchParties = () => fetch(`${API_BASE}/parties`).then(r => r.json()).then(d => setParties(Array.isArray(d) ? d : []));
  const fetchArticles = () => fetch(`${API_BASE}/articles`).then(r => r.json()).then(d => setArticles(Array.isArray(d) ? d : []));
  const fetchBills = () => fetch(`${API_BASE}/bills`).then(r => r.json()).then(d => setBills(Array.isArray(d) ? d : []));
  const fetchStocks = () => fetch(`${API_BASE}/stock`).then(r => r.json()).then(d => setStocks(Array.isArray(d) ? d : []));
  const fetchStaff = () => fetch(`${API_BASE}/staff`).then(r => r.json()).then(d => setStaffList(Array.isArray(d) ? d : []));

  const handleOpenInvoice = (billId) => {
    setSelectedBillId(billId);
    if (route === '#admin') {
      setActiveTab('invoiceView');
    } else {
      window.location.hash = `#invoice-${billId}`;
    }
  };

  const isStaffRoute = route === '#staff-billing' || route === '' || route === '#/';
  const isSingleInvoiceRoute = route.startsWith('#invoice-');

  if (isSingleInvoiceRoute) {
    const invoiceId = route.replace('#invoice-', '');
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans text-slate-100 flex justify-center items-center">
        <div className="w-full max-w-3xl flex justify-center">
          <InvoiceView billId={invoiceId} bills={bills} parties={parties} onBack={() => { window.location.hash = '#staff-billing'; }} />
        </div>
      </div>
    );
  }

  // STAFF VIEW
  if (isStaffRoute) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 text-white px-6 py-4 flex justify-between items-center shadow-lg sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-amber-500 to-yellow-600 p-2.5 rounded-xl shadow-md">
              <ShoppingBag className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wider text-amber-400">SUPER GOLD FOOTWEARS</h2>
              <span className="text-xs font-semibold text-slate-400">Staff Billing Terminal</span>
            </div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Terminal Active
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-6">
          <BillingTab 
            parties={parties} 
            articles={articles} 
            sizeRanges={sizeRanges}
            setSizeRanges={setSizeRanges}
            onBillCreated={fetchAllData} 
            onViewInvoice={handleOpenInvoice} 
            onRefreshParties={fetchParties}
            isStaffMode={true}
          />
        </main>
      </div>
    );
  }

  // ADMIN VIEW
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-500 to-yellow-600 p-2.5 rounded-xl shadow-md">
            <Building2 className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-wider text-amber-400">SUPER GOLD ERP</h2>
            <span className="text-xs font-semibold text-slate-400">Admin Control Panel</span>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'billing', label: 'Create Bill', icon: Receipt },
            { id: 'articles', label: 'Articles', icon: Tag },            
            { id: 'stock', label: 'Stock', icon: Package },
            { id: 'parties', label: 'Parties', icon: Users },            
            { id: 'staff', label: 'Staff & Expenses', icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  active ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
          <a href="#staff-billing" className="ml-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-800/60 hover:bg-amber-900/50 transition flex items-center gap-1">
            Staff View →
          </a>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {activeTab === 'dashboard' && <AdminDashboard bills={bills} parties={parties} stocks={stocks} articles={articles} onViewInvoice={handleOpenInvoice} onRefreshBills={fetchBills} />}
        {activeTab === 'billing' && (
          <BillingTab 
            parties={parties} 
            articles={articles} 
            sizeRanges={sizeRanges}
            setSizeRanges={setSizeRanges}
            onBillCreated={fetchAllData} 
            onViewInvoice={handleOpenInvoice} 
            onRefreshParties={fetchParties}
            isStaffMode={false}
          />
        )}
        {activeTab === 'stock' && <StockInwardTab articles={articles} stocks={stocks} sizeRanges={sizeRanges} setSizeRanges={setSizeRanges} onStockUpdated={fetchAllData} />}
        {activeTab === 'parties' && <PartiesTab parties={parties} onPartyAdded={fetchParties} />}
        {activeTab === 'articles' && <ArticlesTab articles={articles} stocks={stocks} sizeRanges={sizeRanges} setSizeRanges={setSizeRanges} onArticleAdded={fetchAllData} />}
        {activeTab === 'staff' && <StaffTab staffList={staffList} onStaffUpdated={fetchStaff} />}
        {activeTab === 'invoiceView' && (
          <div className="flex justify-center w-full my-4">
            <InvoiceView billId={selectedBillId} bills={bills} parties={parties} onBack={() => setActiveTab('dashboard')} />
          </div>
        )}
      </main>
    </div>
  );
}

// ==================== DASHBOARD WITH EDIT / DELETE BILLS ====================
function AdminDashboard({ bills, parties, stocks, articles, onViewInvoice, onRefreshBills }) {
  const [timeFilter, setTimeFilter] = useState('ALL');

  const filteredBills = bills.filter(b => {
    if (timeFilter === 'ALL') return true;
    const bDate = new Date(b.billDate || Date.now());
    const now = new Date();
    if (timeFilter === 'WEEK') {
      const oneWeekAgo = new Date(now.setDate(now.getDate() - 7));
      return bDate >= oneWeekAgo;
    }
    if (timeFilter === 'MONTH') {
      return bDate.getMonth() === new Date().getMonth() && bDate.getFullYear() === new Date().getFullYear();
    }
    if (timeFilter === 'YEAR') {
      return bDate.getFullYear() === new Date().getFullYear();
    }
    return true;
  });

  const totalSales = filteredBills.reduce((sum, b) => sum + (b.todayTotal || 0), 0);
  const totalCash = filteredBills.reduce((sum, b) => sum + (b.cashPaid || 0), 0);
  const totalOnline = filteredBills.reduce((sum, b) => sum + (b.onlinePaid || 0), 0);
  const totalReceived = totalCash + totalOnline;
  const totalDue = parties.reduce((sum, p) => sum + (p.currentBalance || 0), 0);
  const totalStockPairs = stocks.reduce((sum, s) => sum + (s.totalPairs || 0), 0);

  const handleDeleteBill = async (id) => {
    if (window.confirm('Kya aap bill delete karna chahte hain?')) {
      try {
        const res = await fetch(`${API_BASE}/bills/${id}`, { method: 'DELETE' });
        if (res.ok) {
          alert('Bill deleted!');
          onRefreshBills();
        }
      } catch (err) { alert('Error deleting bill'); }
    }
  };

  const handleEditBill = async (b) => {
    const newAmount = prompt("Enter New Bill Total Amount (₹):", b.todayTotal);
    if (newAmount !== null) {
      try {
        const res = await fetch(`${API_BASE}/bills/${b._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ todayTotal: parseFloat(newAmount || 0) })
        });
        if (res.ok) {
          alert('Bill updated successfully!');
          onRefreshBills();
        }
      } catch (err) { alert('Error updating bill'); }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <h3 className="text-sm font-extrabold text-slate-300 flex items-center gap-2">
          <Filter className="w-4 h-4 text-amber-400" /> Filter Financial Reports:
        </h3>
        <div className="flex gap-2">
          {['ALL', 'WEEK', 'MONTH', 'YEAR'].map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                timeFilter === f ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f === 'ALL' ? 'All Time' : f === 'WEEK' ? 'This Week' : f === 'MONTH' ? 'This Month' : 'This Year'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-extrabold">Sales ({timeFilter})</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">₹{totalSales.toLocaleString()}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-extrabold">Received Collection</span>
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">₹{totalReceived.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Cash: ₹{totalCash} | Online: ₹{totalOnline}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-extrabold">Total Dues (Lene Hain)</span>
            <Users className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">₹{totalDue.toLocaleString()}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-extrabold">Godown Stock</span>
            <Package className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalStockPairs} Pairs</div>
          <div className="text-xs text-slate-400 mt-1">{articles.length} Active Articles</div>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-400" /> Invoices Register
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-3">Bill No</th>
                <th className="p-3">Date</th>
                <th className="p-3">Party Name</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Paid</th>
                <th className="p-3">Due</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredBills.map((b) => (
                <tr key={b._id} className="hover:bg-slate-800/30">
                  <td className="p-3 font-bold text-white">#{b.billNo}</td>
                  <td className="p-3 text-slate-400">{new Date(b.billDate || Date.now()).toLocaleDateString()}</td>
                  <td className="p-3 font-semibold text-slate-200">{b.partyName}</td>
                  <td className="p-3 font-bold text-amber-300">₹{b.todayTotal}</td>
                  <td className="p-3 text-emerald-400 font-bold">₹{b.amountPaid}</td>
                  <td className="p-3 text-rose-400 font-bold">₹{b.dueBalance}</td>
                  <td className="p-3 text-center flex justify-center gap-2">
                    <button onClick={() => onViewInvoice(b._id)} className="bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition">
                      View
                    </button>
                    <button onClick={() => handleEditBill(b)} className="bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-lg text-xs font-bold transition">
                      Edit
                    </button>
                    <button onClick={() => handleDeleteBill(b._id)} className="bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white px-2.5 py-1 rounded-lg text-xs font-bold transition">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== BILLING TERMINAL ====================
function BillingTab({ parties, articles, sizeRanges, setSizeRanges, onBillCreated, onViewInvoice, onRefreshParties, isStaffMode }) {
  const [selectedParty, setSelectedParty] = useState('');
  const [partyInfo, setPartyInfo] = useState(null);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showCustomSizeModal, setShowCustomSizeModal] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState('');

  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyCity, setNewPartyCity] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');

  const [discountAmount, setDiscountAmount] = useState('0');

  const [items, setItems] = useState([
    { articleCode: '', isCustom: false, size: '6*9 (Gents)', color: '', cartons: 0, loosePairs: 0, totalPairs: 0, rate: 0, totalAmount: 0 }
  ]);

  const [returnItems, setReturnItems] = useState([]);

  const [cashPaid, setCashPaid] = useState('');
  const [onlinePaid, setOnlinePaid] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');

  const handlePartyDropdownChange = (e) => {
    const val = e.target.value;
    if (val === 'ADD_NEW_PARTY_MODAL') {
      setShowPartyModal(true);
    } else {
      setSelectedParty(val);
      const p = parties.find((party) => party._id === val);
      setPartyInfo(p || null);
    }
  };

  const handleQuickAddParty = async (e) => {
    e.preventDefault();
    if (!newPartyName.trim()) return alert('Party Name Required!');

    try {
      const res = await fetch(`${API_BASE}/parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPartyName, city: newPartyCity, phone: newPartyPhone, openingBalance: 0 })
      });
      if (res.ok) {
        const createdParty = await res.json();
        setShowPartyModal(false);
        setNewPartyName(''); setNewPartyCity(''); setNewPartyPhone('');
        await onRefreshParties();
        setSelectedParty(createdParty._id);
        setPartyInfo(createdParty);
      }
    } catch (err) { alert('Error adding party'); }
  };

  const handleSizeDropdownChange = (idx, e, isReturn = false) => {
    const val = e.target.value;
    if (val === 'ADD_CUSTOM_SIZE_RANGE') {
      setShowCustomSizeModal(true);
    } else {
      if (isReturn) {
        handleReturnItemChange(idx, 'size', val);
      } else {
        handleItemChange(idx, 'size', val);
      }
    }
  };

  const handleAddCustomSize = () => {
    if (!customSizeInput.trim()) return;
    const newSz = customSizeInput.trim();
    if (!sizeRanges.includes(newSz)) setSizeRanges([...sizeRanges, newSz]);
    setCustomSizeInput('');
    setShowCustomSizeModal(false);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const cur = { ...updated[index], [field]: value };

    if (field === 'articleCode') {
      if (value === 'ADD_CUSTOM_ARTICLE') {
        cur.isCustom = true;
        cur.articleCode = '';
      } else {
        const art = articles.find((a) => a.articleCode === value);
        if (art) {
          cur.color = art.color || '';
          cur.size = art.sizeRange || cur.size;
          cur.rate = art.sellingPrice || art.wholesaleRate || 0;
        }
      }
    }

    const cartons = parseInt(cur.cartons || 0);
    const loose = parseInt(cur.loosePairs || 0);
    cur.totalPairs = cartons * 12 + loose;
    cur.totalAmount = cur.totalPairs * parseFloat(cur.rate || 0);

    updated[index] = cur;
    setItems(updated);
  };

  const handleReturnItemChange = (index, field, value) => {
    const updated = [...returnItems];
    const cur = { ...updated[index], [field]: value };

    if (field === 'articleCode') {
      if (value === 'ADD_CUSTOM_ARTICLE') {
        cur.isCustom = true;
        cur.articleCode = '';
      } else {
        const art = articles.find((a) => a.articleCode === value);
        if (art) {
          cur.color = art.color || '';
          cur.size = art.sizeRange || cur.size;
          cur.rate = art.sellingPrice || art.wholesaleRate || 0;
        }
      }
    }

    const cartons = parseInt(cur.cartons || 0);
    const loose = parseInt(cur.loosePairs || 0);
    cur.totalPairs = cartons * 12 + loose;
    cur.totalAmount = cur.totalPairs * parseFloat(cur.rate || 0);

    updated[index] = cur;
    setReturnItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { articleCode: '', isCustom: false, size: '6*9 (Gents)', color: '', cartons: 0, loosePairs: 0, totalPairs: 0, rate: 0, totalAmount: 0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const addReturnItemRow = () => {
    setReturnItems([...returnItems, { articleCode: '', isCustom: false, size: '6*9 (Gents)', color: '', cartons: 0, loosePairs: 0, totalPairs: 0, rate: 0, totalAmount: 0 }]);
  };

  const removeReturnItemRow = (index) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const rawTotal = items.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const returnTotal = returnItems.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const discountVal = parseFloat(discountAmount || 0);
  
  const todayTotal = Math.max(0, rawTotal - returnTotal - discountVal);
  const previousBalance = partyInfo ? (partyInfo.currentBalance || 0) : 0;
  const grandTotal = todayTotal + previousBalance;
  const totalPaid = parseFloat(cashPaid || 0) + parseFloat(onlinePaid || 0) + parseFloat(advancePaid || 0);
  const dueBalance = grandTotal - totalPaid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedParty) return alert('Kripya Party select karein!');

    const payload = {
      partyId: selectedParty,
      partyName: partyInfo ? partyInfo.name : '',
      items,
      returnItems,
      rawTotal,
      returnTotal,
      discountVal,
      todayTotal,
      previousBalance,
      cashPaid: parseFloat(cashPaid || 0),
      onlinePaid: parseFloat(onlinePaid || 0),
      advancePaid: parseFloat(advancePaid || 0),
      amountPaid: totalPaid,
      dueBalance
    };

    try {
      const res = await fetch(`${API_BASE}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const savedBill = await res.json();
        onBillCreated();
        onViewInvoice(savedBill._id);
      }
    } catch (err) { alert('Error saving bill'); }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <h3 className="text-lg font-black text-white flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-400" />Order Bill
        </h3>
        <button type="button" onClick={() => setShowPartyModal(true)} className="bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add New Party
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Select Wholesale Party *</label>
            <select className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-semibold" value={selectedParty} onChange={handlePartyDropdownChange} required>
              <option value="">-- Choose Party --</option>
              <option value="ADD_NEW_PARTY_MODAL" className="bg-amber-900 text-amber-200 font-bold">➕ + Add New Party...</option>
              {parties.map((p) => (
                <option key={p._id} value={p._id}>{p.name} {p.city ? `(${p.city})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Previous Ledger Due</label>
            <input className="w-full p-3 bg-rose-950/30 border border-rose-800/50 text-rose-400 font-black rounded-xl text-sm" value={`₹${previousBalance}`} readOnly disabled />
          </div>
        </div>

        {/* ORDER ITEMS */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-400" /> Order Item
          </h4>
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/50">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/70 text-slate-300 uppercase text-xs font-extrabold border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Article Code</th>
                  <th className="p-3.5">Size Range</th>
                  <th className="p-3.5">Color</th>
                  <th className="p-3.5">Cartons (Peti)</th>
                  <th className="p-3.5">Loose Pairs</th>
                  <th className="p-3.5">Total Pairs</th>
                  <th className="p-3.5">Rate (₹)</th>
                  <th className="p-3.5">Amount (₹)</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5">
                      {item.isCustom ? (
                        <div className="flex gap-1">
                          <input 
                            className="w-full p-2 bg-slate-800 border border-amber-500 rounded-lg text-sm text-amber-300 uppercase font-bold" 
                            placeholder="Enter Article" 
                            value={item.articleCode} 
                            onChange={(e) => handleItemChange(idx, 'articleCode', e.target.value.toUpperCase())} 
                            required 
                          />
                          <button 
                            type="button" 
                            onClick={() => handleItemChange(idx, 'isCustom', false)} 
                            className="text-xs text-slate-400 hover:text-white px-1"
                            title="Back to Dropdown"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <select className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold" value={item.articleCode} onChange={(e) => handleItemChange(idx, 'articleCode', e.target.value)} required>
                          <option value="">-- Article --</option>
                          {articles.map((a) => <option key={a._id} value={a.articleCode}>{a.articleCode}</option>)}
                          <option value="ADD_CUSTOM_ARTICLE" className="bg-amber-900 text-amber-200 font-bold">✍️ + Enter Custom Article Code...</option>
                        </select>
                      )}
                    </td>
                    <td className="p-2.5">
                      <select className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" value={item.size} onChange={(e) => handleSizeDropdownChange(idx, e, false)}>
                        {sizeRanges.map((sz, sIdx) => <option key={sIdx} value={sz}>{sz}</option>)}
                        <option value="ADD_CUSTOM_SIZE_RANGE" className="bg-amber-900 text-amber-200 font-bold">➕ + Add Custom Size...</option>
                      </select>
                    </td>
                    <td className="p-2.5"><input className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" placeholder="Optional" value={item.color} onChange={(e) => handleItemChange(idx, 'color', e.target.value)} /></td>
                    <td className="p-2.5"><input className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" type="number" placeholder="0" value={item.cartons} onChange={(e) => handleItemChange(idx, 'cartons', e.target.value)} /></td>
                    <td className="p-2.5"><input className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" type="number" placeholder="0" value={item.loosePairs} onChange={(e) => handleItemChange(idx, 'loosePairs', e.target.value)} /></td>
                    <td className="p-2.5 font-black text-amber-300">{item.totalPairs} Pr</td>
                    <td className="p-2.5"><input className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold" type="number" placeholder="Rate" value={item.rate} onChange={(e) => handleItemChange(idx, 'rate', e.target.value)} required /></td>
                    <td className="p-2.5 font-black text-amber-400">₹{item.totalAmount}</td>
                    <td className="p-2.5 text-center">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItemRow(idx)} className="text-rose-400 hover:text-rose-300 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addItemRow} className="text-xs bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-xl font-bold">
            + Add Another Sale Article
          </button>
        </div>

        {/* RETURN ITEMS */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <button type="button" onClick={addReturnItemRow} className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-500 hover:text-slate-950 transition flex items-center gap-1">
              + Add Return Item
            </button>
          </div>

          {returnItems.length > 0 ? (
            <div className="overflow-x-auto border border-amber-900/40 rounded-2xl bg-amber-950/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-amber-950/40 text-amber-200 uppercase text-xs font-extrabold border-b border-amber-900/40">
                  <tr>
                    <th className="p-3.5">Article Code</th>
                    <th className="p-3.5">Size Range</th>
                    <th className="p-3.5">Color</th>
                    <th className="p-3.5">Cartons (Peti)</th>
                    <th className="p-3.5">Loose Pairs</th>
                    <th className="p-3.5">Total Pairs</th>
                    <th className="p-3.5">Return Rate (₹)</th>
                    <th className="p-3.5">Return Amount (₹)</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-900/30">
                  {returnItems.map((rItem, rIdx) => (
                    <tr key={rIdx}>
                      <td className="p-2.5">
                        {rItem.isCustom ? (
                          <div className="flex gap-1">
                            <input 
                              className="w-full p-2 bg-slate-800 border border-amber-500 rounded-lg text-sm text-amber-300 uppercase font-bold" 
                              placeholder="Enter Article" 
                              value={rItem.articleCode} 
                              onChange={(e) => handleReturnItemChange(rIdx, 'articleCode', e.target.value.toUpperCase())} 
                              required 
                            />
                            <button 
                              type="button" 
                              onClick={() => handleReturnItemChange(rIdx, 'isCustom', false)} 
                              className="text-xs text-slate-400 hover:text-white px-1"
                              title="Back to Dropdown"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <select className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold" value={rItem.articleCode} onChange={(e) => handleReturnItemChange(rIdx, 'articleCode', e.target.value)} required>
                            <option value="">-- Article --</option>
                            {articles.map((a) => <option key={a._id} value={a.articleCode}>{a.articleCode}</option>)}
                            <option value="ADD_CUSTOM_ARTICLE" className="bg-amber-900 text-amber-200 font-bold">✍️ + Enter Custom Article Code...</option>
                          </select>
                        )}
                      </td>
                      <td className="p-2.5">
                        <select className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" value={rItem.size} onChange={(e) => handleSizeDropdownChange(rIdx, e, true)}>
                          {sizeRanges.map((sz, sIdx) => <option key={sIdx} value={sz}>{sz}</option>)}
                          <option value="ADD_CUSTOM_SIZE_RANGE" className="bg-amber-900 text-amber-200 font-bold">➕ + Add Custom Size...</option>
                        </select>
                      </td>
                      <td className="p-2.5"><input className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" placeholder="Color" value={rItem.color} onChange={(e) => handleReturnItemChange(rIdx, 'color', e.target.value)} /></td>
                      <td className="p-2.5"><input className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" type="number" placeholder="0" value={rItem.cartons} onChange={(e) => handleReturnItemChange(rIdx, 'cartons', e.target.value)} /></td>
                      <td className="p-2.5"><input className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" type="number" placeholder="0" value={rItem.loosePairs} onChange={(e) => handleReturnItemChange(rIdx, 'loosePairs', e.target.value)} /></td>
                      <td className="p-2.5 font-black text-amber-300">{rItem.totalPairs} Pr</td>
                      <td className="p-2.5"><input className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold" type="number" placeholder="Rate" value={rItem.rate} onChange={(e) => handleReturnItemChange(rIdx, 'rate', e.target.value)} required /></td>
                      <td className="p-2.5 font-black text-amber-400">- ₹{rItem.totalAmount}</td>
                      <td className="p-2.5 text-center">
                        <button type="button" onClick={() => removeReturnItemRow(rIdx)} className="text-rose-400 hover:text-rose-300 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
              Click above "+ Add Return Item" to return items.
            </div>
          )}
        </div>

        {/* BILL CALCULATIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-800/40 p-5 rounded-2xl border border-slate-800">
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Payment & Discounts</h4>
            <div>
              <label className="block text-xs text-slate-300 mb-1 font-bold">Extra Discount (₹)</label>
              <input className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-amber-400 font-bold" type="number" placeholder="0" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-bold">Advance Paid (₹)</label>
                <input className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-purple-400 font-bold" type="number" placeholder="0" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-bold">Cash Received (₹)</label>
                <input className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-emerald-400 font-bold" type="number" placeholder="0" value={cashPaid} onChange={(e) => setCashPaid(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-bold">Online Received (₹)</label>
                <input className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sky-400 font-bold" type="number" placeholder="0" value={onlinePaid} onChange={(e) => setOnlinePaid(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-center space-y-2">
            <div className="flex justify-between text-xs text-slate-400"><span>Sale Subtotal:</span><span>₹{rawTotal}</span></div>
            {returnTotal > 0 && (
              <div className="flex justify-between text-xs text-amber-400 font-bold"><span>Less Return Deduction:</span><span>- ₹{returnTotal}</span></div>
            )}
            <div className="flex justify-between text-xs text-purple-400"><span>Discount:</span><span>- ₹{discountVal}</span></div>
            <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-1">
              <span>Today Bill Net Total:</span>
              <span className="text-amber-400 text-lg font-black">₹{todayTotal}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-400 font-bold"><span>Total Payment Received:</span><span>₹{totalPaid}</span></div>
            <hr className="border-slate-800" />
            <div className="flex justify-between text-base font-black text-rose-400"><span>Final Net Due:</span><span>₹{dueBalance}</span></div>
          </div>
        </div>

        <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black py-4 rounded-2xl shadow-xl text-base">
          🖨️ Save Bill & Open Printable Invoice
        </button>
      </form>

      {showPartyModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-lg font-black text-white mb-4">Add New Wholesale Party</h3>
            <form onSubmit={handleQuickAddParty} className="space-y-3">
              <div><label className="block text-xs font-bold text-slate-300 mb-1">Party Name *</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="e.g. Verma Footwear" value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} required /></div>
              <div><label className="block text-xs font-bold text-slate-300 mb-1">City / Location</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="e.g. Hazaribagh" value={newPartyCity} onChange={(e) => setNewPartyCity(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-300 mb-1">Phone Number</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Mobile No." value={newPartyPhone} onChange={(e) => setNewPartyPhone(e.target.value)} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPartyModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">Save Party</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCustomSizeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-black text-white mb-3">Add Custom Size Range</h3>
            <input className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold mb-4" placeholder="e.g. 2*5 (Kids)" value={customSizeInput} onChange={(e) => setCustomSizeInput(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCustomSizeModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button>
              <button onClick={handleAddCustomSize} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">Add Size</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== INVOICE PRINT & MULTI-WHATSAPP SHARE VIEW WITH PDF ====================
function InvoiceView({ billId, bills, parties, onBack }) {
  const bill = bills.find((b) => b._id === billId);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const invoiceRef = useRef(null);

  if (!bill) return <div className="text-white text-center p-10">Bill not found!</div>;

  const currentParty = parties.find(p => p._id === bill.partyId || p.name === bill.partyName);

  // Generate PDF Invoice
  const handleDownloadPdf = async () => {
    if (!invoiceRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice_${bill.billNo || 'SuperGold'}.pdf`);
    } catch (err) {
      alert('Error generating PDF download');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Generate Professional Invoice Text
  const buildInvoiceMessage = () => {
    let itemsListText = '';
    if (bill.items && bill.items.length > 0) {
      itemsListText += `*📦 Items Purchased:*\n`;
      bill.items.forEach((item, i) => {
        itemsListText += `${i + 1}. *${item.articleCode}* (${item.size}) - ${item.totalPairs} Pairs @ ₹${item.rate} = *₹${item.totalAmount}*\n`;
      });
    }

    if (bill.returnItems && bill.returnItems.length > 0) {
      itemsListText += `\n*🔄 Return Items:*\n`;
      bill.returnItems.forEach((item, i) => {
        itemsListText += `${i + 1}. *${item.articleCode}* - ${item.totalPairs} Pairs @ ₹${item.rate} = *-₹${item.totalAmount}*\n`;
      });
    }

    return `*🏢 SUPER GOLD FOOTWEARS*
----------------------------------------
📄 *TAX INVOICE / BILL DETAILS*
----------------------------------------
*Invoice No:* #${bill.billNo}
*Date:* ${new Date(bill.billDate || Date.now()).toLocaleDateString()}
*Customer Name:* ${bill.partyName}

${itemsListText}
----------------------------------------
*Subtotal:* ₹${bill.rawTotal}
${bill.returnTotal > 0 ? `*Return Adjustment:* -₹${bill.returnTotal}\n` : ''}${bill.discountVal > 0 ? `*Discount:* -₹${bill.discountVal}\n` : ''}*Today Bill Total:* ₹${bill.todayTotal}
*Previous Balance:* ₹${bill.previousBalance}
----------------------------------------
*Amount Paid:* ₹${bill.amountPaid}
*Net Balance Due:* ₹${bill.dueBalance}
----------------------------------------
*Status:* ${bill.dueBalance <= 0 ? '✅ PAID' : '❌ DUE / UNPAID'}

Thank you for doing business with us! 
_SUPER GOLD FOOTWEARS - Quality & Trust_`;
  };

  const handleOpenMultiShare = () => {
    setShowShareModal(true);
    if (currentParty && currentParty.phone) {
      const formatted = currentParty.phone.replace(/[^0-9]/g, '');
      if (formatted) setSelectedPhones([formatted]);
    }
  };

  const toggleSelectPhone = (phone) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return;
    if (selectedPhones.includes(cleanPhone)) {
      setSelectedPhones(selectedPhones.filter(p => p !== cleanPhone));
    } else {
      setSelectedPhones([...selectedPhones, cleanPhone]);
    }
  };

  const handleSendToSelected = (phone) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const message = encodeURIComponent(buildInvoiceMessage());
    window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`, '_blank');
  };

  const handleOpenGeneralWhatsApp = () => {
    const message = encodeURIComponent(buildInvoiceMessage());
    window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
  };

  return (
    <div>
      <button onClick={onBack} className="text-lg font-bold text-slate-500 hover:text-white flex items-center gap-1 justify-center ml-auto mb-2">
        ✕
      </button>

      <div ref={invoiceRef} className="bg-white text-slate-900 p-8 rounded-2xl max-w-3xl w-full shadow-2xl space-y-6 mx-auto relative">
        <div className="flex justify-between items-start border-b pb-4">
          <div>
            <h1 className="text-2xl font-black text-amber-600">SUPER GOLD FOOTWEARS</h1>
            <p className="text-xs text-slate-500">Wholesale Footwear Merchant & Distributor</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-extrabold text-slate-800">INVOICE #{bill.billNo}</h2>
            <p className="text-xs text-slate-500">Date: {new Date(bill.billDate || Date.now()).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="font-bold text-slate-500 block">Billed To:</span>
            <span className="font-black text-slate-800 text-sm">{bill.partyName}</span>
            {currentParty && currentParty.phone && (
              <span className="block text-slate-500 font-semibold">Phone: {currentParty.phone}</span>
            )}
          </div>
          <div className="text-right">
            <span className="font-bold text-slate-500 block">Status:</span>
            <span className={`font-black uppercase ${bill.dueBalance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {bill.dueBalance <= 0 ? 'PAID' : 'DUE / UNPAID'}
            </span>
          </div>
        </div>

        {/* SOLD ITEMS */}
        <div>
          <h4 className="text-xs font-black uppercase text-amber-800 mb-2">Sold Items</h4>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-amber-50 text-amber-900 font-bold border-b">
                <th className="p-2">Article</th>
                <th className="p-2">Size</th>
                <th className="p-2">Cartons</th>
                <th className="p-2">Pairs</th>
                <th className="p-2">Rate</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items && bill.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-2 font-bold">{item.articleCode}</td>
                  <td className="p-2">{item.size}</td>
                  <td className="p-2">{item.cartons}</td>
                  <td className="p-2">{item.totalPairs}</td>
                  <td className="p-2">₹{item.rate}</td>
                  <td className="p-2 text-right font-bold">₹{item.totalAmount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RETURN ITEMS */}
        {bill.returnItems && bill.returnItems.length > 0 && (
          <div>
            <h4 className="text-xs font-black uppercase text-rose-800 mb-2">Sales Return Items (Deducted)</h4>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-rose-50 text-rose-900 font-bold border-b">
                  <th className="p-2">Article</th>
                  <th className="p-2">Size</th>
                  <th className="p-2">Cartons</th>
                  <th className="p-2">Pairs</th>
                  <th className="p-2">Rate</th>
                  <th className="p-2 text-right">Return Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.returnItems.map((rItem, i) => (
                  <tr key={i} className="border-b border-rose-100 text-rose-900">
                    <td className="p-2 font-bold">{rItem.articleCode}</td>
                    <td className="p-2">{rItem.size}</td>
                    <td className="p-2">{rItem.cartons}</td>
                    <td className="p-2">{rItem.totalPairs}</td>
                    <td className="p-2">₹{rItem.rate}</td>
                    <td className="p-2 text-right font-bold">- ₹{rItem.totalAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CALCULATIONS */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-t pt-4 text-xs gap-4">
          <div className="flex flex-wrap gap-2 print:hidden">
            <button onClick={() => window.print()} className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow transition">
              <Printer className="w-4 h-4" /> Print Invoice
            </button>
            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow transition">
              <Download className="w-4 h-4" /> {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button onClick={handleOpenMultiShare} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow transition">
              <Share2 className="w-4 h-4" /> Share via WhatsApp
            </button>
          </div>
          <div className="w-full sm:w-64 space-y-1 text-right">
            <div className="flex justify-between text-slate-600"><span>Sale Subtotal:</span><span>₹{bill.rawTotal}</span></div>
            {bill.returnTotal > 0 && (
              <div className="flex justify-between text-amber-700 font-bold"><span>Return Adjustment:</span><span>- ₹{bill.returnTotal}</span></div>
            )}
            {bill.discountVal > 0 && (
              <div className="flex justify-between text-purple-700 font-bold"><span>Discount:</span><span>- ₹{bill.discountVal}</span></div>
            )}
            <div className="flex justify-between text-slate-800 font-black text-sm border-t pt-1"><span>Today Net Total:</span><span>₹{bill.todayTotal}</span></div>
            <div className="flex justify-between text-slate-600"><span>Previous Balance:</span><span>₹{bill.previousBalance}</span></div>
            <div className="flex justify-between text-emerald-700 font-bold"><span>Amount Paid:</span><span>₹{bill.amountPaid}</span></div>
            <div className="flex justify-between text-rose-700 font-black text-sm border-t pt-1"><span>Net Balance Due:</span><span>₹{bill.dueBalance}</span></div>
          </div>
        </div>

        <div className="pt-4 text-center print:hidden">
          <button onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 justify-center mx-auto">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {/* MULTIPLE PARTY SELECTION MODAL FOR WHATSAPP */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4 text-slate-100">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                <Share2 className="w-5 h-5" /> Choose WhatsApp Contact(s)
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-white font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Select contacts to send invoice text. First click <b>"Download PDF"</b> on the invoice screen, then attach PDF directly in WhatsApp web/app window!
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-slate-800 rounded-xl p-2 bg-slate-950/60">
              {parties.filter(p => p.phone).map((p) => {
                const clean = p.phone.replace(/[^0-9]/g, '');
                const isSelected = selectedPhones.includes(clean);
                return (
                  <div 
                    key={p._id} 
                    onClick={() => toggleSelectPhone(p.phone)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition ${
                      isSelected ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4 text-slate-500" />}
                      <div>
                        <div className="font-bold text-xs">{p.name} {p.city ? `(${p.city})` : ''}</div>
                        <div className="text-[11px] text-slate-400">{p.phone}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSendToSelected(p.phone); }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" /> Send
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              {selectedPhones.length > 0 && (
                <div className="text-xs text-amber-300 font-semibold text-center">
                  Selected {selectedPhones.length} contact(s). Click "Send" next to a contact above to send directly.
                </div>
              )}
              
              <button 
                onClick={handleOpenGeneralWhatsApp}
                className="w-full bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold py-2.5 rounded-xl text-xs border border-amber-500/30 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" /> Choose Contact Manually in WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== STAFF & EXPENSES MANAGEMENT TAB (UPGRADED) ====================
function StaffTab({ staffList, onStaffUpdated }) {
  const getMonthKey = (date = new Date()) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [records, setRecords] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [newStaff, setNewStaff] = useState({ name: '', phone: '', role: 'Helper', monthlySalary: 0, joiningDate: getToday() });
  const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '', date: getToday() });
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'General', description: '', date: getToday() });
  const [salaryForm, setSalaryForm] = useState({ amount: '', date: getToday(), remark: '' });

  const monthLabel = new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate();

  const loadMonthData = async () => {
    setLoadingRecords(true);
    try {
      const [recordsRes, expensesRes, paymentsRes] = await Promise.all([
        fetch(`${API_BASE}/staff-records?month=${selectedMonth}`),
        fetch(`${API_BASE}/expenses?month=${selectedMonth}`),
        fetch(`${API_BASE}/staff-salary-payments?month=${selectedMonth}`)
      ]);

      const recordsData = recordsRes.ok ? await recordsRes.json() : [];
      const expensesData = expensesRes.ok ? await expensesRes.json() : [];
      const paymentsData = paymentsRes.ok ? await paymentsRes.json() : [];

      const grouped = {};
      (Array.isArray(recordsData) ? recordsData : []).forEach(r => {
        if (!grouped[r.staffId]) grouped[r.staffId] = [];
        grouped[r.staffId].push(r);
      });

      setRecords(grouped);
      setExpenses(Array.isArray(expensesData) ? expensesData : []);
      setSalaryPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (err) {
      console.error(err);
      alert('Staff records load nahi ho paaye.');
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [selectedMonth]);

  const refreshEverything = async () => {
    await Promise.all([loadMonthData(), onStaffUpdated()]);
  };

  const staffRecords = (staffId) => records[staffId] || [];
  const attendanceRecords = (staffId) => staffRecords(staffId).filter(r => !Number(r.advanceAmount || 0));
  const attendanceForDate = (staffId, date) => attendanceRecords(staffId).find(r => r.date === date);

  const getStaffStats = (st) => {
    const rows = attendanceRecords(st._id);
    const allRows = staffRecords(st._id);
    const absent = rows.filter(r => r.status === 'Absent').length;
    const half = rows.filter(r => r.status === 'Half-Day' || r.status === 'Half Day').length;
    const present = rows.filter(r => r.status === 'Present').length;

    const advances = allRows.reduce((sum, r) => sum + Number(r.advanceAmount || 0), 0);
    const payments = salaryPayments
      .filter(p => String(p.staffId) === String(st._id))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const dailyRate = Number(st.monthlySalary || 0) / daysInMonth;
    const absenceDeduction = absent * dailyRate;
    const halfDayDeduction = half * dailyRate * 0.5;
    const grossAfterAttendance = Math.max(0, Number(st.monthlySalary || 0) - absenceDeduction - halfDayDeduction);
    const netPayable = Math.max(0, grossAfterAttendance - advances);
    const remainingAfterPayments = Math.max(0, netPayable - payments);

    return {
      present, absent, half, advances, payments,
      dailyRate, absenceDeduction, halfDayDeduction,
      grossAfterAttendance, netPayable, remainingAfterPayments
    };
  };

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newStaff,
          monthlySalary: Number(newStaff.monthlySalary || 0),
          joiningDate: newStaff.joiningDate || getToday(),
          active: true
        })
      });
      if (!res.ok) throw new Error();
      alert('New Staff Added Successfully!');
      setShowAddStaffModal(false);
      setNewStaff({ name: '', phone: '', role: 'Helper', monthlySalary: 0, joiningDate: getToday() });
      await refreshEverything();
    } catch (err) {
      alert('Error adding staff');
    }
  };

  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      const res = await fetch(`${API_BASE}/staff/${selectedStaff._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedStaff,
          monthlySalary: Number(selectedStaff.monthlySalary || 0)
        })
      });
      if (!res.ok) throw new Error();
      setShowEditStaffModal(false);
      setSelectedStaff(null);
      await refreshEverything();
    } catch (err) {
      alert('Error updating staff');
    }
  };

  const handleMarkAttendance = async (staffId, status) => {
    try {
      const res = await fetch(`${API_BASE}/staff/${staffId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, status })
      });
      if (!res.ok) throw new Error();
      await loadMonthData();
    } catch (err) {
      alert('Error recording attendance');
    }
  };

  const handleAddAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff || !advanceForm.amount) return;
    try {
      const res = await fetch(`${API_BASE}/staff/${selectedStaff._id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: advanceForm.date,
          amount: Number(advanceForm.amount || 0),
          reason: advanceForm.reason || 'Staff Advance'
        })
      });
      if (!res.ok) throw new Error();
      setShowAdvanceModal(false);
      setAdvanceForm({ amount: '', reason: '', date: getToday() });
      await loadMonthData();
    } catch (err) {
      alert('Error saving advance');
    }
  };

  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0) return;
    try {
      const res = await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseForm,
          amount: Number(expenseForm.amount || 0)
        })
      });
      if (!res.ok) throw new Error();
      setShowExpenseModal(false);
      setExpenseForm({ amount: '', category: 'General', description: '', date: getToday() });
      await loadMonthData();
    } catch (err) {
      alert('Error saving expense');
    }
  };

  const handleSalaryPayment = async (e) => {
    e.preventDefault();
    if (!selectedStaff || !salaryForm.amount) return;
    try {
      const res = await fetch(`${API_BASE}/staff/${selectedStaff._id}/salary-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: selectedMonth,
          date: salaryForm.date,
          amount: Number(salaryForm.amount || 0),
          remark: salaryForm.remark || ''
        })
      });
      if (!res.ok) throw new Error();
      setShowSalaryModal(false);
      setSalaryForm({ amount: '', date: getToday(), remark: '' });
      await loadMonthData();
    } catch (err) {
      alert('Error recording salary payment');
    }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Staff delete karna hai? Isse attendance/advance history bhi delete hogi.')) return;
    await fetch(`${API_BASE}/staff/${id}`, { method: 'DELETE' });
    await refreshEverything();
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Ye expense delete karna hai?')) return;
    await fetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE' });
    await loadMonthData();
  };

  const selectedStaffStats = selectedStaff ? getStaffStats(selectedStaff) : null;
  const totalSalaryLiability = staffList.reduce((sum, st) => sum + getStaffStats(st).remainingAfterPayments, 0);
  const totalAdvances = staffList.reduce((sum, st) => sum + getStaffStats(st).advances, 0);
  const totalBusinessExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalSalaryPaid = salaryPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-amber-400" /> Staff & Expense Management
            </h3>
            <p className="text-xs text-slate-400 mt-1">Attendance → salary deduction → advance → payment, sab linked hai.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" />
            <button onClick={() => setShowExpenseModal(true)}
              className="bg-slate-800 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl font-black text-xs">
              + Business Expense
            </button>
            <button onClick={() => setShowAddStaffModal(true)}
              className="bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Staff
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Staff', staffList.length, 'text-white'],
          ['Salary Payable', `₹${Math.round(totalSalaryLiability).toLocaleString()}`, 'text-emerald-400'],
          ['Advances', `₹${Math.round(totalAdvances).toLocaleString()}`, 'text-purple-400'],
          ['Salary Paid', `₹${Math.round(totalSalaryPaid).toLocaleString()}`, 'text-sky-400'],
          ['Other Expenses', `₹${Math.round(totalBusinessExpenses).toLocaleString()}`, 'text-rose-400']
        ].map(([label, value, cls]) => (
          <div key={label} className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
            <div className="text-[10px] uppercase font-black text-slate-500">{label}</div>
            <div className={`text-xl font-black mt-1 ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-black text-white">{monthLabel} Attendance</h4>
            <p className="text-xs text-slate-500">Date select karo, phir har staff ka Present / Half-Day / Absent mark karo.</p>
          </div>
          <input type="date" value={selectedDate}
            onChange={e => {
              setSelectedDate(e.target.value);
              const m = e.target.value.slice(0, 7);
              if (m !== selectedMonth) setSelectedMonth(m);
            }}
            className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[900px]">
            <thead className="bg-slate-800/70 text-slate-400 uppercase">
              <tr>
                <th className="p-3">Staff</th>
                <th className="p-3">Salary</th>
                <th className="p-3">Today</th>
                <th className="p-3">Present</th>
                <th className="p-3">Absent</th>
                <th className="p-3">Half</th>
                <th className="p-3">Advance</th>
                <th className="p-3">Net Payable</th>
                <th className="p-3">Remaining</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {staffList.map(st => {
                const stats = getStaffStats(st);
                const entry = attendanceForDate(st._id, selectedDate);
                return (
                  <tr key={st._id} className="hover:bg-slate-800/30">
                    <td className="p-3">
                      <div className="font-bold text-white">{st.name}</div>
                      <div className="text-[10px] text-amber-400">{st.role || 'Staff'}</div>
                    </td>
                    <td className="p-3 font-bold text-white">₹{Number(st.monthlySalary || 0).toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-lg font-black ${
                        entry?.status === 'Present' ? 'bg-emerald-500/20 text-emerald-400' :
                        entry?.status === 'Absent' ? 'bg-rose-500/20 text-rose-400' :
                        entry?.status === 'Half-Day' || entry?.status === 'Half Day' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-800 text-slate-500'
                      }`}>{entry?.status || 'Pending'}</span>
                    </td>
                    <td className="p-3 font-bold text-emerald-400">{stats.present}</td>
                    <td className="p-3 font-bold text-rose-400">{stats.absent}</td>
                    <td className="p-3 font-bold text-amber-400">{stats.half}</td>
                    <td className="p-3 font-bold text-purple-400">₹{Math.round(stats.advances).toLocaleString()}</td>
                    <td className="p-3 font-black text-emerald-300">₹{Math.round(stats.netPayable).toLocaleString()}</td>
                    <td className="p-3 font-black text-sky-300">₹{Math.round(stats.remainingAfterPayments).toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          ['Present', 'bg-emerald-600', '✓'],
                          ['Half-Day', 'bg-amber-600', '½'],
                          ['Absent', 'bg-rose-600', '×']
                        ].map(([status, color, icon]) => (
                          <button key={status} onClick={() => handleMarkAttendance(st._id, status)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black ${entry?.status === status ? color + ' text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                            {icon} {status === 'Half-Day' ? 'Half' : status}
                          </button>
                        ))}
                        <button onClick={() => { setSelectedStaff(st); setShowAdvanceModal(true); }}
                          className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-black">+ Advance</button>
                        <button onClick={() => {
                          setSelectedStaff(st);
                          setSalaryForm({ amount: String(Math.round(getStaffStats(st).remainingAfterPayments)), date: getToday(), remark: '' });
                          setShowSalaryModal(true);
                        }} className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px] font-black">Pay Salary</button>
                        <button onClick={() => { setSelectedStaff({...st}); setShowEditStaffModal(true); }}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-amber-300 border border-slate-700 text-[10px] font-black">Edit</button>
                        <button onClick={() => handleDeleteStaff(st._id)}
                          className="px-2 py-1 rounded-lg bg-slate-800 text-rose-400 border border-slate-700 text-[10px] font-black">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loadingRecords && <div className="text-xs text-slate-500 mt-3">Loading records...</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <h4 className="font-black text-white mb-3">Salary Calculation — {monthLabel}</h4>
          <div className="space-y-2 text-xs">
            {staffList.map(st => {
              const s = getStaffStats(st);
              return (
                <div key={st._id} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <div className="flex justify-between font-bold"><span>{st.name}</span><span className="text-emerald-400">₹{Math.round(s.netPayable).toLocaleString()}</span></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-slate-400">
                    <span>Base ₹{Math.round(st.monthlySalary || 0)}</span>
                    <span>Absent -₹{Math.round(s.absenceDeduction)}</span>
                    <span>Half -₹{Math.round(s.halfDayDeduction)}</span>
                    <span>Advance -₹{Math.round(s.advances)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Daily rate: ₹{s.dailyRate.toFixed(2)} • Payments: ₹{Math.round(s.payments)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <h4 className="font-black text-white mb-3">Other Expenses — {monthLabel}</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {expenses.length === 0 && <div className="text-xs text-slate-500">No business expense recorded.</div>}
            {expenses.map(e => (
              <div key={e._id} className="flex items-center justify-between gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                <div><div className="text-xs font-bold text-white">{e.description || e.category}</div><div className="text-[10px] text-slate-500">{e.date} • {e.category}</div></div>
                <div className="flex items-center gap-2"><span className="font-black text-rose-400">₹{Number(e.amount || 0).toLocaleString()}</span>
                  <button onClick={() => handleDeleteExpense(e._id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-lg font-black text-white mb-4">Add Staff Member</h3>
            <form onSubmit={handleAddStaffSubmit} className="space-y-3">
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Staff Name *" value={newStaff.name} onChange={e => setNewStaff({...newStaff,name:e.target.value})} required />
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Phone" value={newStaff.phone} onChange={e => setNewStaff({...newStaff,phone:e.target.value})} />
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Role / Designation" value={newStaff.role} onChange={e => setNewStaff({...newStaff,role:e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-emerald-400 font-bold" placeholder="Monthly Salary" value={newStaff.monthlySalary} onChange={e => setNewStaff({...newStaff,monthlySalary:e.target.value})} required />
                <input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={newStaff.joiningDate} onChange={e => setNewStaff({...newStaff,joiningDate:e.target.value})} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddStaffModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">Save Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditStaffModal && selectedStaff && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-lg font-black text-white mb-4">Edit Staff</h3>
            <form onSubmit={handleEditStaffSubmit} className="space-y-3">
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={selectedStaff.name || ''} onChange={e => setSelectedStaff({...selectedStaff,name:e.target.value})} required />
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Phone" value={selectedStaff.phone || ''} onChange={e => setSelectedStaff({...selectedStaff,phone:e.target.value})} />
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Role" value={selectedStaff.role || ''} onChange={e => setSelectedStaff({...selectedStaff,role:e.target.value})} />
              <input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-emerald-400 font-bold" value={selectedStaff.monthlySalary || 0} onChange={e => setSelectedStaff({...selectedStaff,monthlySalary:e.target.value})} required />
              <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={selectedStaff.active !== false} onChange={e => setSelectedStaff({...selectedStaff,active:e.target.checked})} /> Active Staff</label>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowEditStaffModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">Update Staff</button></div>
            </form>
          </div>
        </div>
      )}

      {showAdvanceModal && selectedStaff && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-lg font-black text-purple-300 mb-4">Advance / Staff Expense — {selectedStaff.name}</h3>
            <form onSubmit={handleAddAdvanceSubmit} className="space-y-3">
              <input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={advanceForm.date} onChange={e => setAdvanceForm({...advanceForm,date:e.target.value})} required />
              <input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" placeholder="Amount ₹" value={advanceForm.amount} onChange={e => setAdvanceForm({...advanceForm,amount:e.target.value})} required />
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Reason / Detail" value={advanceForm.reason} onChange={e => setAdvanceForm({...advanceForm,reason:e.target.value})} required />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowAdvanceModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-purple-500 text-white rounded-xl text-xs font-black">Save Advance</button></div>
            </form>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-lg font-black text-rose-300 mb-4">Business Expense</h3>
            <form onSubmit={handleAddExpenseSubmit} className="space-y-3">
              <input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm,date:e.target.value})} required />
              <select className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm,category:e.target.value})}>
                <option>General</option><option>Electricity</option><option>Rent</option><option>Transport</option><option>Tea / Food</option><option>Repair</option><option>Other</option>
              </select>
              <input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" placeholder="Amount ₹" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm,amount:e.target.value})} required />
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Expense description" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm,description:e.target.value})} required />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-black">Save Expense</button></div>
            </form>
          </div>
        </div>
      )}

      {showSalaryModal && selectedStaff && selectedStaffStats && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md">
            <h3 className="text-lg font-black text-sky-300 mb-2">Salary Payment — {selectedStaff.name}</h3>
            <div className="text-xs text-slate-400 mb-4">{monthLabel} • Remaining payable: <b className="text-emerald-400">₹{Math.round(selectedStaffStats.remainingAfterPayments)}</b></div>
            <form onSubmit={handleSalaryPayment} className="space-y-3">
              <input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={salaryForm.date} onChange={e => setSalaryForm({...salaryForm,date:e.target.value})} required />
              <input type="number" min="0" max={Math.round(selectedStaffStats.remainingAfterPayments)} className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" placeholder="Payment ₹" value={salaryForm.amount} onChange={e => setSalaryForm({...salaryForm,amount:e.target.value})} required />
              <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Remark" value={salaryForm.remark} onChange={e => setSalaryForm({...salaryForm,remark:e.target.value})} />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowSalaryModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-black">Record Payment</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== MASTER ARTICLES TAB ====================
function ArticlesTab({ articles, stocks, sizeRanges, setSizeRanges, onArticleAdded }) {
  const [form, setForm] = useState({ articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', mrp: 0, purchaseRate: 0, wholesaleRate: 0, sellingPrice: 0, pairsInPeti: 12, cartons: 0, loosePairs: 0 });
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [showCustomSizeModal, setShowCustomSizeModal] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState('');

  const handleSizeDropdownChange = (e) => {
    const val = e.target.value;
    if (val === 'ADD_CUSTOM_SIZE_RANGE') {
      setShowCustomSizeModal(true);
    } else {
      setForm({ ...form, sizeRange: val });
    }
  };

  const handleAddCustomSize = () => {
    if (!customSizeInput.trim()) return;
    const newSz = customSizeInput.trim();
    if (!sizeRanges.includes(newSz)) setSizeRanges([...sizeRanges, newSz]);
    setForm({ ...form, sizeRange: newSz });
    setCustomSizeInput('');
    setShowCustomSizeModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingArticleId ? `${API_BASE}/articles/${editingArticleId}` : `${API_BASE}/articles`;
      const method = editingArticleId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        alert(editingArticleId ? 'Article Updated Successfully!' : 'Article Saved & Stock Synced Successfully!');
        onArticleAdded();
        setForm({ articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', mrp: 0, purchaseRate: 0, wholesaleRate: 0, sellingPrice: 0, pairsInPeti: 12, cartons: 0, loosePairs: 0 });
        setEditingArticleId(null);
      }
    } catch (err) { alert('Error saving article'); }
  };

  const handleEditClick = (a) => {
    setEditingArticleId(a._id);
    const matchedStock = stocks.find(s => s.articleCode === a.articleCode) || {};
    setForm({
      articleCode: a.articleCode || '',
      brand: a.brand || '',
      color: a.color || '',
      sizeRange: a.sizeRange || '6*9 (Gents)',
      mrp: a.mrp || 0,
      purchaseRate: a.purchaseRate || matchedStock.purchaseRate || 0,
      wholesaleRate: a.wholesaleRate || 0,
      sellingPrice: a.sellingPrice || a.wholesaleRate || 0,
      pairsInPeti: a.pairsInPeti || 12,
      cartons: matchedStock.cartons || 0,
      loosePairs: matchedStock.loosePairs || 0
    });
  };

  const handleDeleteArticle = async (id) => {
    if (window.confirm('Delete article? (This will also remove synced stock entry)')) {
      await fetch(`${API_BASE}/articles/${id}`, { method: 'DELETE' });
      onArticleAdded();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-amber-400" /> {editingArticleId ? 'Edit Master Article' : 'Add New Master Article'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Article Code *</label>
            <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white uppercase font-bold" placeholder="e.g. ART-901" value={form.articleCode} onChange={(e) => setForm({...form, articleCode: e.target.value})} required disabled={!!editingArticleId} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Brand Name</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Campus, Sparx" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Color</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Black, Tan" value={form.color} onChange={(e) => setForm({...form, color: e.target.value})} /></div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Size Range</label>
            <select className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.sizeRange} onChange={handleSizeDropdownChange}>
              {sizeRanges.map((sz, idx) => <option key={idx} value={sz}>{sz}</option>)}
              <option value="ADD_CUSTOM_SIZE_RANGE" className="bg-amber-900 text-amber-200 font-bold">➕ + Add Custom Size...</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">MRP (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" type="number" placeholder="0" value={form.mrp} onChange={(e) => setForm({...form, mrp: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Purchasing Price (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" type="number" placeholder="0" value={form.purchaseRate} onChange={(e) => setForm({...form, purchaseRate: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Selling Price / Wholesale (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-amber-400 font-bold" type="number" placeholder="0" value={form.sellingPrice} onChange={(e) => setForm({...form, sellingPrice: e.target.value, wholesaleRate: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Pairs In Peti</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" type="number" placeholder="12" value={form.pairsInPeti} onChange={(e) => setForm({...form, pairsInPeti: e.target.value})} /></div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider block">Godown Initial Stock Sync</span>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-[11px] font-bold text-slate-400">Cartons (Peti)</label><input className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white" type="number" value={form.cartons} onChange={(e) => setForm({...form, cartons: e.target.value})} /></div>
              <div><label className="block text-[11px] font-bold text-slate-400">Loose Pairs</label><input className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white" type="number" value={form.loosePairs} onChange={(e) => setForm({...form, loosePairs: e.target.value})} /></div>
            </div>
          </div>
          <div className="flex gap-2">
            {editingArticleId && (
              <button type="button" onClick={() => { setEditingArticleId(null); setForm({ articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', mrp: 0, purchaseRate: 0, wholesaleRate: 0, sellingPrice: 0, pairsInPeti: 12, cartons: 0, loosePairs: 0 }); }} className="w-1/3 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs">
                Cancel
              </button>
            )}
            <button type="submit" className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow-lg">
              {editingArticleId ? 'Update Article' : 'Save Article & Sync Stock'}
            </button>
          </div>
        </form>
      </div>

      <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4 flex items-center justify-between">
          <span>🏷️ Master Articles Catalog</span>
          <span className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800/60 px-3 py-1 rounded-full font-bold">Synced with Godown Stock</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/70 text-slate-400 uppercase">
              <tr>
                <th className="p-2.5">Article</th>
                <th className="p-2.5">Size / Color</th>
                <th className="p-2.5">MRP</th>
                <th className="p-2.5">Purchase</th>
                <th className="p-2.5">Selling</th>
                <th className="p-2.5">Stock (Peti/Pairs)</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {articles.map((a) => {
                const matchedStock = stocks.find(s => s.articleCode === a.articleCode) || {};
                return (
                  <tr key={a._id} className="hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-white">
                      {a.articleCode}
                      <span className="block text-[10px] text-slate-400">{a.brand || 'No Brand'}</span>
                    </td>
                    <td className="p-2.5 text-slate-300">
                      <div>{a.sizeRange || '-'}</div>
                      <span className="text-[10px] text-slate-400">{a.color || '-'}</span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-300">₹{a.mrp || 0}</td>
                    <td className="p-2.5 font-bold text-emerald-400">₹{a.purchaseRate || matchedStock.purchaseRate || 0}</td>
                    <td className="p-2.5 font-bold text-amber-400">₹{a.sellingPrice || a.wholesaleRate || 0}</td>
                    <td className="p-2.5 font-black text-sky-400">
                      {matchedStock.cartons || 0} Peti ({matchedStock.totalPairs || 0} Pr)
                    </td>
                    <td className="p-2.5 text-center flex justify-center gap-2">
                      <button onClick={() => handleEditClick(a)} className="text-amber-400 hover:text-amber-300"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteArticle(a._id)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCustomSizeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-black text-white mb-3">Add Custom Size Range</h3>
            <input className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold mb-4" placeholder="e.g. 2*5 (Kids)" value={customSizeInput} onChange={(e) => setCustomSizeInput(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCustomSizeModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button>
              <button onClick={handleAddCustomSize} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">Add Size</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== STOCK TAB ====================
function StockInwardTab({ articles, stocks, sizeRanges, setSizeRanges, onStockUpdated }) {
  const [form, setForm] = useState({ articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', cartons: 0, pairsPerCarton: 12, loosePairs: 0, mrp: 0, purchaseRate: 0, sellingPrice: 0 });
  const [showCustomSizeModal, setShowCustomSizeModal] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState('');

  const handleSizeDropdownChange = (e) => {
    const val = e.target.value;
    if (val === 'ADD_CUSTOM_SIZE_RANGE') {
      setShowCustomSizeModal(true);
    } else {
      setForm({ ...form, sizeRange: val });
    }
  };

  const handleAddCustomSize = () => {
    if (!customSizeInput.trim()) return;
    const newSz = customSizeInput.trim();
    if (!sizeRanges.includes(newSz)) setSizeRanges([...sizeRanges, newSz]);
    setForm({ ...form, sizeRange: newSz });
    setCustomSizeInput('');
    setShowCustomSizeModal(false);
  };

  const handleArticleSelect = (e) => {
    const code = e.target.value;
    const selectedArt = articles.find(a => a.articleCode === code);
    if (selectedArt) {
      setForm({
        ...form,
        articleCode: code,
        brand: selectedArt.brand || '',
        color: selectedArt.color || '',
        sizeRange: selectedArt.sizeRange || '6*9 (Gents)',
        mrp: selectedArt.mrp || 0,
        purchaseRate: selectedArt.purchaseRate || 0,
        sellingPrice: selectedArt.sellingPrice || selectedArt.wholesaleRate || 0,
        pairsPerCarton: selectedArt.pairsInPeti || 12
      });
    } else {
      setForm({ ...form, articleCode: code });
    }
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/stock/inward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        alert('Stock Inward Added & Synced!');
        onStockUpdated();
        setForm({ articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', cartons: 0, pairsPerCarton: 12, loosePairs: 0, mrp: 0, purchaseRate: 0, sellingPrice: 0 });
      }
    } catch (err) { alert('Error updating stock'); }
  };

  const handleDeleteStock = async (id) => {
    if (window.confirm('Delete this stock item?')) {
      await fetch(`${API_BASE}/stock/${id}`, { method: 'DELETE' });
      onStockUpdated();
    }
  };

  const handleEditStock = async (s) => {
    const newCartons = prompt("Enter New Cartons (Peti):", s.cartons);
    const newPurchaseRate = prompt("Enter Purchase Price (₹):", s.purchaseRate || 0);
    const newSellingPrice = prompt("Enter Selling Price (₹):", s.sellingPrice || 0);

    if (newCartons !== null) {
      await fetch(`${API_BASE}/stock/${s._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cartons: parseInt(newCartons || 0),
          purchaseRate: parseFloat(newPurchaseRate || 0),
          sellingPrice: parseFloat(newSellingPrice || 0)
        })
      });
      onStockUpdated();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-400" /> Stock Inward Entry
        </h3>
        <form onSubmit={handleStockSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Article Code *</label>
            <select className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" value={form.articleCode} onChange={handleArticleSelect} required>
              <option value="">-- Choose Article --</option>
              {articles.map((a) => <option key={a._id} value={a.articleCode}>{a.articleCode}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Brand Name</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.brand} onChange={(e) => setForm({...form, brand: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Color</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.color} onChange={(e) => setForm({...form, color: e.target.value})} /></div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Size Range</label>
            <select className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.sizeRange} onChange={handleSizeDropdownChange}>
              {sizeRanges.map((sz, idx) => <option key={idx} value={sz}>{sz}</option>)}
              <option value="ADD_CUSTOM_SIZE_RANGE" className="bg-amber-900 text-amber-200 font-bold">➕ + Add Custom Size...</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Cartons</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" type="number" value={form.cartons} onChange={(e) => setForm({...form, cartons: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Pairs/Carton</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" type="number" value={form.pairsPerCarton} onChange={(e) => setForm({...form, pairsPerCarton: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Loose Pairs</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" type="number" value={form.loosePairs} onChange={(e) => setForm({...form, loosePairs: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Purchase Rate (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-emerald-400 font-bold" type="number" value={form.purchaseRate} onChange={(e) => setForm({...form, purchaseRate: e.target.value})} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Selling Rate (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-amber-400 font-bold" type="number" value={form.sellingPrice} onChange={(e) => setForm({...form, sellingPrice: e.target.value})} /></div>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 py-3 rounded-xl font-black text-xs shadow-lg mt-2">
            + Add Stock Inward
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4">📦 Godown Current Stock Level</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/70 text-slate-400 uppercase">
              <tr>
                <th className="p-2.5">Article</th>
                <th className="p-2.5">Size / Color</th>
                <th className="p-2.5">Cartons</th>
                <th className="p-2.5">Loose</th>
                <th className="p-2.5">Total Pairs</th>
                <th className="p-2.5">Purchase (₹)</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {stocks.map((s) => (
                <tr key={s._id} className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-bold text-white">{s.articleCode}</td>
                  <td className="p-2.5 text-slate-300">{s.sizeRange} <span className="text-[10px] text-slate-400 block">{s.color}</span></td>
                  <td className="p-2.5 font-bold text-slate-200">{s.cartons} Peti</td>
                  <td className="p-2.5 text-slate-400">{s.loosePairs} Pr</td>
                  <td className="p-2.5 font-black text-amber-400">{s.totalPairs} Pairs</td>
                  <td className="p-2.5 font-bold text-emerald-400">₹{s.purchaseRate || 0}</td>
                  <td className="p-2.5 text-center flex justify-center gap-2">
                    <button onClick={() => handleEditStock(s)} className="text-amber-400 hover:text-amber-300"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteStock(s._id)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCustomSizeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-black text-white mb-3">Add Custom Size Range</h3>
            <input className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold mb-4" placeholder="e.g. 2*5 (Kids)" value={customSizeInput} onChange={(e) => setCustomSizeInput(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCustomSizeModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button>
              <button onClick={handleAddCustomSize} className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">Add Size</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PARTIES TAB ====================
function PartiesTab({ parties, onPartyAdded }) {
  const [form, setForm] = useState({ name: '', phone: '', city: '', openingBalance: 0 });
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `${API_BASE}/parties/${editingId}` : `${API_BASE}/parties`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        alert(editingId ? 'Party Details Updated!' : 'New Party Added!');
        onPartyAdded();
        setForm({ name: '', phone: '', city: '', openingBalance: 0 });
        setEditingId(null);
      }
    } catch (err) { alert('Error saving party'); }
  };

  const handleEdit = (p) => {
    setEditingId(p._id);
    setForm({ name: p.name || '', phone: p.phone || '', city: p.city || '', openingBalance: p.openingBalance || 0 });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete party account?')) {
      await fetch(`${API_BASE}/parties/${id}`, { method: 'DELETE' });
      onPartyAdded();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" /> {editingId ? 'Edit Party Details' : 'Add New Wholesale Party'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-xs font-bold text-slate-300 mb-1">Party Name *</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></div>
          <div><label className="block text-xs font-bold text-slate-300 mb-1">City / Location</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} /></div>
          <div><label className="block text-xs font-bold text-slate-300 mb-1">Phone Number</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
          {!editingId && (
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Opening Balance (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-rose-400 font-bold" type="number" value={form.openingBalance} onChange={(e) => setForm({...form, openingBalance: e.target.value})} /></div>
          )}
          <div className="flex gap-2 pt-2">
            {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', phone: '', city: '', openingBalance: 0 }); }} className="w-1/3 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs">Cancel</button>}
            <button type="submit" className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow-lg">
              {editingId ? 'Update Party' : 'Save Party'}
            </button>
          </div>
        </form>
      </div>

      <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4">👥 Wholesale Parties Directory</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/70 text-slate-400 uppercase">
              <tr>
                <th className="p-2.5">Party Name</th>
                <th className="p-2.5">City</th>
                <th className="p-2.5">Phone</th>
                <th className="p-2.5">Current Balance (₹)</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {parties.map((p) => (
                <tr key={p._id} className="hover:bg-slate-800/40">
                  <td className="p-2.5 font-bold text-white">{p.name}</td>
                  <td className="p-2.5 text-slate-300">{p.city || '-'}</td>
                  <td className="p-2.5 text-slate-300">{p.phone || '-'}</td>
                  <td className="p-2.5 font-black text-rose-400">₹{p.currentBalance || 0}</td>
                  <td className="p-2.5 text-center flex justify-center gap-2">
                    <button onClick={() => handleEdit(p)} className="text-amber-400 hover:text-amber-300"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(p._id)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}