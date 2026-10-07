import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2, LayoutDashboard, Receipt, Package, Users, Tag,
  Plus, Printer, ArrowLeft, Trash2, ShoppingBag, DollarSign, Wallet,
  UserCheck, Filter, Edit, Share2, Download, CheckSquare, Square, Send,
  Calendar, CheckCircle, XCircle, Clock, FileText, CreditCard, RotateCcw
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');

// Authenticated API helper. Existing page APIs keep their same URLs/methods;
// this only adds the login token to requests and handles expired sessions.
const getAuthToken = () => localStorage.getItem('supergold_auth_token') || sessionStorage.getItem('supergold_auth_token') || '';
const getAuthStorage = () => localStorage.getItem('supergold_auth_token') ? localStorage : sessionStorage;
const setLastActivity = (value = Date.now()) => {
  try { getAuthStorage().setItem('supergold_last_activity', String(value)); } catch { }
};
const clearAuthStorage = () => {
  localStorage.removeItem('supergold_auth_token');
  localStorage.removeItem('supergold_auth_user');
  localStorage.removeItem('supergold_last_activity');
  sessionStorage.removeItem('supergold_auth_token');
  sessionStorage.removeItem('supergold_auth_user');
  sessionStorage.removeItem('supergold_last_activity');
};
const apiFetch = async (url, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await window.fetch(url, { ...options, headers });
  if (response.status === 401 && !String(url).includes('/auth/login')) {
    clearAuthStorage();
    window.dispatchEvent(new Event('supergold-auth-expired'));
  }
  return response;
};

const ToastContext = createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const notify = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  };

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md animate-[toastIn_0.28s_ease-out] ${toast.type === 'error' ? 'bg-rose-950/95 border-rose-700/60 text-rose-100' : 'bg-slate-900/95 border-amber-700/50 text-white'}`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toast.type === 'error' ? 'bg-rose-400' : 'bg-emerald-400'} animate-pulse`} />
              <span className="text-sm font-bold leading-5">{toast.message}</span>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateX(24px) scale(0.98); } to { opacity: 1; transform: translateX(0) scale(1); } }`}</style>
    </ToastContext.Provider>
  );
}

function useToast() {
  return useContext(ToastContext);
}

// Excel-compatible workbook export (no UI/library dependency required).
function exportERPDataToExcel({ bills = [], parties = [], articles = [], stocks = [] }) {
  const escapeXml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;').replace(/'/g, '&apos;');
  const sheet = (name, columns, rows) => {
    const header = columns.map(c => `<Cell><Data ss:Type=\"String\">${escapeXml(c.label)}</Data></Cell>`).join('');
    const body = rows.map(row => `<Row>${columns.map(c => {
      const value = typeof c.value === 'function' ? c.value(row) : row[c.value];
      const numeric = typeof value === 'number' && Number.isFinite(value);
      return `<Cell><Data ss:Type=\"${numeric ? 'Number' : 'String'}\">${escapeXml(value)}</Data></Cell>`;
    }).join('')}</Row>`).join('');
    return `<Worksheet ss:Name=\"${escapeXml(name).slice(0, 31)}\"><Table><Row>${header}</Row>${body}</Table></Worksheet>`;
  };
  const workbook = `<?xml version=\"1.0\"?>
<?mso-application progid=\"Excel.Sheet\"?>
<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:x=\"urn:schemas-microsoft-com:office:excel\" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\"><Styles><Style ss:ID=\"Default\" ss:Name=\"Normal\"><Alignment ss:Vertical=\"Center\"/><Font ss:FontName=\"Calibri\" ss:Size=\"11\"/></Style></Styles>${sheet('Invoices', [
    { label: 'Bill No', value: r => r.billNo }, { label: 'Date', value: r => r.billDate ? new Date(r.billDate).toLocaleDateString('en-IN') : '' }, { label: 'Party', value: 'partyName' },
    { label: 'Amount', value: r => Number(r.todayTotal || 0) }, { label: 'Cash', value: r => Number(r.cashPaid || 0) }, { label: 'Online', value: r => Number(r.onlinePaid || 0) },
    { label: 'Paid', value: r => Number(r.amountPaid || 0) }, { label: 'Due', value: r => Number(r.dueBalance || 0) }
  ], bills) +
    sheet('Parties', [
      { label: 'Party Name', value: 'name' }, { label: 'City', value: 'city' }, { label: 'Phone', value: 'phone' }, { label: 'Opening Balance', value: r => Number(r.openingBalance || 0) }, { label: 'Current Balance', value: r => Number(r.currentBalance || 0) }
    ], parties) +
    sheet('Articles', [
      { label: 'Article Code', value: 'articleCode' }, { label: 'Brand', value: 'brand' }, { label: 'Color', value: 'color' }, { label: 'Size Range', value: 'sizeRange' },
      { label: 'MRP', value: r => Number(r.mrp || 0) }, { label: 'Purchase Discount %', value: r => Number(r.purchaseDiscountPercent || 0) }, { label: 'Purchase Price', value: r => Number(r.purchaseRate || 0) },
      { label: 'Selling Discount %', value: r => Number(r.sellingDiscountPercent || 0) }, { label: 'Selling Price', value: r => Number(r.sellingPrice || r.wholesaleRate || 0) }, { label: 'Pairs In CN', value: r => Number(r.pairsInPeti || 0) }
    ], articles) +
    sheet('Stock', [
      { label: 'Article Code', value: 'articleCode' }, { label: 'Brand', value: 'brand' }, { label: 'Color', value: 'color' }, { label: 'Size Range', value: 'sizeRange' },
      { label: 'Cartons', value: r => Number(r.cartons || 0) }, { label: 'Loose Pairs', value: r => Number(r.loosePairs || 0) }, { label: 'Total Pairs', value: r => Number(r.totalPairs || 0) },
      { label: 'MRP', value: r => Number(r.mrp || 0) }, { label: 'Purchase Rate', value: r => Number(r.purchaseRate || 0) }, { label: 'Selling Price', value: r => Number(r.sellingPrice || 0) }
    ], stocks)
    }</Workbook>`;
  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Super-Gold-ERP-Export-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

const DEFAULT_SIZE_RANGES = [
  '6*10 (Gents)', '6*9 (Gents)', '7*10 (Gents)',
  '1*5 (Kids/Boys)', '11*1 (Kids)', '4*7 (Ladies)',
  '5*8 (Ladies)', '8*11 (Kids)', '9*1 (Kids)', '11*3 (Kids)'
];


function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Username aur password required hai.');
      return;
    }
    setLoading(true);
    try {
      const res = await window.fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, rememberMe })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'Login failed.');
      const storage = rememberMe ? localStorage : sessionStorage;
      clearAuthStorage();
      storage.setItem('supergold_auth_token', data.token);
      storage.setItem('supergold_auth_user', JSON.stringify(data.user));
      storage.setItem('supergold_last_activity', String(Date.now()));
      if (window.location.hash) window.location.hash = '';
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl p-7 md:p-8">
          <div className="flex justify-center mb-5">
            <img src="/supergold-logo.png" alt="Supergold" className="w-28 h-28 rounded-full object-cover shadow-xl border border-amber-700/40" />
          </div>
          <div className="text-center mb-7">
            <h1 className="text-2xl font-black tracking-wider text-amber-400">SUPER GOLD FOOTWEAR</h1>
            <p className="text-sm text-slate-400 mt-1">Secure Login</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500" placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="w-full p-3.5 pr-12 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:border-amber-500" placeholder="Enter password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-white">{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="accent-amber-500" />
              Remember me
            </label>

            {error && <div className="rounded-xl border border-rose-700/50 bg-rose-950/50 text-rose-200 px-3 py-2.5 text-sm font-bold">{error}</div>}

            <button disabled={loading} type="submit" className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow-lg hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition">
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function UserManagementModal({ onClose }) {
  const notify = useToast();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/auth/users`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Users load nahi hue.');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) { notify(err.message || 'Users load nahi hue.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/auth/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Login create nahi hua.');
      notify('New login account created successfully!');
      setForm({ username: '', password: '', role: 'staff' });
      await loadUsers();
    } catch (err) { notify(err.message || 'Login create nahi hua.', 'error'); }
    finally { setSaving(false); }
  };

  const changeUser = async (id, payload, successMessage) => {
    try {
      const res = await apiFetch(`${API_BASE}/auth/users/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Update failed.');
      notify(successMessage || 'Login updated.');
      await loadUsers();
    } catch (err) { notify(err.message || 'Update failed.', 'error'); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Ye login account delete karna hai?')) return;
    try {
      const res = await apiFetch(`${API_BASE}/auth/users/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Delete failed.');
      notify('Login account deleted.');
      await loadUsers();
    } catch (err) { notify(err.message || 'Delete failed.', 'error'); }
  };

  const roleLabel = (role) => role === 'admin' ? 'Admin' : role === 'special_staff' ? 'Special Staff' : 'Normal Staff';

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 md:p-7">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-xl font-black text-white">Login Account Management</h3>
            <p className="text-xs text-slate-400 mt-1">Admin yahan se multiple Admin, Special Staff aur Normal Staff logins bana sakta hai.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold">Close</button>
        </div>

        <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950/50 border border-slate-800 rounded-2xl p-4 mb-5">
          <input required minLength={3} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-white" placeholder="Username" />
          <input required minLength={6} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-white" placeholder="Password (6+)" />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-white">
            <option value="staff">Normal Staff — Billing only</option>
            <option value="special_staff">Special Staff — Bills + Parties + Staff/Expenses</option>
            <option value="admin">Admin — Full Access</option>
          </select>
          <button disabled={saving} className="p-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black disabled:opacity-60">{saving ? 'Creating...' : 'Create Login'}</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/70 text-slate-400 uppercase text-xs">
              <tr><th className="p-3 text-left">Username</th><th className="p-3 text-left">Access</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? <tr><td colSpan="4" className="p-6 text-center text-slate-400">Loading...</td></tr> : users.map(u => (
                <tr key={u._id}>
                  <td className="p-3 font-bold text-white">{u.username}</td>
                  <td className="p-3 text-amber-300 font-bold">{roleLabel(u.role)}</td>
                  <td className="p-3"><span className={u.active ? 'text-emerald-400' : 'text-rose-400'}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-3 flex flex-wrap gap-2">
                    <select value={u.role} onChange={e => changeUser(u._id, { role: e.target.value }, 'Access updated.')} className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs">
                      <option value="staff">Normal Staff</option><option value="special_staff">Special Staff</option><option value="admin">Admin</option>
                    </select>
                    <button type="button" onClick={() => { const p = window.prompt('New password (minimum 6 characters):'); if (p) changeUser(u._id, { password: p }, 'Password changed.'); }} className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-bold">Password</button>
                    <button type="button" onClick={() => changeUser(u._id, { active: !u.active }, u.active ? 'Login disabled.' : 'Login enabled.')} className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold">{u.active ? 'Disable' : 'Enable'}</button>
                    <button type="button" onClick={() => deleteUser(u._id)} className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/30 text-rose-300 text-xs font-bold">Delete</button>
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

function AppContent({ user, onLogout }) {
  const THEME_KEY = 'supergold_erp_theme';
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-erp-theme', theme);
    document.body.classList.toggle('erp-light-mode', theme === 'light');
    return () => document.body.classList.remove('erp-light-mode');
  }, [theme]);

  const ThemeToggle = () => (
    <button
      type="button"
      onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`px-3 py-2 rounded-xl text-xs font-black border transition flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'}`}
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
  const initialRoute = user.role === 'staff' ? '#staff-billing' : '#admin';
  const [route, setRoute] = useState(initialRoute);
  const ACTIVE_TAB_KEY = `supergold_active_tab_${user.role}`;

const [activeTab, setActiveTab] = useState(() => {
  const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);

  if (savedTab) {
    return savedTab;
  }

  return user.role === 'admin' || user.role === 'special_staff'
    ? 'dashboard'
    : 'billing';
});

useEffect(() => {
  localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
}, [activeTab]);
  const [showUserManager, setShowUserManager] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState(null);
  const [invoiceReturnTab, setInvoiceReturnTab] = useState('billing');
  const [parties, setParties] = useState([]);
  const [articles, setArticles] = useState([]);
  const [bills, setBills] = useState([]);
  const [partyPayments, setPartyPayments] = useState([]);
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
  }, [user.role]);

  useEffect(() => {
    const handleExpired = () => onLogout();
    window.addEventListener('supergold-auth-expired', handleExpired);
    return () => window.removeEventListener('supergold-auth-expired', handleExpired);
  }, [onLogout]);

  useEffect(() => {
    const IDLE_TIMEOUT = 30 * 60 * 1000;
    let lastWrite = 0;
    const markActivity = () => {
      const now = Date.now();
      if (now - lastWrite >= 15000) {
        lastWrite = now;
        setLastActivity(now);
      }
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, markActivity, { passive: true }));
    setLastActivity();

    const heartbeat = window.setInterval(() => {
  const token = getAuthToken();
  if (!token) return;

  apiFetch(`${API_BASE}/auth/me`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Session expired');
      }
      setLastActivity();
    })
    .catch(() => {});
}, 5 * 60 * 1000);

    const timer = window.setInterval(() => {
      const last = Number(getAuthStorage().getItem('supergold_last_activity') || 0);
      if (!last || Date.now() - last >= IDLE_TIMEOUT) {
        clearAuthStorage();
        window.dispatchEvent(new Event('supergold-auth-expired'));
      }
    }, 5000);

    return () => {
      events.forEach(event => window.removeEventListener(event, markActivity));
      window.clearInterval(timer);
    };
  }, [onLogout]);

  const fetchAllData = async () => {
  await Promise.all([
    fetchParties(),
    fetchArticles(),
    fetchBills(),
    fetchPartyPayments(),
    ...(user.role === 'admin' ? [fetchStocks()] : []),
    ...((user.role === 'admin' || user.role === 'special_staff') ? [fetchStaff()] : [])
  ]);
};

  const fetchParties = () => apiFetch(`${API_BASE}/parties`).then(r => r.json()).then(d => setParties(Array.isArray(d) ? d : []));
  const fetchArticles = () => apiFetch(`${API_BASE}/articles`).then(r => r.json()).then(d => setArticles(Array.isArray(d) ? d : []));
  const fetchBills = () => apiFetch(`${API_BASE}/bills`).then(r => r.json()).then(d => setBills(Array.isArray(d) ? d : []));
  const fetchPartyPayments = async () => {
  try {
    const res = await apiFetch(`${API_BASE}/party-payments`);
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      throw new Error(data.error || data.message || 'Party payments fetch failed');
    }

    setPartyPayments(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('Party payments fetch error:', err);
    setPartyPayments([]);
  }
};
  const fetchStocks = () => apiFetch(`${API_BASE}/stock`).then(r => r.json()).then(d => setStocks(Array.isArray(d) ? d : []));
  const fetchStaff = () => apiFetch(`${API_BASE}/staff`).then(r => r.json()).then(d => setStaffList(Array.isArray(d) ? d : []));

  const handleOpenInvoice = (billId) => {
  setSelectedBillId(billId);

  if (user.role !== 'staff') {
    setInvoiceReturnTab(activeTab);
    setActiveTab('invoiceView');
  } else {
    window.location.hash = `#invoice-${billId}`;
  }
};

  const isStaffRoute = user.role === 'staff';
  const isSingleInvoiceRoute = route.startsWith('#invoice-');

  if (isSingleInvoiceRoute) {
    const invoiceId = route.replace('#invoice-', '');
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans text-slate-100 flex justify-center items-center">
        <div className="w-full max-w-3xl flex justify-center">
          <InvoiceView billId={invoiceId} bills={bills} parties={parties} partyPayments={partyPayments} onBack={() => { window.location.hash = user.role === 'staff' ? '#staff-billing' : '#admin'; }} />
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
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Terminal Active
            </div>
            <ThemeToggle />
            <button type="button" onClick={onLogout} className="px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/30 border border-rose-800/50 hover:bg-rose-900/40 transition">Logout</button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4 md:p-6">
          <BillingTab
            parties={parties}
            bills={bills}
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
      <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 text-white px-3 py-2 md:px-6 md:py-4 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4 shadow-xl sticky top-0 z-40">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-gradient-to-r from-amber-500 to-yellow-600 p-1.5 md:p-2.5 rounded-xl shadow-md">
            <Building2 className="w-5 h-5 md:w-6 md:h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <h2 className="text-base md:text-xl font-black tracking-wider text-amber-400">SUPER GOLD ERP</h2>
            <span className="text-[8px] md:text-xs font-semibold text-slate-400">
  {user.role === 'special_staff'
    ? `${user.name || user.username || 'Special Staff'}`
    : `${user.name || user.username || 'Admin'} — Admin Control`}
</span>
          </div>
        </div>
        <nav className="flex flex-wrap justify-center gap-1 md:gap-2">
          {[
            ...(user.role === 'admin' || user.role === 'special_staff'
              ? [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }]
              : []),
            { id: 'billing', label: 'Create Bill', icon: Receipt },
            ...(user.role === 'admin' || user.role === 'special_staff'
              ? [{ id: 'articles', label: 'Articles', icon: Tag }]
              : []),
            ...(user.role === 'admin'
              ? [{ id: 'stock', label: 'Stock', icon: Package }]
              : []),
            { id: 'parties', label: 'Parties', icon: Users },
            ...(user.role === 'admin' || user.role === 'special_staff' ? [{ id: 'staff', label: 'Staff & Expenses', icon: UserCheck }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1.5 md:px-3.5 md:py-2 rounded-xl text-[10px] md:text-xs font-bold transition flex items-center gap-1 md:gap-2 ${active ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-lg font-black' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
              >
                <Icon className="w-3 h-3 md:w-4 md:h-4" /> {tab.label}
              </button>
            );
          })}
          {user.role === 'admin' && <>
            <button type="button" onClick={() => setShowUserManager(true)} className="ml-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-800/60 hover:bg-amber-900/50 transition">Login Users</button>
            {/* <a href="#staff-billing" className="px-2 py-1.5 md:px-3 md:py-2 rounded-xl text-[9px] md:text-xs font-bold text-amber-400 bg-amber-950/40 border border-amber-800/60 hover:bg-amber-900/50 transition flex items-center gap-1">Staff View →</a> */}
          </>}
          <ThemeToggle />
          <button type="button" onClick={onLogout} className="px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/30 border border-rose-800/50 hover:bg-rose-900/40 transition">Logout</button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6">
        {(user.role === 'admin' || user.role === 'special_staff') && activeTab === 'dashboard' && <AdminDashboard bills={bills} partyPayments={partyPayments} parties={parties} stocks={stocks} articles={articles} sizeRanges={sizeRanges} onViewInvoice={handleOpenInvoice} onRefreshBills={fetchBills} onRefreshAll={fetchAllData} userRole={user.role} />}
        {activeTab === 'billing' && (
          <BillingTab
            parties={parties}
            articles={articles}
            bills={bills}
            sizeRanges={sizeRanges}
            setSizeRanges={setSizeRanges}
            onBillCreated={fetchAllData}
            onViewInvoice={handleOpenInvoice}
            onRefreshParties={fetchParties}
            isStaffMode={false}
          />
        )}
        {user.role === 'admin' && activeTab === 'stock' && <StockInwardTab articles={articles} stocks={stocks} sizeRanges={sizeRanges} setSizeRanges={setSizeRanges} onStockUpdated={fetchAllData} />}
        {activeTab === 'parties' && <PartiesTab parties={parties} onPartyAdded={fetchAllData} />}
        {(user.role === 'admin' || user.role === 'special_staff') && activeTab === 'articles' && <ArticlesTab articles={articles} stocks={stocks} sizeRanges={sizeRanges} setSizeRanges={setSizeRanges} onArticleAdded={fetchAllData} />}
        {(user.role === 'admin' || user.role === 'special_staff') && activeTab === 'staff' && <StaffTab staffList={staffList} onStaffUpdated={fetchStaff} />}
        {activeTab === 'invoiceView' && (
          <div className="flex justify-center w-full my-4">
            <InvoiceView billId={selectedBillId} bills={bills} parties={parties} partyPayments={partyPayments} onBack={() => setActiveTab(invoiceReturnTab)} />
          </div>
        )}
      </main>
      {showUserManager && user.role === 'admin' && <UserManagementModal onClose={() => setShowUserManager(false)} />}
    </div>
  );
}


// ==================== LIGHT / DARK THEME OVERRIDES ====================
const ERPThemeStyles = () => (
  <style>{`
    /* SuperGold ERP — clean professional light theme */
    body.erp-light-mode {
      background: #f4f7fb !important;
      color: #172b4d !important;
    }

    body.erp-light-mode header {
      background: rgba(255,255,255,.96) !important;
      color: #172b4d !important;
      border-color: #e3e8ef !important;
      box-shadow: 0 2px 12px rgba(15,23,42,.06) !important;
    }

    body.erp-light-mode main {
      color: #172b4d !important;
    }

    body.erp-light-mode .bg-slate-950 { background-color: #f4f7fb !important; }
    body.erp-light-mode .bg-slate-950\/95,
    body.erp-light-mode .bg-slate-950\/90,
    body.erp-light-mode .bg-slate-950\/80,
    body.erp-light-mode .bg-slate-900,
    body.erp-light-mode .bg-slate-900\/95,
    body.erp-light-mode .bg-slate-900\/90,
    body.erp-light-mode .bg-slate-900\/80,
    body.erp-light-mode .bg-slate-900\/70,
    body.erp-light-mode .bg-slate-900\/60 {
      background-color: #ffffff !important;
    }
    body.erp-light-mode .bg-slate-950\/60,
    body.erp-light-mode .bg-slate-950\/50,
    body.erp-light-mode .bg-slate-950\/40 {
      background-color: #fbfcfe !important;
    }

    body.erp-light-mode .bg-slate-800,
    body.erp-light-mode .bg-slate-800\/70,
    body.erp-light-mode .bg-slate-800\/60,
    body.erp-light-mode .bg-slate-800\/50,
    body.erp-light-mode .bg-slate-800\/40,
    body.erp-light-mode .bg-slate-800\/30,
    body.erp-light-mode .bg-slate-700 {
      background-color: #f8fafc !important;
    }

    body.erp-light-mode .border-slate-800,
    body.erp-light-mode .border-slate-700,
    body.erp-light-mode .border-slate-800\/60,
    body.erp-light-mode .border-slate-700\/50 {
      border-color: #e3e8ef !important;
    }

    body.erp-light-mode .text-white { color: #344054 !important; }
    body.erp-light-mode .text-slate-100 { color: #3f4a5a !important; }
    body.erp-light-mode .text-slate-200 { color: #475467 !important; }
    body.erp-light-mode .text-slate-300 { color: #667085 !important; }
    body.erp-light-mode .text-slate-400 { color: #333333 !important; }
    body.erp-light-mode .text-slate-500 { color: #98a2b3 !important; }
    body.erp-light-mode .text-slate-600 { color: #667085 !important; }
    body.erp-light-mode .text-slate-700 { color: #475467 !important; }
    body.erp-light-mode .text-slate-800 { color: #344054 !important; }

    /* Secondary controls and status chips */
    body.erp-light-mode .bg-amber-950\/40 { background-color: #fff8df !important; }
    body.erp-light-mode .bg-amber-900\/50 { background-color: #fff2bf !important; }
    body.erp-light-mode .border-amber-800\/60 { border-color: #f2c94c !important; }
    body.erp-light-mode .bg-rose-950\/30 { background-color: #fff1f2 !important; }
    body.erp-light-mode .border-rose-800\/50 { border-color: #fecdd3 !important; }
    body.erp-light-mode .bg-emerald-500\/10 { background-color: #ecfdf3 !important; }
    body.erp-light-mode .border-emerald-500\/30 { border-color: #a7f3d0 !important; }
    body.erp-light-mode .bg-blue-600\/20 { background-color: #eef5ff !important; }
    body.erp-light-mode .border-blue-500\/30 { border-color: #bfdbfe !important; }

    body.erp-light-mode input,
    body.erp-light-mode select,
    body.erp-light-mode textarea {
      background: #ffffff !important;
      color: #344054 !important;
      border-color: #d9dee7 !important;
      box-shadow: 0 1px 2px rgba(16,24,40,.03) !important;
    }
    body.erp-light-mode input:focus,
    body.erp-light-mode select:focus,
    body.erp-light-mode textarea:focus {
      border-color: #d6a72b !important;
      box-shadow: 0 0 0 3px rgba(214,167,43,.10) !important;
    }
    body.erp-light-mode input::placeholder,
    body.erp-light-mode textarea::placeholder { color: #a4acb9 !important; }

    body.erp-light-mode table thead {
      background: #f8f9fb !important;
      color: #667085 !important;
    }
    body.erp-light-mode table tbody tr:hover { background: #f8fafc !important; }
    body.erp-light-mode table tbody tr { border-color: #e8edf3 !important; }
    body.erp-light-mode table td,
    body.erp-light-mode table th { border-color: #e8edf3 !important; }

    /* White cards with the same soft depth as the reference light UI */
    body.erp-light-mode .rounded-2xl.bg-slate-900,
    body.erp-light-mode .rounded-2xl.bg-slate-800,
    body.erp-light-mode .rounded-xl.bg-slate-900,
    body.erp-light-mode .rounded-xl.bg-slate-800 {
      background-color: #ffffff !important;
    }

    body.erp-light-mode .shadow-xl,
    body.erp-light-mode .shadow-2xl {
      box-shadow: 0 8px 28px rgba(16,24,40,.055) !important;
    }

    /* Keep semantic colors soft in light mode */
    body.erp-light-mode .bg-emerald-500\/15 { background-color: #eefbf4 !important; }
    body.erp-light-mode .bg-emerald-500\/20 { background-color: #edf9f2 !important; }
    body.erp-light-mode .bg-amber-500\/15,
    body.erp-light-mode .bg-amber-500\/20 { background-color: #fff8e7 !important; }
    body.erp-light-mode .bg-blue-600\/20 { background-color: #eef5ff !important; }
    body.erp-light-mode .bg-rose-600\/20,
    body.erp-light-mode .bg-rose-500\/20 { background-color: #fff1f2 !important; }
    body.erp-light-mode .bg-purple-500\/10 { background-color: #f6f1ff !important; }
    body.erp-light-mode .bg-sky-500\/10 { background-color: #eef8ff !important; }

    body.erp-light-mode .hover\:bg-slate-800:hover { background-color: #fbbf24 !important; }
    body.erp-light-mode .hover\:bg-slate-800\/40:hover,
    body.erp-light-mode .hover\:bg-slate-800\/30:hover { background-color: #f7f9fc !important; }
    body.erp-light-mode .hover\:bg-slate-800:hover { background-color: #fbbf24 !important; }

    /* Lighten dark modal surfaces without flattening the whole UI */
    body.erp-light-mode .bg-black\/70 { background-color: rgba(15,23,42,.38) !important; }
    body.erp-light-mode .bg-black\/60 { background-color: rgba(15,23,42,.32) !important; }
  `}</style>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const logout = React.useCallback(() => {
    const token = getAuthToken();
    if (token) {
      window.fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true
      }).catch(() => { });
    }
    clearAuthStorage();
    setUser(null);
    if (window.location.hash) window.location.hash = '';
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      clearAuthStorage();
      setUser(null);
    };
    window.addEventListener('supergold-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('supergold-auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('supergold_auth_user') || sessionStorage.getItem('supergold_auth_user');
    const token = getAuthToken();
    const lastActivity = Number(localStorage.getItem('supergold_last_activity') || sessionStorage.getItem('supergold_last_activity') || '0');
    if (!stored || !token || !lastActivity || (Date.now() - lastActivity) >= (30 * 60 * 1000)) {
      clearAuthStorage();
      setChecking(false);
      return;
    }
    window.fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Session expired')))
      .then(data => { setLastActivity(); setUser(data.user); })
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [logout]);

  if (checking) {
    return <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center font-sans">Checking login...</div>;
  }

  return <ToastProvider>
    <ERPThemeStyles />
    {user ? <AppContent user={user} onLogout={logout} /> : <LoginScreen onLogin={setUser} />}
  </ToastProvider>;
}


function EditBillModal({ bill, parties, articles, bills, sizeRanges, onClose, onSaved }) {
  const notify = useToast();
  const selectedInitialParty = parties.find((p) => String(p._id) === String(bill.partyId));
  const normalizeSale = (item) => {
    const totalPairs = Math.max(0, Number(item.totalPairs || item.loosePairs || 0));
    const rate = Number(item.rate || 0);
    return {
      articleCode: item.articleCode || '',
      articleId: item.articleId || '',
      isCustom: !!item.isCustom,
      size: item.size || '6*9 (Gents)',
      color: item.color || '',
      totalPairs,
      mrp: Number(item.mrp || 0),
      discountPercent: Number(item.discountPercent || 0),
      rate,
      totalAmount: Number(item.totalAmount ?? totalPairs * rate)
    };
  };
  const normalizeReturn = (item) => {
    const totalPairs = Math.max(0, Number(item.totalPairs || 0));
    const rate = Number(item.rate || 0);
    return {
      articleCode: item.articleCode || '',
      articleId: item.articleId || '',
      isCustom: !!item.isCustom,
      size: item.size || '6*9 (Gents)',
      color: item.color || '',
      totalPairs,
      rate,
      totalAmount: Number(item.totalAmount ?? totalPairs * rate)
    };
  };

  const [selectedParty, setSelectedParty] = useState(String(bill.partyId || ''));

const previousBillForEdit = (Array.isArray(bills) ? bills : [])
  .filter((b) => {
    if (String(b.partyId) !== String(bill.partyId)) return false;
    if (String(b._id) === String(bill._id)) return false;

    const currentDate = new Date(bill.billDate || 0).getTime();
    const otherDate = new Date(b.billDate || 0).getTime();

    if (otherDate < currentDate) return true;

    if (
      otherDate === currentDate &&
      Number(b.billNo || 0) < Number(bill.billNo || 0)
    ) {
      return true;
    }

    return false;
  })
  .sort((a, b) => {
    const dateDiff =
      new Date(b.billDate || 0).getTime() -
      new Date(a.billDate || 0).getTime();

    if (dateDiff !== 0) return dateDiff;

    return Number(b.billNo || 0) - Number(a.billNo || 0);
  })[0];

const editParty = (Array.isArray(parties) ? parties : []).find(
  (p) => String(p._id) === String(bill.partyId)
);

const initialPreviousBalance = previousBillForEdit
  ? Number(previousBillForEdit.dueBalance || 0)
  : Number(editParty?.openingBalance || 0);

const [previousBalance, setPreviousBalance] = useState(initialPreviousBalance);
  const [items, setItems] = useState((bill.items || []).map(normalizeSale));
  const [returnItems, setReturnItems] = useState((bill.returnItems || []).map(normalizeReturn));
  const [discountVal, setDiscountVal] = useState(String(Number(bill.discountVal || 0)));
  const [cashPaid, setCashPaid] = useState(String(Number(bill.cashPaid || 0)));
  const [onlinePaid, setOnlinePaid] = useState(String(Number(bill.onlinePaid || 0)));
  const [advancePaid, setAdvancePaid] = useState(String(Number(bill.advancePaid || 0)));
  const [saving, setSaving] = useState(false);

  

  const updateSale = (index, field, value) => {
    setItems((current) => current.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [field]: value };

      if (field === 'articleCode') {
        const article = articles.find((a) => String(a._id) === String(value))
          || articles.find((a) => String(a.articleCode || '').trim().toUpperCase() === String(value || '').trim().toUpperCase());
        if (article) {
          next.isCustom = false;
          next.articleId = article._id || '';
          next.articleCode = String(article.articleCode || '').trim().toUpperCase();
          next.color = article.color || '';
          next.size = article.sizeRange || next.size;
          next.mrp = Number(article.mrp || 0);
          next.rate = Number(article.sellingPrice || article.wholesaleRate || 0);
          next.discountPercent = next.mrp > 0 ? Number((((next.mrp - next.rate) / next.mrp) * 100).toFixed(2)) : 0;
        } else {
          next.articleId = '';
          next.articleCode = String(value || '').trim().toUpperCase();
          next.isCustom = true;
        }
      }

      if (field === 'mrp' || field === 'discountPercent') {
        const mrp = Math.max(0, Number(field === 'mrp' ? value : next.mrp || 0));
        const discount = Math.max(0, Math.min(100, Number(field === 'discountPercent' ? value : next.discountPercent || 0)));
        next.mrp = mrp;
        next.discountPercent = discount;
        next.rate = Number((mrp * (1 - discount / 100)).toFixed(2));
      }

      next.totalPairs = Math.max(0, parseInt(field === 'totalPairs' ? value : next.totalPairs || 0, 10) || 0);
      next.totalAmount = Number((next.totalPairs * Number(next.rate || 0)).toFixed(2));
      return next;
    }));
  };

  const updateReturn = (index, field, value) => {
    setReturnItems((current) => current.map((row, i) => {
      if (i !== index) return row;
      const next = { ...row, [field]: value };

      if (field === 'articleCode') {
        const code = String(value || '').trim().toUpperCase();
        next.articleCode = code;

        if (!code) {
          next.isCustom = false;
          next.size = '6*9 (Gents)';
          next.color = '';
          next.rate = 0;
        } else {
          const article = articles.find((a) => String(a._id) === String(value))
            || articles.find((a) => String(a.articleCode || '').trim().toUpperCase() === code);
          if (article) {
            next.isCustom = false;
            next.articleId = article._id || '';
            next.articleCode = String(article.articleCode || '').trim().toUpperCase();
            next.color = article.color || '';
            next.size = article.sizeRange || next.size || '6*9 (Gents)';
            next.rate = Number(article.sellingPrice || article.wholesaleRate || 0);
          } else {
            next.isCustom = true;
          }
        }
      }

      if (field === 'rate') {
        next.rate = Math.max(0, Number(value || 0));
      }

      next.totalPairs = Math.max(0, parseInt(field === 'totalPairs' ? value : next.totalPairs || 0, 10) || 0);
      next.totalAmount = Number((next.totalPairs * Number(next.rate || 0)).toFixed(2));
      return next;
    }));
  };

  const rawTotal = items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const returnTotal = returnItems.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const todayTotal = Math.max(0, rawTotal - returnTotal - Math.max(0, Number(discountVal || 0)));
  const amountPaid = Math.max(0, Number(cashPaid || 0)) + Math.max(0, Number(onlinePaid || 0)) + Math.max(0, Number(advancePaid || 0));
  const dueBalance = todayTotal + Number(previousBalance || 0) - amountPaid;

  const changeParty = (id) => {
  setSelectedParty(id);

  const party = parties.find(
    (p) => String(p._id) === String(id)
  );

  const currentBillDate = new Date(bill.billDate || 0).getTime();

  const previousBill = (Array.isArray(bills) ? bills : [])
    .filter((b) => {
      if (String(b.partyId) !== String(id)) return false;
      if (String(b._id) === String(bill._id)) return false;

      const otherDate = new Date(b.billDate || 0).getTime();

      if (otherDate < currentBillDate) return true;

      return (
        otherDate === currentBillDate &&
        Number(b.billNo || 0) < Number(bill.billNo || 0)
      );
    })
    .sort((a, b) => {
      const dateDiff =
        new Date(b.billDate || 0).getTime() -
        new Date(a.billDate || 0).getTime();

      if (dateDiff !== 0) return dateDiff;

      return Number(b.billNo || 0) - Number(a.billNo || 0);
    })[0];

  const previousBalanceValue = previousBill
    ? Number(previousBill.dueBalance || 0)
    : Number(party?.openingBalance || 0);

  setPreviousBalance(previousBalanceValue);
};

  const save = async () => {
    if (!selectedParty) return notify('Kripya Party select karein!', 'error');
    if (!items.length) return notify('Kam se kam ek sale item hona chahiye.', 'error');
    if (items.some((item) => !String(item.articleCode || '').trim() || Number(item.totalPairs || 0) <= 0)) {
      return notify('Sale items me Article Code aur Total Pairs check karein.', 'error');
    }

    setSaving(true);
    try {
      const party = parties.find((p) => String(p._id) === String(selectedParty));
      const payload = {
        partyId: selectedParty,
        partyName: party?.name || bill.partyName || '',
        items: items.map((item) => ({ ...item, totalPairs: Number(item.totalPairs || 0), totalAmount: Number(item.totalAmount || 0) })),
        returnItems: returnItems.map((item) => ({ ...item, totalPairs: Number(item.totalPairs || 0), totalAmount: Number(item.totalAmount || 0) })),
        rawTotal,
        returnTotal,
        discountVal: Math.max(0, Number(discountVal || 0)),
        todayTotal,
        previousBalance: Number(previousBalance || 0),
        cashPaid: Math.max(0, Number(cashPaid || 0)),
        onlinePaid: Math.max(0, Number(onlinePaid || 0)),
        advancePaid: Math.max(0, Number(advancePaid || 0)),
        amountPaid,
        dueBalance
      };

      const res = await apiFetch(`${API_BASE}/bills/${bill._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bill update failed');

      notify(`Bill #${bill.billNo} updated successfully!`);
      await onSaved(data);
      onClose();
    } catch (err) {
      notify(err.message || 'Bill update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addSale = () => setItems((v) => [...v, { articleCode: '', articleId: '', isCustom: false, size: '6*9 (Gents)', color: '', totalPairs: 0, mrp: '', discountPercent: 0, rate: 0, totalAmount: 0 }]);
  const addReturn = () => setReturnItems((v) => [...v, { articleCode: '', articleId: '', isCustom: false, size: '6*9 (Gents)', color: '', totalPairs: 0, rate: 0, totalAmount: 0 }]);

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
      <div className="w-full max-w-7xl max-h-[95vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">Edit Bill #{bill.billNo}</h2>
            <p className="text-xs text-slate-400 mt-1">Bill number aur original bill date same rahenge.</p>
          </div>
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">Close</button>
        </div>

        <div className="p-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Party</label>
              <select value={selectedParty} onChange={(e) => changeParty(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold">
                {parties.map((p) => <option key={p._id} value={p._id}>{p.name}{p.city ? ` (${p.city})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Previous Ledger Due</label>
              <input value={`₹${Number(previousBalance || 0).toFixed(2)}`} readOnly className="w-full p-3 bg-rose-950/30 border border-rose-800/50 text-rose-300 font-black rounded-xl" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-amber-300">Sale Items</h3>
              <button type="button" onClick={addSale} className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200">+ Add Item</button>
            </div>
            <div className="overflow-x-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/70 text-slate-300">
                  <tr><th className="p-3">Article</th><th className="p-3">Size</th><th className="p-3">Color</th><th className="p-3">Pairs</th><th className="p-3">MRP</th><th className="p-3">Disc %</th><th className="p-3">Rate</th><th className="p-3">Amount</th><th className="p-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="p-2"><input list={`edit-articles-${bill._id}`} value={item.articleCode} onChange={(e) => updateSale(i, 'articleCode', e.target.value.toUpperCase())} className="w-32 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold" /></td>
                      <td className="p-2"><select value={item.size} onChange={(e) => updateSale(i, 'size', e.target.value)} className="w-32 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white">{sizeRanges.map((x) => <option key={x}>{x}</option>)}{!sizeRanges.includes(item.size) && <option>{item.size}</option>}</select></td>
                      <td className="p-2"><input value={item.color} onChange={(e) => updateSale(i, 'color', e.target.value)} className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white" /></td>
                      <td className="p-2"><input type="number" min="0" value={item.totalPairs} onChange={(e) => updateSale(i, 'totalPairs', e.target.value)} className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold" /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={item.mrp} onChange={(e) => updateSale(i, 'mrp', e.target.value)} className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white" /></td>
                      <td className="p-2"><input type="number" min="0" max="100" step="0.01" value={item.discountPercent} onChange={(e) => updateSale(i, 'discountPercent', e.target.value)} className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-amber-300" /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateSale(i, 'rate', e.target.value)} className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold" /></td>
                      <td className="p-2 font-black text-amber-400">₹{Number(item.totalAmount || 0).toFixed(2)}</td>
                      <td className="p-2"><button type="button" onClick={() => setItems((v) => v.filter((_, x) => x !== i))} className="text-rose-400 font-bold">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <datalist id={`edit-articles-${bill._id}`}>{articles.map((a) => <option key={a._id} value={a.articleCode}>{a.brand || ''}</option>)}</datalist>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-amber-300">Return Items</h3>
              <button type="button" onClick={addReturn} className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300">+ Add Return</button>
            </div>
            {returnItems.length > 0 && (
              <div className="overflow-x-auto border border-amber-900/40 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-amber-950/30 text-amber-200"><tr><th className="p-3">Article</th><th className="p-3">Size</th><th className="p-3">Color</th><th className="p-3">Pairs</th><th className="p-3">Rate</th><th className="p-3">Amount</th><th className="p-3"></th></tr></thead>
                  <tbody className="divide-y divide-amber-900/30">
                    {returnItems.map((item, i) => (
                      <tr key={i}>
                        <td className="p-2">
                          {item.isCustom ? (
                            <div className="flex gap-1">
                              <input value={item.articleCode} onChange={(e) => updateReturn(i, 'articleCode', e.target.value.toUpperCase())} placeholder="Enter Article" className="w-32 p-2 bg-slate-800 border border-amber-500 rounded-lg text-xs text-amber-300 font-bold uppercase" />
                              <button type="button" onClick={() => updateReturn(i, 'articleCode', '')} className="text-xs text-slate-400 hover:text-white">✕</button>
                            </div>
                          ) : (
                            <SearchableBillingDropdown
                              value={item.articleCode}
                              onChange={(value) => updateReturn(i, 'articleCode', value)}
                              placeholder="Search article..."
                              className="w-36"
                              options={[...articles.map((a) => ({ value: String(a.articleCode || '').toUpperCase(), label: String(a.articleCode || '').toUpperCase() })), { value: 'ADD_CUSTOM_ARTICLE', label: '✍️ Enter Custom Article Code...' }]}
                            />
                          )}
                        </td>
                        <td className="p-2">
                          <SearchableBillingDropdown
                            value={item.size}
                            onChange={(value) => updateReturn(i, 'size', value)}
                            placeholder="Search size..."
                            className="w-36"
                            options={sizeRanges.map((x) => ({ value: x, label: x }))}
                          />
                        </td>
                        <td className="p-2"><input value={item.color} onChange={(e) => updateReturn(i, 'color', e.target.value)} className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white" /></td>
                        <td className="p-2"><input type="number" min="0" value={item.totalPairs} onChange={(e) => updateReturn(i, 'totalPairs', e.target.value)} className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold" /></td>
                        <td className="p-2"><input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateReturn(i, 'rate', e.target.value)} className="w-24 p-2 bg-slate-800 border border-slate-700 rounded-lg text-white" /></td>
                        <td className="p-2 font-black text-amber-400">- ₹{Number(item.totalAmount || 0).toFixed(2)}</td>
                        <td className="p-2"><button type="button" onClick={() => setReturnItems((v) => v.filter((_, x) => x !== i))} className="text-rose-400 font-bold">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-black text-amber-300">Bill Calculation</h3>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Sale Total</span><b className="text-white">₹{rawTotal.toFixed(2)}</b></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Return Total</span><b className="text-white">- ₹{returnTotal.toFixed(2)}</b></div>
              <label className="flex justify-between items-center gap-3 text-sm"><span className="text-slate-400">Discount</span><input type="number" min="0" step="0.01" value={discountVal} onChange={(e) => setDiscountVal(e.target.value)} className="w-32 p-2 bg-slate-800 border border-slate-700 rounded-lg text-amber-300 font-bold" /></label>
              <div className="border-t border-slate-700 pt-3 flex justify-between text-base"><span className="text-white font-black">Today's Total</span><b className="text-amber-400">₹{todayTotal.toFixed(2)}</b></div>
              <div className="flex justify-between text-sm"><span className="text-slate-400">Previous Due</span><b className="text-rose-400">₹{Number(previousBalance || 0).toFixed(2)}</b></div>
            </div>
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-black text-amber-300">Payment</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-xs text-slate-400">Cash<input type="number" min="0" step="0.01" value={cashPaid} onChange={(e) => setCashPaid(e.target.value)} className="mt-1 w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-emerald-300 font-bold" /></label>
                <label className="text-xs text-slate-400">Online<input type="number" min="0" step="0.01" value={onlinePaid} onChange={(e) => setOnlinePaid(e.target.value)} className="mt-1 w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-cyan-300 font-bold" /></label>
                <label className="text-xs text-slate-400">Advance<input type="number" min="0" step="0.01" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} className="mt-1 w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-emerald-300 font-bold" /></label>
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between"><span className="text-white font-black">Total Paid</span><b className="text-emerald-400">₹{amountPaid.toFixed(2)}</b></div>
              <div className="flex justify-between text-base"><span className="text-white font-black">New Due</span><b className="text-rose-400">₹{dueBalance.toFixed(2)}</b></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold">Cancel</button>
            <button type="button" disabled={saving} onClick={save} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black disabled:opacity-60">{saving ? 'Saving...' : 'Save Bill Changes'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== DASHBOARD WITH EDIT / DELETE BILLS ====================
function AdminDashboard({ bills, partyPayments, parties, stocks, articles, sizeRanges, onViewInvoice, onRefreshBills, onRefreshAll, userRole }) {
  const notify = useToast();
  const [timeFilter, setTimeFilter] = useState(
  'LAST_7_DAYS'
);
  const [editingBillId, setEditingBillId] = useState(null);
  const [billEditForm, setBillEditForm] = useState({ todayTotal: 0, amountPaid: 0, dueBalance: 0, cashPaid: 0, onlinePaid: 0 });
  const [editingBill, setEditingBill] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const filteredBills = bills.filter(b => {
    if (timeFilter === 'ALL') return true;
    const bDate = new Date(b.billDate || Date.now());
    const now = new Date();
    if (timeFilter === 'LAST_7_DAYS') {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      return bDate >= startDate && bDate <= now;
    }
    if (timeFilter === 'WEEK') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(startOfWeek.getDate() - diff);
      startOfWeek.setHours(0, 0, 0, 0);
      return bDate >= startOfWeek && bDate <= now;
    }
    if (timeFilter === 'MONTH') {
      return bDate.getMonth() === new Date().getMonth() && bDate.getFullYear() === new Date().getFullYear();
    }
    if (timeFilter === 'YEAR') {
      return bDate.getFullYear() === new Date().getFullYear();
    }
    return true;
  });

  const invoiceFilteredBills = filteredBills.filter((b) => {

  const partyName = b.partyName || parties.find(p => String(p._id) === String(b.partyId))?.name || '';

  const q = invoiceSearch.trim().toLowerCase();

  if (!q) return true;

  return [b.billNo, partyName, b.partyId, b.todayTotal, b.amountPaid, b.dueBalance, new Date(b.billDate || Date.now()).toLocaleDateString()]
    .some(v => String(v ?? '').toLowerCase().includes(q));

});

const filteredPartyPayments = (partyPayments || []).filter((p) => {
  const partyName = p.partyName || '';
  const q = invoiceSearch.trim().toLowerCase();

  if (!q) return true;

  return [
    'Payment',
    p.paymentDate,
    partyName,
    p.partyId,
    p.amount,
    p.paymentMode,
    p.reference,
    p.remark
  ].some(v => String(v ?? '').toLowerCase().includes(q));
});

  const totalSales = filteredBills.reduce((sum, b) => sum + (b.todayTotal || 0), 0);
  const billCash = filteredBills.reduce(
  (sum, b) => sum + Number(b.cashPaid || 0),
  0
);

const billOnline = filteredBills.reduce(
  (sum, b) => sum + Number(b.onlinePaid || 0),
  0
);

const partyPaymentCash = (filteredPartyPayments || [])
  .filter(p => p.paymentMode === 'Cash')
  .reduce((sum, p) => sum + Number(p.amount || 0), 0);

const partyPaymentOnline = (filteredPartyPayments || [])
  .filter(p => p.paymentMode === 'Online')
  .reduce((sum, p) => sum + Number(p.amount || 0), 0);

const totalCash = billCash + partyPaymentCash;
const totalOnline = billOnline + partyPaymentOnline;
const totalReceived = totalCash + totalOnline;
  const totalDue = parties.reduce((sum, p) => sum + (p.currentBalance || 0), 0);
  const totalStockPairs = stocks.reduce((sum, s) => sum + (s.totalPairs || 0), 0);

  const handleDeleteBill = async (id) => {
    if (window.confirm('Kya aap bill delete karna chahte hain?')) {
      try {
        const res = await apiFetch(`${API_BASE}/bills/${id}`, { method: 'DELETE' });
        if (res.ok) {
          notify('Bill deleted!');
          onRefreshBills();
        }
      } catch (err) { notify('Error deleting bill', 'error'); }
    }
  };

  const handleEditBill = (b) => {
    setEditingBill(b);
  };

  const saveBillEdit = async (b) => {
    setEditingBillId(null);
  };

  return (
    <div className="space-y-6">
      {userRole === 'admin' && (
        <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-extrabold text-slate-300 flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-400" /> Filter Financial Reports:
          </h3>
          <div className="flex gap-2">
            {(userRole === 'special_staff'
  ? ['LAST_7_DAYS']
  : ['ALL', 'WEEK', 'MONTH', 'YEAR', 'LAST_7_DAYS']
).map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${timeFilter === f ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
              >
                {f === 'ALL'
  ? 'All Time'
  : f === 'WEEK'
    ? 'This Week'
    : f === 'LAST_7_DAYS'
      ? 'Last 7 Days'
      : f === 'MONTH'
        ? 'This Month'
        : 'This Year'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-extrabold">Sales ({timeFilter})</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="md:text-2xl text-xl font-black text-white">₹{totalSales.toLocaleString()}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-extrabold">Received Collection</span>
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="md:text-2xl text-xl font-black text-emerald-400">₹{totalReceived.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Cash: ₹{Number(totalCash).toFixed(2)} | Online: ₹{Number(totalOnline).toFixed(2)}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-xs uppercase font-extrabold">Total Dues (Lene Hain)</span>
            <Users className="w-5 h-5 text-rose-400" />
          </div>
          <div className="md:text-2xl text-xl font-black text-rose-400">₹{totalDue.toLocaleString()}</div>
        </div>

        {userRole === 'admin' && (
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs uppercase font-extrabold">Godown Stock</span>
              <Package className="w-5 h-5 text-amber-400" />
            </div>
            <div className="md:text-2xl text-xl font-black text-white">{totalStockPairs} Pairs</div>
            <div className="text-xs text-slate-400 mt-1">{articles.length} Active Articles</div>
          </div>
        )}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 p-4 md:p-6 rounded-2xl shadow-xl overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
          <h3 className="font-extrabold text-white md:text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" /> Invoices Register
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-80">
              <input value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)} placeholder="Search invoice / party / bill no..." className="w-full p-2.5 pr-8 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500" />
              {invoiceSearch && <button type="button" onClick={() => setInvoiceSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">×</button>}
            </div>
            <button type="button" onClick={() => exportERPDataToExcel({ bills: invoiceFilteredBills, parties, articles, stocks })} className="px-3 py-2 rounded-xl text-xs font-black bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Excel
          </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-3">S.No.</th>
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
  {invoiceFilteredBills.length === 0 && filteredPartyPayments.length === 0 ? (
    <tr>
      <td colSpan="8" className="p-10 text-center text-slate-500">
        {invoiceSearch ? 'No invoices or payments match your search.' : 'No invoices or payments found.'}
      </td>
    </tr>
  ) : (
    [
      ...invoiceFilteredBills.map((b) => ({
        type: 'bill',
        date: new Date(b.billDate || Date.now()),
        data: b
      })),
      ...filteredPartyPayments.map((p) => ({
        type: 'payment',
        date: new Date(`${p.paymentDate}T00:00:00`),
        data: p
      }))
    ]
      .sort((a, b) => b.date - a.date)
      .map((row, index) => {
        if (row.type === 'payment') {
          const p = row.data;

          return (
            <tr
              key={`payment-${p._id}`}
              className="hover:bg-slate-800/30 transition"
            >
              <td className="p-3">{index + 1}</td>

              <td className="p-3 font-bold text-emerald-400">
                PAYMENT
              </td>

              <td className="p-3 text-slate-400">
                {new Date(`${p.paymentDate}T00:00:00`).toLocaleDateString()}
              </td>

              <td className="p-3 font-semibold text-slate-200">
                {p.partyName ||
                  parties.find(
                    party => String(party._id) === String(p.partyId)
                  )?.name ||
                  ''}
              </td>

              <td className="p-3 font-bold text-amber-300">
                —
              </td>

              <td className="p-3 text-emerald-400 font-bold">
                <div>₹{Number(p.amount || 0).toFixed(2)}</div>
                <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                  {p.paymentMode || 'Cash'}
                  {p.reference ? ` • ${p.reference}` : ''}
                </div>
              </td>

              <td className="p-3 text-rose-400 font-bold">
                —
              </td>

              <td className="p-3 text-center">
                <span className="text-xs text-slate-500 font-semibold">
                  Party Payment
                </span>
              </td>
            </tr>
          );
        }

        const b = row.data;

        return (
          <tr
            key={b._id}
            className="hover:bg-slate-800/30 transition"
          >
            <td className="p-3">{index + 1}</td>

            <td className="p-3 font-bold text-white">
              #{b.billNo}
            </td>

            <td className="p-3 text-slate-400">
              {new Date(b.billDate || Date.now()).toLocaleDateString()}
            </td>

            <td className="p-3 font-semibold text-slate-200">
              {b.partyName ||
                parties.find(
                  p => String(p._id) === String(b.partyId)
                )?.name ||
                ''}
            </td>

            <td className="p-3 font-bold text-amber-300">
              ₹{Number(b.todayTotal || 0).toFixed(2)}
            </td>

            <td className="p-3 text-emerald-400 font-bold">
              <div>
                ₹{Number(b.amountPaid || 0).toFixed(2)}
              </div>

              <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                Cash ₹{Number(b.cashPaid || 0)} • Online ₹{Number(b.onlinePaid || 0)}
              </div>
            </td>

            <td className="p-3 text-rose-400 font-bold">
              ₹{Number(b.dueBalance || 0).toFixed(2)}
            </td>

            <td className="p-3 text-center">
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => onViewInvoice(b._id)}
                  className="bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition"
                >
                  View
                </button>

                <button
                  onClick={() => handleEditBill(b)}
                  className="bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-lg text-xs font-bold transition"
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDeleteBill(b._id)}
                  className="bg-rose-600/20 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white px-2.5 py-1 rounded-lg text-xs font-bold transition"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        );
      })
  )}
</tbody>
          </table>
        </div>
      </div>
      {editingBill && (
        <EditBillModal
          bill={editingBill}
          parties={parties}
          articles={articles}
          bills={bills}
          sizeRanges={sizeRanges}
          onClose={() => setEditingBill(null)}
          onSaved={async () => { await onRefreshAll(); }}
        />
      )}
    </div>
  );
}

// Professional searchable dropdown used in Billing (Article / Size / Party).
function SearchableBillingDropdown({ value, options, onChange, placeholder='Search...', className='', renderOption, allowCustomValue=false, customValueLabel='Use typed value' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState({});
  const ref = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const updateMenuPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      maxHeight: '240px'
    });
  };

  useEffect(() => {
    const close = (e) => {
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));
  const label = selected ? selected.label : (value || '');
  // Reopening shows the selected value; search text is used only after typing.
  const displayValue = open && query !== '' ? query : label;
  const filtered = options.filter(o => String(o.label).toLowerCase().includes(query.toLowerCase()));

  const commitTypedValue = () => {
    const typed = String(query || '').trim();
    if (!allowCustomValue || !typed) return false;
    const existing = options.find(o => String(o.value).toLowerCase() === typed.toLowerCase());
    onChange(existing ? existing.value : typed);
    setQuery('');
    setOpen(false);
    return true;
  };

  const clearSelection = () => {
    // Clear the selected value but keep the dropdown open so all
    // Article Codes are immediately available again. Do not refocus
    // the input here; refocusing was putting it back into an empty
    // search state after clicking the cross button.
    setQuery('');
    onChange('');
    setOpen(true);
  };

  const menu = open ? createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      className="z-[99999] overflow-y-auto overflow-x-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
    >
      {filtered.length ? filtered.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
          className="w-full text-left px-3 py-2.5 text-xs text-slate-200 hover:bg-amber-500/15 hover:text-amber-300 border-b border-slate-800 last:border-0"
        >
          {renderOption ? renderOption(o) : o.label}
        </button>
      )) : (
        allowCustomValue && query.trim() ? (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => { commitTypedValue(); }}
            className="w-full text-left px-3 py-2.5 text-xs text-amber-300 hover:bg-amber-500/15 border-b border-slate-800"
          >
            ✍️ {customValueLabel}: <span className="font-black">{query.trim()}</span>
          </button>
        ) : (
          <div className="px-3 py-3 text-xs text-slate-500">No matching option</div>
        )
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onBlur={() => {
            // For Master Article / Stock Inward, a brand-new code can be typed directly.
            // Commit it when the user leaves the field, so the form can be submitted without
            // first creating a dropdown option. Existing selections are unaffected.
            if (allowCustomValue && query.trim()) commitTypedValue();
          }}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            if (next === '' && value) onChange('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && open && query === '' && value) {
              e.preventDefault();
              clearSelection();
            }
            if (e.key === 'Enter') {
              if (allowCustomValue && query.trim()) {
                e.preventDefault();
                commitTypedValue();
              }
            }
            if (e.key === 'Escape') setOpen(false);
          }}
          className="w-full p-2 pr-9 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear selection"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onClick={clearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 text-xs font-black"
          >×</button>
        )}
      </div>
      {menu}
    </div>
  );
}

// ==================== BILLING TERMINAL ====================
function BillingTab({ parties, articles, bills, sizeRanges, setSizeRanges, onBillCreated, onViewInvoice, onRefreshParties, isStaffMode }) {
  const notify = useToast();
  const [selectedParty, setSelectedParty] = useState('');
  const [partyInfo, setPartyInfo] = useState(null);
  const [partyValidationError, setPartyValidationError] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showLastBills, setShowLastBills] = useState(false);
  const [showCustomSizeModal, setShowCustomSizeModal] = useState(false);
  const [paymentBill, setPaymentBill] = useState(null);
  const [deliveryCash, setDeliveryCash] = useState('');
  const [deliveryOnline, setDeliveryOnline] = useState('');
  const [savingDeliveryPayment, setSavingDeliveryPayment] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [editingCustomSize, setEditingCustomSize] = useState(null);

  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyCity, setNewPartyCity] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');

  const [discountAmount, setDiscountAmount] = useState('0');

  const [items, setItems] = useState([
    { articleCode: '', articleId: '', isCustom: false, size: '6*9 (Gents)', color: '', cartons: 0, loosePairs: 0, totalPairs: 0, mrp: '', discountPercent: 0, rate: 0, totalAmount: 0 }
  ]);

  const [returnItems, setReturnItems] = useState([]);

  const [cashPaid, setCashPaid] = useState('');
  const [onlinePaid, setOnlinePaid] = useState('');
  const [advancePaid, setAdvancePaid] = useState('');

  const BILLING_DRAFT_KEY = 'supergold_billing_draft';

const [draftRestored, setDraftRestored] = useState(false);

// Restore saved billing draft
useEffect(() => {
  try {
    const saved = localStorage.getItem(BILLING_DRAFT_KEY);

    if (saved) {
      const draft = JSON.parse(saved);

      setSelectedParty(draft.selectedParty || '');
      setDiscountAmount(draft.discountAmount ?? '0');

      setItems(
        Array.isArray(draft.items) && draft.items.length > 0
          ? draft.items.map((item) => ({ ...item, mrp: item.mrp === 0 || item.mrp === '0' ? '' : (item.mrp ?? '') }))
          : [{
              articleCode: '',
              isCustom: false,
              size: '6*9 (Gents)',
              color: '',
              cartons: 0,
              loosePairs: 0,
              totalPairs: 0,
              mrp: '',
              discountPercent: 0,
              rate: 0,
              totalAmount: 0
            }]
      );

      setReturnItems(
        Array.isArray(draft.returnItems)
          ? draft.returnItems
          : []
      );

      setCashPaid(draft.cashPaid ?? '');
      setOnlinePaid(draft.onlinePaid ?? '');
      setAdvancePaid(draft.advancePaid ?? '');
    }
  } catch (err) {
    console.error('Billing draft restore failed:', err);
  } finally {
    setDraftRestored(true);
  }
}, []);

// Save billing draft automatically
useEffect(() => {
  if (!draftRestored) return;

  try {
    const draft = {
      selectedParty,
      discountAmount,
      items,
      returnItems,
      cashPaid,
      onlinePaid,
      advancePaid
    };

    localStorage.setItem(
      BILLING_DRAFT_KEY,
      JSON.stringify(draft)
    );
  } catch (err) {
    console.error('Billing draft save failed:', err);
  }
}, [
  draftRestored,
  selectedParty,
  discountAmount,
  items,
  returnItems,
  cashPaid,
  onlinePaid,
  advancePaid
]);

// Restore latest party information after billing draft restore
useEffect(() => {
  if (!selectedParty) {
    setPartyInfo(null);
    return;
  }

  const party = parties.find(
    (p) => String(p._id) === String(selectedParty)
  );

  if (party) {
    setPartyInfo(party);
  }
}, [selectedParty, parties]);

  const resetBillingForPartyChange = () => {
    localStorage.removeItem(BILLING_DRAFT_KEY);
    setDiscountAmount('0');
    setItems([
      {
        articleCode: '',
        isCustom: false,
        size: '6*9 (Gents)',
        color: '',
        cartons: 0,
        loosePairs: 0,
        totalPairs: 0,
        mrp: '',
        discountPercent: 0,
        rate: 0,
        totalAmount: 0
      }
    ]);
    setReturnItems([]);
    setCashPaid('');
    setOnlinePaid('');
    setAdvancePaid('');
  };

  const handlePartyDropdownChange = (e) => {
    const val = e.target.value;

    if (val === 'ADD_NEW_PARTY_MODAL') {
      setShowPartyModal(true);
      return;
    }

    // Party select/change/cross: always start a fresh bill for the current party.
    // This prevents items belonging to Party A from accidentally carrying into Party B.
    resetBillingForPartyChange();
    setPartyValidationError(false);
    setSelectedParty(val);

    const p = parties.find((party) => String(party._id) === String(val));
    setPartyInfo(p || null);
    setShowLastBills(false);
  };

  const selectedPartyBills = selectedParty && Array.isArray(bills)
    ? bills.filter((bill) => String(bill.partyId) === String(selectedParty)).sort((a, b) => new Date(b.billDate) - new Date(a.billDate))
    : [];

  const openDeliveryPayment = (bill) => {
    setPaymentBill(bill);
    setDeliveryCash(String(Number(bill.cashPaid || 0)));
    setDeliveryOnline(String(Number(bill.onlinePaid || 0)));
  };

  const saveDeliveryPayment = async () => {
    if (!paymentBill) return;
    const cash = Math.max(0, Number(deliveryCash || 0));
    const online = Math.max(0, Number(deliveryOnline || 0));
    const advance = Number(paymentBill.advancePaid || 0);
    const totalPayable = Number(paymentBill.todayTotal || 0) + Number(paymentBill.previousBalance || 0);
    const totalPaid = cash + online + advance;
    const due = Math.max(0, totalPayable - totalPaid);

    setSavingDeliveryPayment(true);
    try {
      const res = await apiFetch(`${API_BASE}/bills/${paymentBill._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashPaid: cash, onlinePaid: online, amountPaid: totalPaid, dueBalance: due })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Payment update failed');
      }
      setPaymentBill(null);
      setDeliveryCash('');
      setDeliveryOnline('');
      await onBillCreated();
      notify('Payment updated successfully!');
    } catch (err) {
      notify(err.message || 'Payment update failed', 'error');
    } finally {
      setSavingDeliveryPayment(false);
    }
  };

  const handleQuickAddParty = async (e) => {
    e.preventDefault();
    if (!newPartyName.trim()) return notify('Party Name Required!', 'error');

    try {
      const res = await apiFetch(`${API_BASE}/parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPartyName, city: newPartyCity, phone: newPartyPhone, openingBalance: 0 })
      });
      if (res.ok) {
        const createdParty = await res.json();
        setShowPartyModal(false);
        setNewPartyName(''); setNewPartyCity(''); setNewPartyPhone('');
        await onRefreshParties();
        resetBillingForPartyChange();
        setPartyValidationError(false);
        setSelectedParty(createdParty._id);
        setPartyInfo(createdParty);
        setShowLastBills(false);
      }
    } catch (err) { notify('Error adding party', 'error'); }
  };

  const handleSizeDropdownChange = (idx, e, isReturn = false) => {
  const val = e.target.value;

  if (val === 'ADD_CUSTOM_SIZE_RANGE') {
    setEditingCustomSize(null);
    setCustomSizeInput('');
    setShowCustomSizeModal(true);
    return;
  }

  if (val === 'EDIT_CUSTOM_SIZE_RANGE') {
    const currentSize = isReturn
      ? returnItems[idx]?.size || ''
      : items[idx]?.size || '';

    setEditingCustomSize({
      idx,
      isReturn,
      oldSize: currentSize
    });
    setCustomSizeInput(currentSize);
    setShowCustomSizeModal(true);
    return;
  }

  if (isReturn) {
    handleReturnItemChange(idx, 'size', val);
  } else {
    handleItemChange(idx, 'size', val);
  }
};

  const handleAddCustomSize = () => {
  if (!customSizeInput.trim()) return;

  const newSz = customSizeInput.trim();

  if (editingCustomSize) {
    const { idx, isReturn, oldSize } = editingCustomSize;

    if (oldSize && oldSize !== newSz) {
      setSizeRanges(
        sizeRanges.map((sz) => sz === oldSize ? newSz : sz)
      );
    }

    if (isReturn) {
      handleReturnItemChange(idx, 'size', newSz);
    } else {
      handleItemChange(idx, 'size', newSz);
    }
  } else {
    if (!sizeRanges.includes(newSz)) {
      setSizeRanges([...sizeRanges, newSz]);
    }
  }

  setCustomSizeInput('');
  setEditingCustomSize(null);
  setShowCustomSizeModal(false);
};

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const cur = { ...updated[index], [field]: value };

    if (field === 'articleCode') {
      if (value === 'ADD_CUSTOM_ARTICLE') {
        cur.isCustom = true;
        cur.articleId = '';
        cur.articleCode = '';
        cur.size = '6*9 (Gents)';
        cur.color = '';
        cur.mrp = '';
        cur.discountPercent = 0;
        cur.rate = 0;
      } else if (!String(value || '').trim()) {
        // Clearing Article Code must also clear every dependent auto-filled field.
        cur.isCustom = false;
        cur.articleId = '';
        cur.articleCode = '';
        cur.size = '6*9 (Gents)';
        cur.color = '';
        cur.mrp = '';
        cur.discountPercent = 0;
        cur.rate = 0;
      } else {
        const selectedArticle = articles.find((a) => String(a._id) === String(value));
        const code = selectedArticle ? String(selectedArticle.articleCode || '').trim().toUpperCase() : String(value).trim().toUpperCase();
        cur.articleCode = code;
        const art = selectedArticle || articles.find((a) => String(a.articleCode || '').trim().toUpperCase() === code);
        if (art) {
          cur.isCustom = false;
          cur.articleId = art._id || '';
          cur.color = art.color || '';
          cur.size = art.sizeRange || '6*9 (Gents)';
          cur.mrp = Number(art.mrp || 0) > 0 ? String(art.mrp) : '';
          cur.rate = Number(art.sellingPrice || art.wholesaleRate || 0);
          cur.discountPercent = cur.mrp !== '' && Number(cur.mrp) > 0
            ? Number((((Number(cur.mrp) - cur.rate) / Number(cur.mrp)) * 100).toFixed(2))
            : 0;
        } else {
          cur.articleId = '';
          cur.isCustom = true;
        }
      }
    }

    if (field === 'mrp' || field === 'discountPercent') {
      const mrpValue = field === 'mrp' ? value : cur.mrp;
      const discount = Number(field === 'discountPercent' ? value : cur.discountPercent || 0);
      cur.mrp = mrpValue === '' ? '' : Math.max(0, Number(mrpValue));
      cur.discountPercent = Math.max(0, Math.min(100, discount));
      if (cur.mrp !== '') {
        cur.rate = Number((Number(cur.mrp) * (1 - cur.discountPercent / 100)).toFixed(2));
      }
    }

    // Cartons remain in saved data for backward compatibility, but sale-order quantity is now loose/total pairs only.
    const loose = parseInt(cur.loosePairs || 0);
    cur.totalPairs = Math.max(0, loose);
    cur.totalAmount = cur.totalPairs * parseFloat(cur.rate || 0);

    updated[index] = cur;
    setItems(updated);
  };

  const handleReturnItemChange = (index, field, value) => {
    const updated = [...returnItems];
    const cur = { ...updated[index], [field]: value };

    if (field === 'orderItemIndex') {
      if (value === 'ADD_CUSTOM_ARTICLE') {
        Object.assign(cur, {
          orderItemIndex: '', isCustom: true, articleCode: '', size: '6*9 (Gents)',
          color: '', mrp: '', discountPercent: 0, rate: 0, totalPairs: 0, totalAmount: 0
        });
      } else if (value === '') {
        Object.assign(cur, {
          orderItemIndex: '', articleCode: '', isCustom: false, size: '6*9 (Gents)',
          color: '', mrp: '', discountPercent: 0, rate: 0, totalPairs: 0, totalAmount: 0
        });
      } else {
        const orderIndex = Number(value);
        const orderItem = items[orderIndex];
        if (Number.isInteger(orderIndex) && orderItem) {
          Object.assign(cur, {
            orderItemIndex: orderIndex,
            isCustom: !!orderItem.isCustom,
            articleCode: orderItem.articleCode || '',
            size: orderItem.size || '6*9 (Gents)',
            color: orderItem.color || '',
            mrp: Number(orderItem.mrp || 0) > 0 ? Number(orderItem.mrp) : '',
            discountPercent: Number(orderItem.discountPercent || 0),
            rate: Number(orderItem.rate || 0),
            totalPairs: 0,
            totalAmount: 0
          });
        }
      }
    }

    if (field === 'totalPairs') {
      const orderItem = Number.isInteger(Number(cur.orderItemIndex)) ? items[Number(cur.orderItemIndex)] : null;
      const requestedPairs = Math.max(0, parseInt(value || 0));
      const maxPairs = Number(orderItem?.totalPairs || 0);
      cur.totalPairs = cur.isCustom ? requestedPairs : Math.min(requestedPairs, maxPairs);
    }

    if (field === 'mrp' || field === 'discountPercent') {
      const mrpValue = field === 'mrp' ? value : cur.mrp;
      const discount = Number(field === 'discountPercent' ? value : cur.discountPercent || 0);
      cur.mrp = mrpValue === '' ? '' : Math.max(0, Number(mrpValue));
      cur.discountPercent = Math.max(0, Math.min(100, discount));
      if (cur.mrp !== '') {
        cur.rate = Number((Number(cur.mrp) * (1 - cur.discountPercent / 100)).toFixed(2));
      }
    }

    cur.totalAmount = Math.max(0, Number(cur.totalPairs || 0)) * parseFloat(cur.rate || 0);
    updated[index] = cur;
    setReturnItems(updated);
  };

  const addItemRow = () => {
    setItems([...items, { articleCode: '', articleId: '', isCustom: false, size: '6*9 (Gents)', color: '', cartons: 0, loosePairs: 0, totalPairs: 0, mrp: '', discountPercent: 0, rate: 0, totalAmount: 0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const addReturnItemRow = () => {
    setReturnItems([...returnItems, { articleCode: '', articleId: '', orderItemIndex: '', isCustom: false, size: '6*9 (Gents)', color: '', totalPairs: 0, mrp: '', discountPercent: 0, rate: 0, totalAmount: 0 }]);
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
    if (!selectedParty) {
      setPartyValidationError(true);
      return notify('Pehle Wholesale Party select karein ya “Add New Party” se party banayein. Bill nahi banega.', 'error');
    }
    setPartyValidationError(false);

    const invalidItem = items.findIndex(item =>
    !item.isCustom &&
    (!item.articleCode || Number(item.rate || 0) <= 0)
  );

  if (invalidItem !== -1) {
    return notify(
      `Item ${invalidItem + 1} mein Rate daalna zaroori hai!`,
      'error'
    );
  }

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
  const res = await apiFetch(`${API_BASE}/bills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || 'Bill save failed');
  }

  const savedBill = data;

  localStorage.removeItem(BILLING_DRAFT_KEY);

  notify(`Bill #${savedBill.billNo} saved successfully!`);

  await onBillCreated();

  onViewInvoice(savedBill._id);

} catch (err) {
  console.error('Bill save error:', err);
  notify(err.message || 'Error saving bill', 'error');
}
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 md:p-6 p-4 rounded-2xl shadow-2xl space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <h3 className="md:text-lg text-sm font-black text-white flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-400" />Order Bill
        </h3>
        <div className="flex items-center gap-2">
          {selectedParty && (
            <button type="button" onClick={() => setShowLastBills(v => !v)} className="px-2 py-2 rounded-xl text-xs font-black border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 transition">
              {showLastBills ? 'Hide Last Bills' : 'Last Bills'}
            </button>
          )}
          <button type="button" onClick={() => setShowPartyModal(true)} className="bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2">
             Add New Party
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Select Wholesale Party *</label>
            <SearchableBillingDropdown
              value={selectedParty}
              onChange={(value) => handlePartyDropdownChange({ target: { value } })}
              placeholder="Search / choose party..."
              options={[
                { value: 'ADD_NEW_PARTY_MODAL', label: '➕ Add New Party...' },
                ...parties.map((p) => ({ value: p._id, label: `${p.name}${p.city ? ` (${p.city})` : ''}` }))
              ]}
            />
            {partyValidationError && !selectedParty && (
              <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] font-bold text-rose-300">
                ⚠️ Party select karna zaroori hai. Upar se <b>Select Wholesale Party</b> choose karein ya <b>Add New Party</b> karein.
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Previous Ledger Due</label>
            <input className="w-full p-3 bg-rose-950/30 border border-rose-800/50 text-rose-400 font-black rounded-xl text-sm" value={`₹${Number(previousBalance).toFixed(2)}`} readOnly disabled />
          </div>
        </div>

        {selectedParty && showLastBills && (
          <div className="border border-amber-800/60 bg-amber-950/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-amber-300">Last Bills / Delivery Payment</h4>
                <p className="text-xs text-slate-400 mt-1">Selected party ke purane bills yahan milenge. Delivery ke time Cash aur Online update karein.</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{selectedPartyBills.length} Bill(s)</span>
            </div>
            {selectedPartyBills.length === 0 ? (
              <div className="text-xs text-slate-500 py-3">Is party ka koi previous bill nahi mila.</div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-24 border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/70 text-slate-300 uppercase font-extrabold">
                    <tr>
                      <th className="p-3">Bill No.</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Cash</th>
                      <th className="p-3">Online</th>
                      <th className="p-3">Paid</th>
                      <th className="p-3">Due</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">

                    {selectedPartyBills.map((bill) => (
                      <tr key={bill._id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-bold text-white">#{bill.billNo}</td>
                        <td className="p-3 text-slate-400">{bill.billDate ? new Date(bill.billDate).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="p-3 font-bold text-white">₹{Number(bill.todayTotal || 0).toFixed(2)}</td>
                        <td className="p-3 text-emerald-400">₹{Number(bill.cashPaid || 0).toFixed(2)}</td>
                        <td className="p-3 text-cyan-400">₹{Number(bill.onlinePaid || 0).toFixed(2)}</td>
                        <td className="p-3 text-emerald-300 font-bold">₹{Number(bill.amountPaid || 0).toFixed(2)}</td>
                        <td className="p-3 text-rose-400 font-bold">₹{Number(bill.dueBalance || 0).toFixed(2)}</td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <button type="button" onClick={() => openDeliveryPayment(bill)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black hover:bg-amber-400">Update Payment</button>
                          <button type="button" onClick={() => onViewInvoice(bill._id)} className="ml-2 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 font-bold hover:bg-slate-800">View</button>
                        </td>
                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ORDER ITEMS */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-400" /> Order Item
          </h4>
          <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/50">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/70 text-slate-300 uppercase text-xs font-extrabold border-b border-slate-800">
                <tr>
                  <th className="p-3">Article Code</th>
                  <th className="p-3">Size Range</th>
                  <th className="p-3">Color</th>
                  <th className="p-3">Total Pairs</th>
                  <th className="p-3">MRP (₹)</th>
                  <th className="p-3">Discount %</th>
                  <th className="p-3">Rate (₹)</th>
                  <th className="p-3">Amount (₹)</th>
                  <th className="p-3 text-center">Action</th>
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
                            onClick={() => handleItemChange(idx, 'articleCode', '')}
                            className="text-xs text-slate-400 hover:text-white px-1"
                            title="Back to Dropdown"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <SearchableBillingDropdown
                          value={item.articleId || item.articleCode}
                          onChange={(value) => handleItemChange(idx, 'articleCode', value)}
                          placeholder="Search article..."
                          className="md:w-40 w-32"
                          options={[
                            { value: 'ADD_CUSTOM_ARTICLE', label: '✍️ Enter Custom Article Code...' },
                            ...articles.map((a) => ({ value: a._id || a.articleCode, label: `${String(a.articleCode || '').toUpperCase()} • ${a.sizeRange || ''} • ₹${Number(a.sellingPrice || a.wholesaleRate || 0).toFixed(2)}` }))
                            
                          ]}
                        />
                      )}
                    </td>
                    <td className="p-2.5">
                      <SearchableBillingDropdown
                        value={item.size}
                        onChange={(value) => handleSizeDropdownChange(idx, { target: { value } }, false)}
                        placeholder="Search size range..."
                        className="md:w-40 w-32"
                        options={[
                          ...sizeRanges.map((sz) => ({ value: sz, label: sz })),
                          { value: 'EDIT_CUSTOM_SIZE_RANGE', label: '✏️ Edit Current Size...' },
                          { value: 'ADD_CUSTOM_SIZE_RANGE', label: '➕ Add Custom Size...' }
                        ]}
                      />
                    </td>
                    <td className="p-2.5"><input className="md:w-24 w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" placeholder="Optional" value={item.color} onChange={(e) => handleItemChange(idx, 'color', e.target.value)} /></td>
                    <td className="p-2.5"><input className="md:w-20 w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" type="text" placeholder="0" value={item.loosePairs} onChange={(e) => handleItemChange(idx, 'loosePairs', e.target.value)} /></td>

                    <td className="p-2.5">
                      <input
                        className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold"
                        type="number"                        
                        placeholder="MRP"
                        value={item.mrp === 0 || item.mrp === '0' || item.mrp == null ? '' : item.mrp}
                        onChange={(e) => handleItemChange(idx, 'mrp', e.target.value)}
                      
                      />
                    </td>
                    <td className="p-2.5"><input className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-amber-300 font-bold" type="text" min="0" max="100" step="0.01" placeholder="%" value={item.discountPercent} onChange={(e) => handleItemChange(idx, 'discountPercent', e.target.value)} /></td>
                    <td className="p-2.5">
  <input
    className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold"
    type="text"
    inputMode="decimal"
    placeholder="Rate"
    value={item.rate ?? ''}
    onChange={(e) => {
      const value = e.target.value;

      // Sirf numbers + ek decimal point allow
      if (/^\d*\.?\d*$/.test(value)) {
        handleItemChange(idx, 'rate', value);
      }
    }}
    required
  />
</td>

                    <td className="p-2.5 font-black text-amber-400">₹{Number(item.totalAmount || 0).toFixed(2)}</td>
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
            + Add more item
          </button>
        </div>

        {/* RETURN ITEMS */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" /> Return Items
            </h4>
            <button type="button" onClick={addReturnItemRow} className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-500 hover:text-slate-950 transition flex items-center gap-1">
              + Add Return Item
            </button>
          </div>

          {returnItems.length > 0 ? (
            <div className="overflow-x-auto border border-amber-900/40 rounded-2xl bg-amber-950/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-amber-950/40 text-amber-200 uppercase text-xs font-extrabold border-b border-amber-900/40">
                  <tr>
                    <th className="p-3">Article Code</th>
                    <th className="p-3">Size Range</th>
                    <th className="p-3">Color</th>
                    <th className="p-3">Total Pairs</th>
                    <th className="p-3">MRP (₹)</th>
                    <th className="p-3">Discount %</th>
                    <th className="p-3">Rate (₹)</th>
                    <th className="p-3">Return Amount (₹)</th>
                    <th className="p-3 text-center">Action</th>
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
                              value={rItem.articleCode || ''}
                              onChange={(e) => handleReturnItemChange(rIdx, 'articleCode', e.target.value.toUpperCase())}
                              required
                            />
                            <button type="button" onClick={() => handleReturnItemChange(rIdx, 'orderItemIndex', '')} className="text-xs text-slate-400 hover:text-white px-1" title="Back to Dropdown">✕</button>
                          </div>
                        ) : (
                          <SearchableBillingDropdown
                            value={rItem.orderItemIndex === '' ? '' : String(rItem.orderItemIndex)}
                            onChange={(value) => handleReturnItemChange(rIdx, 'orderItemIndex', value)}
                            placeholder="Search / choose Article Code..."
                            className="md:w-40 w-32"
                            options={[
                              ...items.map((orderItem, orderIndex) => ({ value: String(orderIndex), label: String(orderItem.articleCode || '').trim() || 'Custom Article' })),
                              { value: 'ADD_CUSTOM_ARTICLE', label: '✍️ Enter Custom Article Code...' }
                            ]}
                          />
                        )}
                      </td>
                      <td className="p-2.5">
                        <SearchableBillingDropdown
                          value={rItem.size || ''}
                          onChange={(value) => handleReturnItemChange(rIdx, 'size', value)}
                          placeholder="Search size range..."
                          className="md:w-40 w-32"
                          options={sizeRanges.map((sz) => ({ value: sz, label: sz }))}
                        />
                      </td>
                      <td className="p-2.5">
                        <input className="md:w-24 w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white" placeholder="Optional" value={rItem.color || ''} onChange={(e) => handleReturnItemChange(rIdx, 'color', e.target.value)} />
                      </td>
                      <td className="p-2.5">
                        <input
                          className="md:w-20 w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                          type="text" inputMode="numeric" placeholder="0" value={rItem.totalPairs ?? ''}
                          onChange={(e) => handleReturnItemChange(rIdx, 'totalPairs', e.target.value)}
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold"
                          type="number" placeholder="MRP"
                          value={rItem.mrp === 0 || rItem.mrp === '0' || rItem.mrp == null ? '' : rItem.mrp}
                          onChange={(e) => handleReturnItemChange(rIdx, 'mrp', e.target.value)}
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-amber-300 font-bold"
                          type="text" inputMode="decimal" placeholder="%" value={rItem.discountPercent ?? 0}
                          onChange={(e) => handleReturnItemChange(rIdx, 'discountPercent', e.target.value)}
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          className="w-20 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white font-bold"
                          type="text" inputMode="decimal" placeholder="Rate" value={rItem.rate ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (/^\d*\.?\d*$/.test(value)) handleReturnItemChange(rIdx, 'rate', value);
                          }}
                        />
                      </td>
                      <td className="p-2.5 font-black text-amber-400">- ₹{Number(rItem.totalAmount || 0).toFixed(2)}</td>
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
            <div className="p-2 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center text-xs text-slate-500">
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
            <div className="flex justify-between text-xs text-slate-400"><span>Sale Subtotal:</span><span>₹{Number(rawTotal).toFixed(2)}</span></div>
            {returnTotal > 0 && (
              <div className="flex justify-between text-xs text-amber-400 font-bold"><span>Less Return Deduction:</span><span>- ₹{returnTotal}</span></div>
            )}
            <div className="flex justify-between text-xs text-purple-400"><span>Discount:</span><span>- ₹{Number(discountVal).toFixed(2)}</span></div>
            <div className="flex justify-between text-sm font-bold text-white border-t border-slate-800 pt-1">
              <span>Today Bill Net Total:</span>
              <span className="text-amber-400 text-lg font-black">₹{Number(todayTotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-400 font-bold"><span>Total Payment Received:</span><span>₹{Number(totalPaid).toFixed(2)}</span></div>
            <hr className="border-slate-800" />
            <div className="flex justify-between text-base font-black text-rose-400"><span>Final Net Due:</span><span>₹{Number(dueBalance).toFixed(2)}</span></div>
          </div>
        </div>

        <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black py-4 rounded-2xl shadow-xl text-base">
          🖨️ Save Bill & Open Invoice
        </button>
      </form>

      {paymentBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-white">Update Delivery Payment</h3>
                <p className="text-xs text-slate-400 mt-1">Bill #{paymentBill.billNo}</p>
              </div>
              <button type="button" onClick={() => setPaymentBill(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Cash Received (₹)</label>
                <input type="number" min="0" step="0.01" value={deliveryCash} onChange={(e) => setDeliveryCash(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Online Received (₹)</label>
                <input type="number" min="0" step="0.01" value={deliveryOnline} onChange={(e) => setDeliveryOnline(e.target.value)} className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-white" />
              </div>
            </div>
            <div className="mt-4 p-3 bg-slate-800/70 rounded-xl text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">Total Payable</span><b>₹{(Number(paymentBill.todayTotal || 0) + Number(paymentBill.previousBalance || 0)).toFixed(2)}</b></div>
              <div className="flex justify-between"><span className="text-slate-400">Total Paid</span><b className="text-emerald-400">₹{(Number(deliveryCash || 0) + Number(deliveryOnline || 0) + Number(paymentBill.advancePaid || 0)).toFixed(2)}</b></div>
              <div className="flex justify-between"><span className="text-slate-400">Due</span><b className="text-rose-400">₹{Math.max(0, Number(paymentBill.todayTotal || 0) + Number(paymentBill.previousBalance || 0) - Number(deliveryCash || 0) - Number(deliveryOnline || 0) - Number(paymentBill.advancePaid || 0)).toFixed(2)}</b></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setPaymentBill(null)} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-bold">Cancel</button>
              <button type="button" disabled={savingDeliveryPayment} onClick={saveDeliveryPayment} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black disabled:opacity-50">{savingDeliveryPayment ? 'Saving...' : 'Save Payment'}</button>
            </div>
          </div>
        </div>
      )}

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
function InvoiceView({ billId, bills, parties, partyPayments, onBack }) {
  const notify = useToast();
  const bill = bills.find((b) => b._id === billId);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [shareType, setShareType] = useState('invoice');
  const invoiceRef = useRef(null);

  if (!bill) return <div className="text-white text-center p-10">Bill not found!</div>;

  const currentParty = parties.find(p => p._id === bill.partyId || p.name === bill.partyName);

  const billDate = new Date(bill.billDate || Date.now());
billDate.setHours(23, 59, 59, 999);

const partyPaymentAdjusted = (partyPayments || [])
  .filter((p) => {
    if (String(p.partyId) !== String(bill.partyId)) return false;

    const paymentDate = new Date(`${p.paymentDate}T00:00:00`);

    return paymentDate <= billDate;
  })
  .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Generate PDF Invoice
const handleDownloadPdf = async () => {
  if (!invoiceRef.current) return;

  setIsGeneratingPdf(true);

  try {
    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      onclone: (clonedDocument) => {
        clonedDocument
          .querySelectorAll('[data-pdf-hide="true"]')
          .forEach((el) => {
            el.style.display = 'none';
          });

        const invoice = clonedDocument.getElementById('invoice-print-area');

        if (invoice) {
          // PDF ke liye unnecessary screen-only spacing remove
          invoice.style.boxShadow = 'none';
          invoice.style.borderRadius = '0';
          invoice.style.maxWidth = 'none';
          invoice.style.width = '100%';
          invoice.style.margin = '0';
        }
      }
    });

    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 8;

    const usableWidth = pageWidth - (margin * 2);
    const usableHeight = pageHeight - (margin * 2);

    /*
     * Canvas ko A4 width mein fit karne par
     * invoice ki actual PDF height.
     */
    const naturalPdfHeight =
      (canvas.height * usableWidth) / canvas.width;

    /*
     * Agar invoice A4 se sirf thoda bada hai,
     * to poora invoice ek page mein fit kar do.
     *
     * Isse Net Balance Due next page par nahi jayega.
     */
    const onePageMaximum = usableHeight * 1.12;

    if (naturalPdfHeight <= onePageMaximum) {
      const scale =
        Math.min(1, usableHeight / naturalPdfHeight);

      const finalWidth = usableWidth * scale;
      const finalHeight = naturalPdfHeight * scale;

      const x = (pageWidth - finalWidth) / 2;

      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        x,
        margin,
        finalWidth,
        finalHeight
      );

    } else {
      /*
       * Invoice genuinely bada hai.
       * Ab proper multiple-page slicing.
       */

      const pageCanvasHeight = Math.floor(
        (canvas.width * usableHeight) / usableWidth
      );

      let offsetY = 0;
      let pageIndex = 0;

      while (offsetY < canvas.height) {
        const remainingHeight =
          canvas.height - offsetY;

        const sliceHeight = Math.min(
          pageCanvasHeight,
          remainingHeight
        );

        const pageCanvas =
          document.createElement('canvas');

        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext('2d');

        ctx.fillStyle = '#ffffff';

        ctx.fillRect(
          0,
          0,
          pageCanvas.width,
          pageCanvas.height
        );

        ctx.drawImage(
          canvas,
          0,
          offsetY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );

        if (pageIndex > 0) {
          pdf.addPage();
        }

        const imageHeight =
          (sliceHeight * usableWidth) / canvas.width;

        pdf.addImage(
          pageCanvas.toDataURL('image/jpeg', 0.95),
          'JPEG',
          margin,
          margin,
          usableWidth,
          imageHeight
        );

        offsetY += sliceHeight;
        pageIndex++;
      }
    }

    pdf.save(
      `Invoice_${bill.billNo || 'SuperGold'}.pdf`
    );

  } catch (err) {
    console.error('PDF generation error:', err);
    notify('Error generating PDF download', 'error');
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

  const buildPaymentReceiptMessage = () => {
  return `*🏢 SUPER GOLD FOOTWEARS*
----------------------------------------
*💰 PAYMENT RECEIPT* ${Number(bill.dueBalance || 0) <= 0 ? '✅' : '🟡'}
----------------------------------------
*Invoice No:* #${bill.billNo} 
*Date:* ${new Date(bill.billDate || Date.now()).toLocaleDateString()}
*Customer Name:* ${bill.partyName}
----------------------------------------
*Invoice Total:* ₹${bill.todayTotal}
*Previous Balance:* ₹${bill.previousBalance}
*Total Payable:* ₹${Number(bill.todayTotal || 0) + Number(bill.previousBalance || 0)}
*Total Paid:* ₹${bill.amountPaid}
*Balance Due:* ₹${bill.dueBalance}
----------------------------------------
Thank you for your payment!
_Super Gold Footwears_`;
};

const handleSendPaymentReceipt = () => {
  const message = encodeURIComponent(buildPaymentReceiptMessage());

  if (currentParty && currentParty.phone) {
    let cleanPhone = currentParty.phone.replace(/[^0-9]/g, '');

    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    window.open(
      `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`,
      '_blank'
    );
  } else {
    window.open(
      `https://api.whatsapp.com/send?text=${message}`,
      '_blank'
    );
  }
};

 const handleOpenMultiShare = (type = 'invoice') => {
  setShareType(type);
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

  

const handleSendToSelected = (phone, type = 'invoice') => {
  let cleanPhone = phone.replace(/[^0-9]/g, '');

  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const message = encodeURIComponent(
    type === 'receipt'
      ? buildPaymentReceiptMessage()
      : buildInvoiceMessage()
  );

  window.open(
    `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${message}`,
    '_blank'
  );
};

 const handleOpenGeneralWhatsApp = () => {
  const message = encodeURIComponent(
    shareType === 'receipt'
      ? buildPaymentReceiptMessage()
      : buildInvoiceMessage()
  );

  window.open(
    `https://api.whatsapp.com/send?text=${message}`,
    '_blank'
  );
};

  return (
    <div>
      <button onClick={onBack} className="text-lg font-bold text-slate-500 hover:text-white flex items-center gap-1 justify-center ml-auto mb-2">
        ✕
      </button>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
      <div id="invoice-print-area" ref={invoiceRef} className="bg-white text-slate-900 p-8 rounded-2xl max-w-3xl w-full shadow-2xl space-y-6 mx-auto relative">
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
                <th className="p-2">Pairs</th>
                <th className="p-2">MRP</th>
                <th className="p-2">Rate</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.items && bill.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-2 font-bold">{item.articleCode}</td>
                  <td className="p-2">{item.size}</td>
                  <td className="p-2">{item.totalPairs}</td>
                  <td className="p-2">{item.mrp}</td>
                  <td className="p-2">₹{Number(item.rate || 0).toFixed(2)}</td>
                  <td className="p-2 text-right font-bold">₹{Number(item.totalAmount).toFixed(2)}</td>
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
                    <td className="p-2 text-right font-bold">- ₹{Number(rItem.totalAmount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CALCULATIONS */}
        <div className="flex flex-col sm:flex-row justify-between items-start border-t pt-4 text-xs gap-4">
          <div data-pdf-hide="true" className="flex flex-wrap gap-2 print:hidden">
            <button onClick={() => window.print()} className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow transition">
              <Printer className="w-4 h-4" /> Print Invoice
            </button>
            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow transition">
              <Download className="w-4 h-4" /> {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button onClick={() => handleOpenMultiShare('invoice')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow transition">
              <Share2 className="w-4 h-4" /> Share via WhatsApp
            </button>
            <button
  onClick={() => handleOpenMultiShare('receipt')}
  className="bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow transition"
>
  💰 Payment Receipt
</button>
          </div>
          <div className="w-full sm:w-64 space-y-1 text-right">
            <div className="flex justify-between text-slate-600"><span>Sale Subtotal:</span><span>₹{Number(bill.rawTotal).toFixed(2)}</span></div>
            {bill.returnTotal > 0 && (
              <div className="flex justify-between text-amber-700 font-bold"><span>Return Adjustment:</span><span>- ₹{Number(bill.returnTotal).toFixed(2)}</span></div>
            )}
            {bill.discountVal > 0 && (
              <div className="flex justify-between text-purple-700 font-bold"><span>Discount:</span><span>- ₹{Number(bill.discountVal).toFixed(2)}</span></div>
            )}
            <div className="flex justify-between text-slate-800 font-black text-sm border-t pt-1"><span>Today Net Total:</span><span>₹{Number(bill.todayTotal).toFixed(2)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Previous Balance:</span><span>₹{Number(bill.previousBalance).toFixed(2)}</span></div>
            <div className="flex justify-between text-emerald-700 font-bold"><span>Amount Paid:</span><span>₹{Number(bill.amountPaid).toFixed(2)}</span></div>
            {partyPaymentAdjusted > 0 && (
  <div className="flex justify-between text-sky-700 font-bold">
    <span>Payment Adjusted:</span>
    <span>₹{partyPaymentAdjusted.toFixed(2)}</span>
  </div>
)}
            <div className="flex justify-between text-rose-700 font-black text-sm border-t pt-1"><span>Net Balance Due:</span><span>₹{Number(bill.dueBalance).toFixed(2)}</span></div>
          </div>
        </div>

        <div data-pdf-hide="true" className="pt-4 text-center print:hidden">
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
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition ${isSelected ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-800'
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
                        onClick={(e) => { e.stopPropagation(); handleSendToSelected(p.phone, shareType); }}
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
  const notify = useToast();
  const getToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getMonthKey = (date = new Date()) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const currentMonth = getMonthKey(new Date());

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingSalaryPayment, setEditingSalaryPayment] = useState(null);
  const [historyStaff, setHistoryStaff] = useState(null);

  const [newStaff, setNewStaff] = useState({ name: '', phone: '', role: 'Helper', monthlySalary: 0, joiningDate: getToday() });
  const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '', date: getToday() });
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'General', description: '', date: getToday() });
  const [salaryForm, setSalaryForm] = useState({ month: currentMonth, amount: '', date: getToday(), remark: '' });

  const monthLabel = new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate();

  const monthDays = (month) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const previousMonthKey = (month) => {
    const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthKeysBetween = (from, toExclusive) => {
    const result = [];
    if (!from || !toExclusive || from >= toExclusive) return result;
    let d = new Date(`${from}-01T00:00:00`);
    const end = new Date(`${toExclusive}-01T00:00:00`);
    while (d < end) {
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() + 1);
    }
    return result;
  };

  const loadMonthData = async () => {
    setLoadingRecords(true);
    try {
      const [recordsRes, expensesRes, paymentsRes] = await Promise.all([
        apiFetch(`${API_BASE}/staff-records?all=true`),
        apiFetch(`${API_BASE}/expenses?month=${selectedMonth}`),
        apiFetch(`${API_BASE}/staff-salary-payments?all=true`)
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
      notify('Staff records load nahi ho paaye.', 'error');
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => { loadMonthData(); }, [selectedMonth]);

  const refreshEverything = async () => {
    await Promise.all([loadMonthData(), onStaffUpdated()]);
  };

  const staffRecords = (staffId) => records[staffId] || [];
  const attendanceRecords = (staffId, month = selectedMonth) =>
    staffRecords(staffId).filter(r => String(r.date || '').startsWith(`${month}-`) && !Number(r.advanceAmount || 0));
  const advanceRecords = (staffId, month = null) => staffRecords(staffId).filter(r => Number(r.advanceAmount || 0) > 0 && (!month || String(r.date || '').startsWith(`${month}-`)));
  const attendanceForDate = (staffId, date) => {
    const saved = attendanceRecords(staffId, String(date || '').slice(0, 7)).find(r => r.date === date);
    if (saved) return saved;
    return date === getToday() ? { status: 'Present', isDefault: true } : { status: 'Not Marked', isDefault: false };
  };

  const getEffectiveBaseSalary = (st, month) => {
    const salary = Number(st.monthlySalary || 0);
    const joining = String(st.joiningDate || '').slice(0, 10);
    const joiningMonth = joining.slice(0, 7);
    if (joiningMonth && month < joiningMonth) return 0;
    if (joiningMonth === month && joining) {
      const joinDay = Number(joining.slice(8, 10));
      const totalDays = monthDays(month);
      if (joinDay > 1 && joinDay <= totalDays) {
        return salary * ((totalDays - joinDay + 1) / totalDays);
      }
    }
    return salary;
  };

  const getPayrollForMonth = (st, month) => {
    const rows = attendanceRecords(st._id, month);
    const advances = advanceRecords(st._id, month).reduce((sum, r) => sum + Number(r.advanceAmount || 0), 0);
    const payments = salaryPayments.filter(p => String(p.staffId) === String(st._id) && String(p.month) === String(month));
    const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const days = monthDays(month);
    const absent = rows.filter(r => r.status === 'Absent').length;
    const half = rows.filter(r => r.status === 'Half-Day' || r.status === 'Half Day').length;
    const present = Math.max(0, days - absent - half);
    const baseSalary = getEffectiveBaseSalary(st, month);
    const dailyRate = days > 0 ? baseSalary / days : 0;
    const absenceDeduction = absent * dailyRate;
    const halfDayDeduction = half * dailyRate * 0.5;
    const grossAfterAttendance = Math.max(0, baseSalary - absenceDeduction - halfDayDeduction);
    const netPayable = Math.max(0, grossAfterAttendance - advances);
    const remaining = Math.max(0, netPayable - paid);
    return { month, days, present, absent, half, baseSalary, dailyRate, absenceDeduction, halfDayDeduction, advances, paid, grossAfterAttendance, netPayable, remaining, payments };
  };

  const getStaffStats = (st) => {
    const current = getPayrollForMonth(st, selectedMonth);
    const joiningMonth = String(st.joiningDate || '').slice(0, 7) || selectedMonth;
    const previousMonths = monthKeysBetween(joiningMonth, selectedMonth);
    const previousBreakdown = previousMonths.map(month => getPayrollForMonth(st, month)).filter(x => x.baseSalary > 0);
    const previousDue = previousBreakdown.reduce((sum, x) => sum + x.remaining, 0);
    const totalOutstanding = previousDue + current.remaining;
    const allAdvances = staffRecords(st._id).filter(r => Number(r.advanceAmount || 0)).reduce((sum, r) => sum + Number(r.advanceAmount || 0), 0);
    const allPaid = salaryPayments.filter(p => String(p.staffId) === String(st._id)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { ...current, previousDue, totalOutstanding, allAdvances, allPaid, previousBreakdown };
  };

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch(`${API_BASE}/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newStaff, monthlySalary: Number(newStaff.monthlySalary || 0), joiningDate: newStaff.joiningDate || getToday(), active: true }) });
      if (!res.ok) throw new Error();
      notify('New Staff Added Successfully!');
      setShowAddStaffModal(false);
      setNewStaff({ name: '', phone: '', role: 'Helper', monthlySalary: 0, joiningDate: getToday() });
      await refreshEverything();
    } catch (err) { notify('Error adding staff', 'error'); }
  };

  const handleEditStaffSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) return;
    try {
      const res = await apiFetch(`${API_BASE}/staff/${selectedStaff._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...selectedStaff, monthlySalary: Number(selectedStaff.monthlySalary || 0) }) });
      if (!res.ok) throw new Error();
      setShowEditStaffModal(false); setSelectedStaff(null); await refreshEverything();
    } catch (err) { notify('Error updating staff', 'error'); }
  };

  const handleMarkAttendance = async (staffId, status) => {
    try {
      const res = await apiFetch(`${API_BASE}/staff/${staffId}/attendance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: selectedDate, status }) });
      if (!res.ok) throw new Error();
      await loadMonthData();
    } catch (err) { notify('Error recording attendance', 'error'); }
  };

  const openAdvance = (st, record = null) => {
    setSelectedStaff(st);
    setEditingAdvance(record);
    setAdvanceForm(record ? { amount: String(record.advanceAmount || ''), reason: record.remark || '', date: record.date || getToday() } : { amount: '', reason: '', date: getToday() });
    setShowAdvanceModal(true);
  };

  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff || Number(advanceForm.amount) <= 0) return;
    try {
      const url = editingAdvance ? `${API_BASE}/staff-records/${editingAdvance._id}` : `${API_BASE}/staff/${selectedStaff._id}/advance`;
      const method = editingAdvance ? 'PUT' : 'POST';
      const body = editingAdvance
        ? { date: advanceForm.date, amount: Number(advanceForm.amount), advanceAmount: Number(advanceForm.amount), reason: advanceForm.reason || 'Staff Advance', remark: advanceForm.reason || 'Staff Advance' }
        : { date: advanceForm.date, amount: Number(advanceForm.amount), reason: advanceForm.reason || 'Staff Advance' };
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      setShowAdvanceModal(false); setEditingAdvance(null); setAdvanceForm({ amount: '', reason: '', date: getToday() }); await loadMonthData();
      notify(editingAdvance ? 'Advance updated.' : 'Advance saved.');
    } catch (err) { notify('Error saving advance', 'error'); }
  };

  const handleDeleteAdvance = async (record) => {
    if (!window.confirm(`₹${Number(record.advanceAmount || 0).toLocaleString()} ka advance delete karna hai?`)) return;
    try {
      const res = await apiFetch(`${API_BASE}/staff-records/${record._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await loadMonthData(); notify('Advance deleted.');
    } catch (err) { notify('Advance delete nahi hua.', 'error'); }
  };

  const openExpense = (expense = null) => {
    setEditingExpense(expense);
    setExpenseForm(expense ? { amount: String(expense.amount || ''), category: expense.category || 'General', description: expense.description || '', date: expense.date || getToday() } : { amount: '', category: 'General', description: '', date: getToday() });
    setShowExpenseModal(true);
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (Number(expenseForm.amount) <= 0) return;
    try {
      const res = await apiFetch(editingExpense ? `${API_BASE}/expenses/${editingExpense._id}` : `${API_BASE}/expenses`, { method: editingExpense ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...expenseForm, amount: Number(expenseForm.amount) }) });
      if (!res.ok) throw new Error();
      setShowExpenseModal(false); setEditingExpense(null); setExpenseForm({ amount: '', category: 'General', description: '', date: getToday() }); await loadMonthData(); notify(editingExpense ? 'Expense updated.' : 'Expense saved.');
    } catch (err) { notify('Error saving expense', 'error'); }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Ye expense delete karna hai?')) return;
    try { const res = await apiFetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error(); await loadMonthData(); notify('Expense deleted.'); } catch (err) { notify('Expense delete nahi hua.', 'error'); }
  };

  const openSalaryPayment = (st, payment = null) => {
    const stats = getStaffStats(st);
    setSelectedStaff(st);
    setEditingSalaryPayment(payment);
    setSalaryForm(payment
      ? { month: payment.month || selectedMonth, amount: String(payment.amount || ''), date: payment.date || getToday(), remark: payment.remark || '' }
      : { month: selectedMonth, amount: String(Math.round(stats.remaining || 0)), date: getToday(), remark: '' });
    setShowSalaryModal(true);
  };

  const handleSalaryPayment = async (e) => {
    e.preventDefault();
    if (!selectedStaff || Number(salaryForm.amount) <= 0) return;
    try {
      const monthStats = getPayrollForMonth(selectedStaff, salaryForm.month);
      const oldAmount = editingSalaryPayment ? Number(editingSalaryPayment.amount || 0) : 0;
      const allowed = Math.max(0, monthStats.remaining + oldAmount);
      const amount = Number(salaryForm.amount || 0);
      if (amount > allowed + 0.01) return notify(`Is month ka maximum remaining ₹${Math.round(allowed).toLocaleString()} hai.`, 'error');
      const url = editingSalaryPayment ? `${API_BASE}/staff-salary-payments/${editingSalaryPayment._id}` : `${API_BASE}/staff/${selectedStaff._id}/salary-payment`;
      const method = editingSalaryPayment ? 'PUT' : 'POST';
      const body = { month: salaryForm.month, date: salaryForm.date, amount, remark: salaryForm.remark || '' };
      const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error();
      setShowSalaryModal(false); setEditingSalaryPayment(null); await loadMonthData(); notify(editingSalaryPayment ? 'Salary payment updated.' : 'Salary payment recorded.');
    } catch (err) { notify('Error recording salary payment', 'error'); }
  };

  const handleDeleteSalaryPayment = async (payment) => {
    if (!window.confirm(`₹${Number(payment.amount || 0).toLocaleString()} salary payment delete karna hai?`)) return;
    try { const res = await apiFetch(`${API_BASE}/staff-salary-payments/${payment._id}`, { method: 'DELETE' }); if (!res.ok) throw new Error(); await loadMonthData(); notify('Salary payment deleted.'); } catch (err) { notify('Salary payment delete nahi hua.', 'error'); }
  };

  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Staff delete karna hai? Isse attendance/advance/salary payment history bhi delete hogi.')) return;
    try { const res = await apiFetch(`${API_BASE}/staff/${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error(); await refreshEverything(); } catch (err) { notify('Staff delete nahi hua.', 'error'); }
  };

  const openHistory = (st) => { setHistoryStaff(st); setShowHistoryModal(true); };

  const selectedStaffStats = selectedStaff ? getStaffStats(selectedStaff) : null;
  const totalSalaryLiability = staffList.reduce((sum, st) => sum + getStaffStats(st).totalOutstanding, 0);
  const totalPreviousDue = staffList.reduce((sum, st) => sum + getStaffStats(st).previousDue, 0);
  const totalCurrentRemaining = staffList.reduce((sum, st) => sum + getStaffStats(st).remaining, 0);
  const totalAdvances = staffList.reduce((sum, st) => sum + getStaffStats(st).advances, 0);
  const totalBusinessExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalSalaryPaid = salaryPayments.filter(p => String(p.month) === String(selectedMonth)).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2"><UserCheck className="w-6 h-6 text-amber-400" /> Staff & Expense Management</h3>
            <p className="text-xs text-slate-400 mt-1">Aaj ka status default <b className="text-emerald-400">Present</b> hai. Sirf Half-Day/Absent confirm karne par salary deduction lagega.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="month" value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setSelectedDate(`${e.target.value}-${String(Math.min(new Date().getDate(), monthDays(e.target.value))).padStart(2, '0')}`); }} className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" />
            <button onClick={() => openExpense()} className="bg-slate-800 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl font-black text-xs">+ Business Expense</button>
            <button onClick={() => setShowAddStaffModal(true)} className="bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-2"><Plus className="w-4 h-4" /> Add Staff</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          ['Staff', staffList.length, 'text-white'],
          ['Previous Salary Due', `₹${Math.round(totalPreviousDue).toLocaleString()}`, 'text-amber-400'],
          ['This Month Due', `₹${Math.round(totalCurrentRemaining).toLocaleString()}`, 'text-emerald-400'],
          ['Total Outstanding', `₹${Math.round(totalSalaryLiability).toLocaleString()}`, 'text-rose-400'],
          ['Salary Paid', `₹${Math.round(totalSalaryPaid).toLocaleString()}`, 'text-sky-400'],
          ['Other Expenses', `₹${Math.round(totalBusinessExpenses).toLocaleString()}`, 'text-purple-400']
        ].map(([label, value, cls]) => <div key={label} className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl"><div className="text-[10px] uppercase font-black text-slate-500">{label}</div><div className={`text-xl font-black mt-1 ${cls}`}>{value}</div></div>)}
      </div>

      <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div><h4 className="font-black text-white">{monthLabel} Attendance</h4><p className="text-xs text-slate-500">Selected date par default Present hai. Confirm karke Half / Absent mark karo.</p></div>
          <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); const m = e.target.value.slice(0, 7); if (m !== selectedMonth) setSelectedMonth(m); }} className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1180px]">
            <thead className="bg-slate-800/70 text-slate-400 uppercase"><tr><th className="p-3">Staff</th><th className="p-3">Salary</th><th className="p-3">Today</th><th className="p-3">P</th><th className="p-3">A</th><th className="p-3">Half</th><th className="p-3">Advance</th><th className="p-3">Prev Due</th><th className="p-3">Current Due</th><th className="p-3">Total Due</th><th className="p-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-800/60">
              {staffList.map(st => {
                const stats = getStaffStats(st); const entry = attendanceForDate(st._id, selectedDate);
                return <tr key={st._id} className="hover:bg-slate-800/30">
                  <td className="p-3"><div className="font-bold text-white">{st.name}</div><div className="text-[10px] text-amber-400">{st.role || 'Staff'}</div></td>
                  <td className="p-3 font-bold text-white">₹{Number(st.monthlySalary || 0).toLocaleString()}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-lg font-black ${entry.status === 'Present' ? 'bg-emerald-500/20 text-emerald-400' : entry.status === 'Absent' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>{entry.status}{entry.isDefault ? ' • Default' : ''}</span></td>
                  <td className="p-3 font-bold text-emerald-400">{stats.present}</td><td className="p-3 font-bold text-rose-400">{stats.absent}</td><td className="p-3 font-bold text-amber-400">{stats.half}</td><td className="p-3 font-bold text-purple-400">₹{Math.round(stats.advances).toLocaleString()}</td>
                  <td className="p-3 font-black text-amber-300">₹{Math.round(stats.previousDue).toLocaleString()}</td><td className="p-3 font-black text-emerald-300">₹{Math.round(stats.remaining).toLocaleString()}</td><td className="p-3 font-black text-rose-300">₹{Math.round(stats.totalOutstanding).toLocaleString()}</td>
                  <td className="p-3"><div className="flex flex-wrap gap-1.5">
                    {[['Present','bg-emerald-600','✓'],['Half-Day','bg-amber-600','½'],['Absent','bg-rose-600','×']].map(([status,color,icon]) => <button key={status} onClick={() => handleMarkAttendance(st._id,status)} className={`px-2 py-1 rounded-lg text-[10px] font-black ${entry.status === status ? color + ' text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>{icon} {status === 'Half-Day' ? 'Half' : status}</button>)}
                    <button onClick={() => openAdvance(st)} className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[10px] font-black">+ Advance</button>
                    <button onClick={() => openSalaryPayment(st)} className="px-2 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px] font-black">Pay Salary</button>
                    <button onClick={() => openHistory(st)} className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-black">History</button>
                    <button onClick={() => { setSelectedStaff({ ...st }); setShowEditStaffModal(true); }} className="px-2 py-1 rounded-lg bg-slate-800 text-amber-300 border border-slate-700 text-[10px] font-black">Edit</button>
                    <button onClick={() => handleDeleteStaff(st._id)} className="px-2 py-1 rounded-lg bg-slate-800 text-rose-400 border border-slate-700 text-[10px] font-black">Delete</button>
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {loadingRecords && <div className="text-xs text-slate-500 mt-3">Loading records...</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <h4 className="font-black text-white mb-3">Monthly Salary Calculation — {monthLabel}</h4>
          <div className="space-y-2 text-xs">{staffList.map(st => { const s = getStaffStats(st); return <div key={st._id} className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl"><div className="flex justify-between font-bold"><span>{st.name}</span><span className="text-rose-300">Total Outstanding ₹{Math.round(s.totalOutstanding).toLocaleString()}</span></div><div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-slate-400"><span>Base ₹{Math.round(s.baseSalary)}</span><span>Absent -₹{Math.round(s.absenceDeduction)}</span><span>Half -₹{Math.round(s.halfDayDeduction)}</span><span>Advance -₹{Math.round(s.advances)}</span></div><div className="text-[10px] text-slate-500 mt-1">Current remaining ₹{Math.round(s.remaining).toLocaleString()} • Previous due ₹{Math.round(s.previousDue).toLocaleString()} • Current payments ₹{Math.round(s.paid).toLocaleString()}</div></div>; })}</div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between mb-3"><h4 className="font-black text-white">Other Expenses — {monthLabel}</h4><button onClick={() => openExpense()} className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] font-black">+ Add</button></div>
          <div className="space-y-2 max-h-72 overflow-y-auto">{expenses.length === 0 && <div className="text-xs text-slate-500">No business expense recorded.</div>}{expenses.map(e => <div key={e._id} className="flex items-center justify-between gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-xl"><div><div className="text-xs font-bold text-white">{e.description || e.category}</div><div className="text-[10px] text-slate-500">{e.date} • {e.category}</div></div><div className="flex items-center gap-2"><span className="font-black text-rose-400">₹{Number(e.amount || 0).toLocaleString()}</span><button onClick={() => openExpense(e)} className="text-amber-400 text-[10px] font-black">Edit</button><button onClick={() => handleDeleteExpense(e._id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></div></div>)}</div>
        </div>
      </div>

      {showAddStaffModal && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4"><div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md"><h3 className="text-lg font-black text-white mb-4">Add Staff Member</h3><form onSubmit={handleAddStaffSubmit} className="space-y-3"><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Staff Name *" value={newStaff.name} onChange={e => setNewStaff({ ...newStaff,name:e.target.value })} required /><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Phone" value={newStaff.phone} onChange={e => setNewStaff({ ...newStaff,phone:e.target.value })} /><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Role / Designation" value={newStaff.role} onChange={e => setNewStaff({ ...newStaff,role:e.target.value })} /><div className="grid grid-cols-2 gap-2"><input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-emerald-400 font-bold" placeholder="Monthly Salary" value={newStaff.monthlySalary} onChange={e => setNewStaff({ ...newStaff,monthlySalary:e.target.value })} required /><input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={newStaff.joiningDate} onChange={e => setNewStaff({ ...newStaff,joiningDate:e.target.value })} /></div><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowAddStaffModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">Save Staff</button></div></form></div></div>}

      {showEditStaffModal && selectedStaff && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4"><div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md"><h3 className="text-lg font-black text-white mb-4">Edit Staff</h3><form onSubmit={handleEditStaffSubmit} className="space-y-3"><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={selectedStaff.name || ''} onChange={e => setSelectedStaff({...selectedStaff,name:e.target.value})} required /><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Phone" value={selectedStaff.phone || ''} onChange={e => setSelectedStaff({...selectedStaff,phone:e.target.value})} /><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Role" value={selectedStaff.role || ''} onChange={e => setSelectedStaff({...selectedStaff,role:e.target.value})} /><input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-emerald-400 font-bold" value={selectedStaff.monthlySalary || 0} onChange={e => setSelectedStaff({...selectedStaff,monthlySalary:e.target.value})} required /><input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={String(selectedStaff.joiningDate || '').slice(0,10)} onChange={e => setSelectedStaff({...selectedStaff,joiningDate:e.target.value})} /><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={selectedStaff.active !== false} onChange={e => setSelectedStaff({...selectedStaff,active:e.target.checked})} /> Active Staff</label><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowEditStaffModal(false)} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-xs font-black">Update Staff</button></div></form></div></div>}

      {showAdvanceModal && selectedStaff && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4"><div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md"><h3 className="text-lg font-black text-purple-300 mb-4">{editingAdvance ? 'Edit Advance' : 'Staff Advance'} — {selectedStaff.name}</h3><form onSubmit={handleAdvanceSubmit} className="space-y-3"><input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={advanceForm.date} onChange={e => setAdvanceForm({...advanceForm,date:e.target.value})} required /><input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" placeholder="Amount ₹" value={advanceForm.amount} onChange={e => setAdvanceForm({...advanceForm,amount:e.target.value})} required /><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Reason / Detail" value={advanceForm.reason} onChange={e => setAdvanceForm({...advanceForm,reason:e.target.value})} required /><div className="flex justify-end gap-2"><button type="button" onClick={() => {setShowAdvanceModal(false);setEditingAdvance(null);}} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-purple-500 text-white rounded-xl text-xs font-black">{editingAdvance ? 'Update Advance' : 'Save Advance'}</button></div></form></div></div>}

      {showExpenseModal && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4"><div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md"><h3 className="text-lg font-black text-rose-300 mb-4">{editingExpense ? 'Edit Business Expense' : 'Business Expense'}</h3><form onSubmit={handleExpenseSubmit} className="space-y-3"><input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm,date:e.target.value})} required /><select className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm,category:e.target.value})}><option>General</option><option>Electricity</option><option>Rent</option><option>Salary</option><option>Transport</option><option>Tea / Food</option><option>Repair & Maintenance</option><option>Telephone / Internet</option><option>Stationery</option><option>Bank / Payment Charges</option><option>Other</option></select><input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" placeholder="Amount ₹" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm,amount:e.target.value})} required /><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Expense description" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm,description:e.target.value})} required /><div className="flex justify-end gap-2"><button type="button" onClick={() => {setShowExpenseModal(false);setEditingExpense(null);}} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-black">{editingExpense ? 'Update Expense' : 'Save Expense'}</button></div></form></div></div>}

      {showSalaryModal && selectedStaff && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4"><div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md"><h3 className="text-lg font-black text-sky-300 mb-2">Salary Payment — {selectedStaff.name}</h3><div className="text-xs text-slate-400 mb-3">Total outstanding: <b className="text-rose-300">₹{Math.round(selectedStaffStats?.totalOutstanding || 0).toLocaleString()}</b></div><form onSubmit={handleSalaryPayment} className="space-y-3"><select className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={salaryForm.month} onChange={e => { const m=e.target.value; const ps=getPayrollForMonth(selectedStaff,m); setSalaryForm({...salaryForm,month:m,amount:String(Math.round(ps.remaining))}); }}>{monthKeysBetween(String(selectedStaff.joiningDate || '').slice(0,7) || selectedMonth, currentMonth).concat([currentMonth, selectedMonth, salaryForm.month]).filter((v,i,a)=>v && a.indexOf(v)===i).sort().map(m => <option key={m} value={m}>{new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</option>)}</select><input type="date" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={salaryForm.date} onChange={e => setSalaryForm({...salaryForm,date:e.target.value})} required /><input type="number" min="0" className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" placeholder="Payment ₹" value={salaryForm.amount} onChange={e => setSalaryForm({...salaryForm,amount:e.target.value})} required /><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Remark" value={salaryForm.remark} onChange={e => setSalaryForm({...salaryForm,remark:e.target.value})} /><div className="flex justify-end gap-2"><button type="button" onClick={() => {setShowSalaryModal(false);setEditingSalaryPayment(null);}} className="px-4 py-2 border border-slate-700 rounded-xl text-xs font-bold text-slate-400">Cancel</button><button type="submit" className="px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-black">{editingSalaryPayment ? 'Update Payment' : 'Record Payment'}</button></div></form></div></div>}

      {showHistoryModal && historyStaff && <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-50 p-4"><div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"><div className="flex items-center justify-between gap-3 mb-4"><div><h3 className="text-lg font-black text-white">Staff History — {historyStaff.name}</h3><p className="text-xs text-slate-500">Attendance, advances aur salary payments</p></div><button onClick={() => setShowHistoryModal(false)} className="text-slate-400 font-bold">✕</button></div><div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5"><div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10"><div className="text-[10px] uppercase font-black text-amber-400">Previous Salary Due</div><div className="text-2xl font-black text-amber-300">₹{Math.round(getStaffStats(historyStaff).previousDue).toLocaleString()}</div></div><div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/10"><div className="text-[10px] uppercase font-black text-sky-400">Total Salary Paid</div><div className="text-2xl font-black text-sky-300">₹{Math.round(getStaffStats(historyStaff).allPaid).toLocaleString()}</div></div><div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10"><div className="text-[10px] uppercase font-black text-rose-400">Total Outstanding</div><div className="text-2xl font-black text-rose-300">₹{Math.round(getStaffStats(historyStaff).totalOutstanding).toLocaleString()}</div></div></div><div className="mb-5"><h4 className="font-black text-white mb-2">Salary Month-wise</h4><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-800/70 text-slate-400 uppercase"><tr><th className="p-2 text-left">Month</th><th className="p-2">Base</th><th className="p-2">Absent</th><th className="p-2">Half</th><th className="p-2">Advance</th><th className="p-2">Salary Due</th><th className="p-2">Paid</th><th className="p-2">Remaining</th></tr></thead><tbody className="divide-y divide-slate-800/60">{getStaffStats(historyStaff).previousBreakdown.concat([getPayrollForMonth(historyStaff,selectedMonth)]).filter((x,i,a)=>a.findIndex(y=>y.month===x.month)===i).map(x => <tr key={x.month}><td className="p-2 text-left font-bold text-white">{new Date(`${x.month}-01T00:00:00`).toLocaleDateString('en-IN',{month:'short',year:'numeric'})}</td><td className="p-2 text-center">₹{Math.round(x.baseSalary).toLocaleString()}</td><td className="p-2 text-center text-rose-300">{x.absent}</td><td className="p-2 text-center text-amber-300">{x.half}</td><td className="p-2 text-center text-purple-300">₹{Math.round(x.advances).toLocaleString()}</td><td className="p-2 text-center">₹{Math.round(x.netPayable).toLocaleString()}</td><td className="p-2 text-center text-sky-300">₹{Math.round(x.paid).toLocaleString()}</td><td className="p-2 text-center font-black text-rose-300">₹{Math.round(x.remaining).toLocaleString()}</td></tr>)}</tbody></table></div></div><div className="mb-5">
  <h4 className="font-black text-white mb-2">Advance History</h4>

  <div className="space-y-2">
    {advanceRecords(historyStaff._id).length === 0 ? (
      <div className="text-xs text-slate-500">
        No advance record found.
      </div>
    ) : (
      advanceRecords(historyStaff._id).map(a => (
        <div
          key={a._id}
          className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800"
        >
          <div>
            <div className="text-xs font-bold text-white">
              {a.date}
            </div>

            <div className="text-[10px] text-slate-400">
              {a.remark || a.reason || 'Staff Advance'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-black text-purple-300">
              ₹{Number(a.advanceAmount || 0).toLocaleString()}
            </span>

            <button
              onClick={() => openAdvance(historyStaff, a)}
              className="text-amber-400 text-[10px] font-black"
            >
              Edit
            </button>

            <button
              onClick={() => handleDeleteAdvance(a)}
              className="text-rose-400 text-[10px] font-black"
            >
              Delete
            </button>
          </div>
        </div>
      ))
    )}
  </div>
</div><div><h4 className="font-black text-white mb-2">Salary Payment History</h4><div className="space-y-2">{salaryPayments.filter(p=>String(p.staffId)===String(historyStaff._id)).length===0 ? <div className="text-xs text-slate-500">No salary payment found.</div> : salaryPayments.filter(p=>String(p.staffId)===String(historyStaff._id)).map(p=><div key={p._id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800"><div><div className="text-xs font-bold text-white">{p.month} • {p.date}</div><div className="text-[10px] text-slate-500">{p.remark || 'Salary Payment'}</div></div><div className="flex items-center gap-3"><span className="font-black text-sky-300">₹{Number(p.amount||0).toLocaleString()}</span><button onClick={()=>openSalaryPayment(historyStaff,p)} className="text-amber-400 text-[10px] font-black">Edit</button><button onClick={()=>handleDeleteSalaryPayment(p)} className="text-rose-400 text-[10px] font-black">Delete</button></div></div>)}</div></div></div></div>}
    </div>
  );
}


// ==================== MASTER ARTICLES TAB ====================
function ArticlesTab({ articles, stocks, sizeRanges, setSizeRanges, onArticleAdded }) {
  const notify = useToast();
  const [form, setForm] = useState({ articleId: '', articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', mrp: '', purchaseDiscountPercent: 0, purchaseRate: 0, sellingDiscountPercent: 0, wholesaleRate: 0, sellingPrice: 0, pairsInPeti: 12, cartons: 0, loosePairs: 0 });
  const [editingArticleId, setEditingArticleId] = useState(null);
  const articleFormRef = useRef(null);
  const [showCustomSizeModal, setShowCustomSizeModal] = useState(false);
  const [paymentBill, setPaymentBill] = useState(null);
  const [deliveryCash, setDeliveryCash] = useState('');
  const [deliveryOnline, setDeliveryOnline] = useState('');
  const [savingDeliveryPayment, setSavingDeliveryPayment] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [articleSearch, setArticleSearch] = useState('');
  const filteredArticles = articles.filter(a => {
    const q = articleSearch.trim().toLowerCase();
    return !q || [a.articleCode, a.brand, a.color, a.sizeRange].some(v => String(v ?? '').toLowerCase().includes(q));
  });

  const handleArticleDropdownChange = (value) => {
    const rawValue = String(value || '').trim();
    const selectedById = articles.find(a => String(a._id) === rawValue);
    const code = String(selectedById?.articleCode || rawValue).trim().toUpperCase();

    if (!code) {
      setEditingArticleId(null);
      setForm({ articleId: '', articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', mrp: '', purchaseDiscountPercent: 0, purchaseRate: 0, sellingDiscountPercent: 0, wholesaleRate: 0, sellingPrice: 0, pairsInPeti: 12, cartons: 0, loosePairs: 0 });
      return;
    }

    const selectedArt = selectedById || articles.find(a => String(a.articleCode || '').toUpperCase() === code);
    if (!selectedArt) {
      setEditingArticleId(null);
      setForm({ ...form, articleCode: code });
      return;
    }

    setEditingArticleId(selectedArt._id || null);
    setForm({
      articleId: selectedArt._id || '',
      articleCode: code,
      brand: selectedArt.brand || '',
      color: selectedArt.color || '',
      sizeRange: selectedArt.sizeRange || '6*9 (Gents)',
      mrp: selectedArt.mrp && Number(selectedArt.mrp) > 0 ? String(selectedArt.mrp) : '',
      purchaseDiscountPercent: selectedArt.purchaseDiscountPercent ?? 0,
      purchaseRate: selectedArt.purchaseRate ?? 0,
      sellingDiscountPercent: selectedArt.sellingDiscountPercent ?? 0,
      wholesaleRate: selectedArt.wholesaleRate ?? selectedArt.sellingPrice ?? 0,
      sellingPrice: selectedArt.sellingPrice ?? selectedArt.wholesaleRate ?? 0,
      pairsInPeti: selectedArt.pairsInPeti ?? 12,
      cartons: selectedArt.cartons ?? 0,
      loosePairs: selectedArt.loosePairs ?? 0
    });
  };

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

  const updatePurchaseDiscount = (value) => {
    const percent = Math.max(0, Number(value || 0));
    const mrp = Number(form.mrp || 0);
    setForm({ ...form, purchaseDiscountPercent: value, purchaseRate: mrp > 0 ? Number((mrp * (1 - percent / 100)).toFixed(2)) : form.purchaseRate });
  };

  const updatePurchaseRate = (value) => {
    const mrp = Number(form.mrp || 0);
    const rate = Number(value || 0);
    setForm({ ...form, purchaseRate: value, purchaseDiscountPercent: mrp > 0 ? Number((((mrp - rate) / mrp) * 100).toFixed(2)) : 0 });
  };

  const updateSellingDiscount = (value) => {
    const percent = Math.max(0, Number(value || 0));
    const mrp = Number(form.mrp || 0);
    const sellingPrice = mrp > 0 ? Number((mrp * (1 - percent / 100)).toFixed(2)) : form.sellingPrice;
    setForm({ ...form, sellingDiscountPercent: value, sellingPrice, wholesaleRate: sellingPrice });
  };

  const updateSellingPrice = (value) => {
    const mrp = Number(form.mrp || 0);
    const rate = Number(value || 0);
    setForm({ ...form, sellingPrice: value, wholesaleRate: value, sellingDiscountPercent: mrp > 0 ? Number((((mrp - rate) / mrp) * 100).toFixed(2)) : 0 });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingArticleId ? `${API_BASE}/articles/${editingArticleId}` : `${API_BASE}/articles`;
      const method = editingArticleId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        notify(editingArticleId ? 'Article Updated Successfully!' : 'Article Saved & Stock Synced Successfully!');
        onArticleAdded();
        setForm({ articleId: '', articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', mrp: '', purchaseDiscountPercent: 0, purchaseRate: 0, sellingDiscountPercent: 0, wholesaleRate: 0, sellingPrice: 0, pairsInPeti: 12, cartons: 0, loosePairs: 0 });
        setEditingArticleId(null);
      }
    } catch (err) { notify('Error saving article', 'error'); }
  };

  const handleEditClick = (a) => {
    setEditingArticleId(a._id);
    const matchedStock = stocks.find(s => String(s.articleCode || '').toUpperCase() === String(a.articleCode || '').toUpperCase() && String(s.sizeRange || '') === String(a.sizeRange || '') && Number(s.sellingPrice || 0) === Number(a.sellingPrice || a.wholesaleRate || 0)) || {};
    setForm({
      articleId: a._id || '',
      articleCode: String(a.articleCode || '').toUpperCase(),
      brand: a.brand || '',
      color: a.color || '',
      sizeRange: a.sizeRange || '6*9 (Gents)',
      mrp: a.mrp || 0,
      purchaseDiscountPercent: a.purchaseDiscountPercent ?? (a.mrp > 0 ? Number((((a.mrp - (a.purchaseRate || matchedStock.purchaseRate || 0)) / a.mrp) * 100).toFixed(2)) : 0),
      purchaseRate: a.purchaseRate || matchedStock.purchaseRate || 0,
      sellingDiscountPercent: a.sellingDiscountPercent ?? (a.mrp > 0 ? Number((((a.mrp - (a.sellingPrice || a.wholesaleRate || 0)) / a.mrp) * 100).toFixed(2)) : 0),
      wholesaleRate: a.wholesaleRate || 0,
      sellingPrice: a.sellingPrice || a.wholesaleRate || 0,
      pairsInPeti: a.pairsInPeti || 12,
      cartons: matchedStock.cartons || 0,
      loosePairs: matchedStock.loosePairs || 0
    });
    setTimeout(() => {
  articleFormRef.current?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}, 100);
  };

  const handleDeleteArticle = async (id) => {
    if (window.confirm('Delete article? (This will also remove synced stock entry)')) {
      await apiFetch(`${API_BASE}/articles/${id}`, { method: 'DELETE' });
      onArticleAdded();
    }
  };

  return (
    <div ref={articleFormRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-amber-400" /> {editingArticleId ? 'Edit Master Article' : 'Add New Master Article'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Article Code *</label>
            <SearchableBillingDropdown
              value={form.articleId || form.articleCode}
              onChange={handleArticleDropdownChange}
              placeholder="Search / choose Article Code..."
              options={articles.map((a) => ({
                value: a._id || String(a.articleCode || '').toUpperCase(),
                label: `${String(a.articleCode || '').toUpperCase()} • ${a.sizeRange || ''} • ₹${Number(a.sellingPrice || a.wholesaleRate || 0).toFixed(2)}`
              }))}
              allowCustomValue
              customValueLabel="Use new Article Code"
              className="w-full"
            />
            <input
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              value={form.articleCode}
              onChange={() => {}}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Brand Name</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Campus, Sparx" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Color</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" placeholder="Black, Tan" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Size Range</label>
            <select className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.sizeRange} onChange={handleSizeDropdownChange}>
              {sizeRanges.map((sz, idx) => <option key={idx} value={sz}>{sz}</option>)}
              <option value="ADD_CUSTOM_SIZE_RANGE" className="bg-amber-900 text-amber-200 font-bold">➕ + Add Custom Size...</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">MRP (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" type="number" placeholder="0" value={form.mrp} onChange={(e) => { const mrp = e.target.value; const n = Number(mrp || 0); setForm({ ...form, mrp, purchaseRate: n > 0 && form.purchaseDiscountPercent !== '' ? Number((n * (1 - Number(form.purchaseDiscountPercent || 0) / 100)).toFixed(2)) : form.purchaseRate, sellingPrice: n > 0 && form.sellingDiscountPercent !== '' ? Number((n * (1 - Number(form.sellingDiscountPercent || 0) / 100)).toFixed(2)) : form.sellingPrice, wholesaleRate: n > 0 && form.sellingDiscountPercent !== '' ? Number((n * (1 - Number(form.sellingDiscountPercent || 0) / 100)).toFixed(2)) : form.wholesaleRate }); }} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Purchase Discount (%)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-sky-300 font-bold" type="number" min="0" step="0.01" placeholder="0" value={form.purchaseDiscountPercent} onChange={(e) => updatePurchaseDiscount(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Purchasing Price (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-emerald-400 font-bold" type="number" min="0" step="0.01" placeholder="0" value={form.purchaseRate} onChange={(e) => updatePurchaseRate(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Selling Discount (%)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-sky-300 font-bold" type="number" min="0" step="0.01" placeholder="0" value={form.sellingDiscountPercent} onChange={(e) => updateSellingDiscount(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Selling Price / Wholesale (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-amber-400 font-bold" type="number" min="0" step="0.01" placeholder="0" value={form.sellingPrice} onChange={(e) => updateSellingPrice(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Pairs In Cartons</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" type="number" placeholder="12" value={form.pairsInPeti} onChange={(e) => setForm({ ...form, pairsInPeti: e.target.value })} /></div>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider block">Godown Initial Stock Sync</span>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-[11px] font-bold text-slate-400">Cartons</label><input className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white" type="number" value={form.cartons} onChange={(e) => setForm({ ...form, cartons: e.target.value })} /></div>
              <div><label className="block text-[11px] font-bold text-slate-400">Loose Pairs</label><input className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white" type="number" value={form.loosePairs} onChange={(e) => setForm({ ...form, loosePairs: e.target.value })} /></div>
            </div>
          </div>
          <div className="flex gap-2">
            {editingArticleId && (
              <button type="button" onClick={() => { setEditingArticleId(null); setForm({ articleId: '', articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', mrp: '', purchaseDiscountPercent: 0, purchaseRate: 0, sellingDiscountPercent: 0, wholesaleRate: 0, sellingPrice: 0, pairsInPeti: 12, cartons: 0, loosePairs: 0 }); }} className="w-1/3 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs">
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
        <h3 className="font-extrabold text-white md:text-lg mb-4 flex items-center justify-between">
          <span>🏷️ Master Articles Catalog</span>
          <span className="text-xs text-amber-400 bg-amber-950/50 border border-amber-800/60 px-3 py-1 rounded-full font-bold">Synced with Godown Stock</span>
        </h3>
        <div className="mb-4 relative max-w-sm"><input value={articleSearch} onChange={(e) => setArticleSearch(e.target.value)} placeholder="Search article / brand / color / size..." className="w-full p-2.5 pr-8 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500" />{articleSearch && <button type="button" onClick={() => setArticleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">×</button>}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/70 text-slate-400 uppercase">
              <tr>
                <th className="p-3">S.No.</th>
                <th className="p-2.5">Article</th>
                <th className="p-2.5">Size / Color</th>
                <th className="p-2.5">MRP</th>
                <th className="p-2.5">Purchase</th>
                <th className="p-2.5">Selling</th>
                <th className="p-2.5">Stock (CN/Pairs)</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredArticles.map((a, index) => {
                const matchedStock = stocks.find(s => s.articleCode === a.articleCode) || {};
                return (
                  <tr key={a._id} className="hover:bg-slate-800/40">
                    <td className="p-3">{index + 1}</td>
                    <td className="p-2.5 font-bold text-white">
                      {String(a.articleCode || '').toUpperCase()}
                      <span className="block text-[10px] text-slate-400">{a.brand || 'No Brand'}</span>
                    </td>
                    <td className="p-2.5 text-slate-300">
                      <div>{a.sizeRange || '-'}</div>
                      <span className="text-[10px] text-slate-400">{a.color || '-'}</span>
                    </td>
                    <td className="p-2.5 font-bold text-slate-300">₹{Number(a.mrp || 0).toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-emerald-400">₹{Number(a.purchaseRate || matchedStock.purchaseRate || 0).toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-amber-400">₹{Number(a.sellingPrice || a.wholesaleRate || 0).toFixed(2)}</td>
                    <td className="p-2.5 font-black text-sky-400">
                      {matchedStock.cartons || 0} CN ({matchedStock.totalPairs || 0} Pr)
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
  const notify = useToast();
  const [editingStockId, setEditingStockId] = useState(null);
  const stockFormRef = useRef(null);
  const [isCustomStockArticle, setIsCustomStockArticle] = useState(false); const [form, setForm] = useState({ articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', cartons: 0, pairsPerCarton: 12, loosePairs: 0, mrp: '', purchaseRate: 0, sellingPrice: 0 });
  const [showCustomSizeModal, setShowCustomSizeModal] = useState(false);
  const [paymentBill, setPaymentBill] = useState(null);
  const [deliveryCash, setDeliveryCash] = useState('');
  const [deliveryOnline, setDeliveryOnline] = useState('');
  const [savingDeliveryPayment, setSavingDeliveryPayment] = useState(false);
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const filteredStocks = stocks.filter(s => {
    const q = stockSearch.trim().toLowerCase();
    return !q || [s.articleCode, s.sizeRange, s.color, s.purchaseRate].some(v => String(v ?? '').toLowerCase().includes(q));
  });

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
    const rawValue = String(e.target.value || '').trim();
    const selectedArtById = articles.find(a => String(a._id) === rawValue);
    const code = String(selectedArtById?.articleCode || rawValue).trim().toUpperCase();

    if (code === 'ADD_CUSTOM_ARTICLE') {
      setIsCustomStockArticle(true);
      setForm({ articleId: '', articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', cartons: 0, pairsPerCarton: 12, loosePairs: 0, mrp: '', purchaseRate: 0, sellingPrice: 0 });
      return;
    }

    if (!code) {
      setIsCustomStockArticle(false);
      setForm({ articleId: '', articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', cartons: 0, pairsPerCarton: 12, loosePairs: 0, mrp: '', purchaseRate: 0, sellingPrice: 0 });
      return;
    }

    setIsCustomStockArticle(false);
    const selectedArt = selectedArtById || articles.find(a => String(a.articleCode || '').toUpperCase() === code);
    if (selectedArt) {
      setForm({
        articleId: selectedArt._id || '',
        articleCode: code,
        brand: selectedArt.brand || '',
        color: selectedArt.color || '',
        sizeRange: selectedArt.sizeRange || '6*9 (Gents)',
        cartons: 0,
        pairsPerCarton: selectedArt.pairsInPeti || 12,
        loosePairs: 0,
        mrp: selectedArt.mrp && Number(selectedArt.mrp) > 0 ? String(selectedArt.mrp) : '',
        purchaseRate: selectedArt.purchaseRate ?? 0,
        sellingPrice: selectedArt.sellingPrice ?? selectedArt.wholesaleRate ?? 0
      });
    } else {
      setForm({ articleId: '', articleCode: code, brand: '', color: '', sizeRange: '6*9 (Gents)', cartons: 0, pairsPerCarton: 12, loosePairs: 0, mrp: '', purchaseRate: 0, sellingPrice: 0 });
    }
  };

  const resetStockForm = () => {
    setForm({ articleId: '', articleCode: '', brand: '', color: '', sizeRange: '6*9 (Gents)', cartons: 0, pairsPerCarton: 12, loosePairs: 0, mrp: '', purchaseRate: 0, sellingPrice: 0 });
    setEditingStockId(null);
    setIsCustomStockArticle(false);
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingStockId ? `${API_BASE}/stock/${editingStockId}` : `${API_BASE}/stock/inward`;
      const method = editingStockId ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error updating stock');
      }
      notify(editingStockId ? 'Stock Updated & Article Synced!' : 'Stock Inward Added & Synced!');
      onStockUpdated();
      resetStockForm();
    } catch (err) { notify(err.message || 'Error updating stock', 'error'); }
  };

  const handleDeleteStock = async (id) => {
    if (window.confirm('Delete this stock item?')) {
      try {
        const res = await apiFetch(`${API_BASE}/stock/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error deleting stock');
        onStockUpdated();
        notify('Stock deleted successfully!');
      } catch (err) { notify(err.message || 'Error deleting stock', 'error'); }
    }
  };

  const handleEditStock = (s) => {
    setEditingStockId(s._id);
    setIsCustomStockArticle(false);
    const matchingArticle = articles.find(a => String(a.articleCode || '').trim().toUpperCase() === String(s.articleCode || '').trim().toUpperCase() && String(a.sizeRange || '').trim() === String(s.sizeRange || '').trim() && Number(a.sellingPrice || a.wholesaleRate || 0) === Number(s.sellingPrice || 0));
    setForm({
      articleId: matchingArticle?._id || '',
      articleCode: s.articleCode || '',
      brand: s.brand || '',
      color: s.color || '',
      sizeRange: s.sizeRange || '6*9 (Gents)',
      cartons: s.cartons || 0,
      pairsPerCarton: s.pairsPerCarton || 12,
      loosePairs: s.loosePairs || 0,
      mrp: s.mrp || 0,
      purchaseRate: s.purchaseRate || 0,
      sellingPrice: s.sellingPrice || 0
    });
    setTimeout(() => {
  stockFormRef.current?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}, 100);
  };


  return (
    <div ref={stockFormRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-400" /> {editingStockId ? 'Edit Stock Entry' : 'Stock Inward Entry'}
        </h3>
        <form onSubmit={handleStockSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Article Code *</label>
           <SearchableBillingDropdown
              value={form.articleId || form.articleCode}
              onChange={(value) => handleArticleSelect({ target: { value } })}
              placeholder="Search / choose Article Code..."
              options={[
                ...articles.map((a) => ({
                  value: a._id || String(a.articleCode || '').toUpperCase(),
                  label: `${String(a.articleCode || '').toUpperCase()} • ${a.sizeRange || ''} • ₹${Number(a.sellingPrice || a.wholesaleRate || 0).toFixed(2)}`
                })),
                { value: 'ADD_CUSTOM_ARTICLE', label: '✍️ Enter Custom Article Code...' }
              ]}
              allowCustomValue
              customValueLabel="Use new Article Code"
              className="w-full"
            />
            {isCustomStockArticle && (
              <input className="w-full mt-2 p-2.5 bg-slate-800 border border-amber-500/50 rounded-xl text-sm text-amber-300 uppercase font-bold" placeholder="Enter Custom Article Code" value={form.articleCode} onChange={(e) => setForm({ ...form, articleCode: e.target.value.toUpperCase() })} required />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Brand Name</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Color</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Size Range</label>
            <select className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.sizeRange} onChange={handleSizeDropdownChange}>
              {sizeRanges.map((sz, idx) => <option key={idx} value={sz}>{sz}</option>)}
              <option value="ADD_CUSTOM_SIZE_RANGE" className="bg-amber-900 text-amber-200 font-bold">➕ + Add Custom Size...</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">MRP (₹)</label>
            <input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Cartons</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" type="number" value={form.cartons} onChange={(e) => setForm({ ...form, cartons: e.target.value })} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Pairs/Carton</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" type="number" value={form.pairsPerCarton} onChange={(e) => setForm({ ...form, pairsPerCarton: e.target.value })} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Loose Pairs</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" type="number" value={form.loosePairs} onChange={(e) => setForm({ ...form, loosePairs: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Purchase Rate (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-emerald-400 font-bold" type="number" value={form.purchaseRate} onChange={(e) => setForm({ ...form, purchaseRate: e.target.value })} /></div>
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Selling Rate (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-amber-400 font-bold" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-2">
            {editingStockId && <button type="button" onClick={resetStockForm} className="w-1/3 bg-slate-800 text-slate-300 py-3 rounded-xl font-bold text-xs">Cancel</button>}
            <button type="submit" className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 py-3 rounded-xl font-black text-xs shadow-lg">
              {editingStockId ? 'Update Stock' : '+ Add Stock Inward'}
            </button>
          </div>
        </form>
      </div>

      <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"><h3 className="font-extrabold text-white text-lg">📦 Godown Current Stock Level</h3><div className="relative sm:w-72"><input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} placeholder="Search article / size / color..." className="w-full p-2.5 pr-8 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500" />{stockSearch && <button type="button" onClick={() => setStockSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">×</button>}</div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/70 text-slate-400 uppercase">
              <tr>
                <th className="p-3">S.No.</th>
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
              {filteredStocks.map((s, index) => (
                <tr key={s._id} className="hover:bg-slate-800/40">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-2.5 font-bold text-white">{s.articleCode}</td>
                  <td className="p-2.5 text-slate-300">{s.sizeRange} <span className="text-[10px] text-slate-400 block">{s.color}</span></td>
                  <td className="p-2.5 font-bold text-slate-200">{s.cartons} CN</td>
                  <td className="p-2.5 text-slate-400">{s.loosePairs} Pr</td>
                  <td className="p-2.5 font-black text-amber-400">{s.totalPairs} Pairs</td>
                  <td className="p-2.5 font-bold text-emerald-400">₹{Number(s.purchaseRate || 0).toFixed(2)}</td>
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
  const notify = useToast();
  const [form, setForm] = useState({ name: '', phone: '', city: '', openingBalance: 0, currentBalance: 0 });
  const [editingId, setEditingId] = useState(null);
  const partyFormRef = useRef(null);
  const [partySearch, setPartySearch] = useState('');
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [paymentHistoryParty, setPaymentHistoryParty] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    paymentDate: '',
    amount: '',
    paymentMode: 'Cash',
    reference: '',
    remark: ''
  });
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentParty, setPaymentParty] = useState(null);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: '',
    paymentMode: 'Cash',
    reference: '',
    remark: ''
  });

  const filteredParties = parties.filter(p => {
    const q = partySearch.trim().toLowerCase();
    return !q || [p.name, p.city, p.phone].some(v => String(v ?? '').toLowerCase().includes(q));
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `${API_BASE}/parties/${editingId}` : `${API_BASE}/parties`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        notify(editingId ? 'Party Details Updated!' : 'New Party Added!');
        onPartyAdded();
        setForm({ name: '', phone: '', city: '', openingBalance: 0, currentBalance: 0 });
        setEditingId(null);
      }
    } catch (err) { notify('Error saving party', 'error'); }
  };

  const handleEdit = (p) => {
  setEditingId(p._id);
  setForm({
    name: p.name || '',
    phone: p.phone || '',
    city: p.city || '',
    openingBalance: p.openingBalance || 0,
    currentBalance: p.currentBalance || 0
  });

  setTimeout(() => {
    partyFormRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }, 100);
};

  const handleDelete = async (id) => {
    if (window.confirm('Delete party account?')) {
      await apiFetch(`${API_BASE}/parties/${id}`, { method: 'DELETE' });
      onPartyAdded();
    }
  };

    const openPartyPayment = (party) => {
    setPaymentParty(party);
    setPaymentForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: '',
      paymentMode: 'Cash',
      reference: '',
      remark: ''
    });
    setShowPaymentModal(true);
  };

  const savePartyPayment = async (e) => {
    e.preventDefault();

    if (!paymentParty) return;

    const amount = Number(paymentForm.amount || 0);

    if (amount <= 0) {
      notify('Payment amount must be greater than 0', 'error');
      return;
    }

    setPaymentSaving(true);

    try {
      const res = await apiFetch(`${API_BASE}/party-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: paymentParty._id,
          paymentDate: paymentForm.paymentDate,
          amount,
          paymentMode: paymentForm.paymentMode,
          reference: paymentForm.reference,
          remark: paymentForm.remark
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Payment save failed');
      }

      notify('Party payment received successfully!');

      setShowPaymentModal(false);
      setPaymentParty(null);

      setPaymentForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        amount: '',
        paymentMode: 'Cash',
        reference: '',
        remark: ''
      });

      await onPartyAdded();

    } catch (err) {
      notify(err.message || 'Payment save failed', 'error');
    } finally {
      setPaymentSaving(false);
    }
  };

    const openPaymentHistory = async (party) => {
  setPaymentHistoryParty(party);
  setShowPaymentHistory(true);
  setPaymentHistoryLoading(true);
  setPaymentHistory([]);

  try {
    // 1. Latest party balance fetch karo
    const partiesRes = await apiFetch(`${API_BASE}/parties`);
    const partiesData = await partiesRes.json().catch(() => []);

    if (partiesRes.ok && Array.isArray(partiesData)) {
      const latestParty = partiesData.find(
        p => String(p._id) === String(party._id)
      );

      if (latestParty) {
        setPaymentHistoryParty(latestParty);
      }
    }

    // 2. Payment history fetch karo
    const res = await apiFetch(
      `${API_BASE}/party-payments?partyId=${party._id}`
    );

    const data = await res.json().catch(() => []);

    if (!res.ok) {
      throw new Error(
        data.error ||
        data.message ||
        'Payment history fetch failed'
      );
    }

    setPaymentHistory(Array.isArray(data) ? data : []);

  } catch (err) {
    notify(
      err.message || 'Payment history fetch failed',
      'error'
    );
  } finally {
    setPaymentHistoryLoading(false);
  }
};

    const openEditPayment = (payment) => {
    setEditingPayment(payment);

    setEditPaymentForm({
      paymentDate: payment.paymentDate || '',
      amount: payment.amount ?? '',
      paymentMode: payment.paymentMode || 'Cash',
      reference: payment.reference || '',
      remark: payment.remark || ''
    });
  };

    const saveEditedPayment = async (e) => {
    e.preventDefault();

    if (!editingPayment) return;

    const amount = Number(editPaymentForm.amount || 0);

    if (amount <= 0) {
      notify('Payment amount must be greater than 0', 'error');
      return;
    }

    try {
      const res = await apiFetch(
        `${API_BASE}/party-payments/${editingPayment._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentDate: editPaymentForm.paymentDate,
            amount,
            paymentMode: editPaymentForm.paymentMode,
            reference: editPaymentForm.reference,
            remark: editPaymentForm.remark
          })
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Payment update failed');
      }

      notify('Payment updated successfully!');

      setEditingPayment(null);

      await openPaymentHistory(paymentHistoryParty);

      await onPartyAdded();

    } catch (err) {
      notify(err.message || 'Payment update failed', 'error');
    }
  };

    const deletePartyPayment = async (payment) => {
    if (!window.confirm(
      `Delete payment of ₹${Number(payment.amount || 0).toFixed(2)}?`
    )) {
      return;
    }

    try {
      const res = await apiFetch(
        `${API_BASE}/party-payments/${payment._id}`,
        {
          method: 'DELETE'
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Payment delete failed');
      }

      notify('Payment deleted successfully!');

      await openPaymentHistory(paymentHistoryParty);

      await onPartyAdded();

    } catch (err) {
      notify(err.message || 'Payment delete failed', 'error');
    }
  };

  return (
    <div ref={partyFormRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <h3 className="font-extrabold text-white text-lg mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" /> {editingId ? 'Edit Party Details' : 'Add New Wholesale Party'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="block text-xs font-bold text-slate-300 mb-1">Party Name *</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white font-bold" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="block text-xs font-bold text-slate-300 mb-1">City / Location</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label className="block text-xs font-bold text-slate-300 mb-1">Phone Number</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          {editingId && (
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Due Amount (₹)</label><input className="w-full p-2.5 bg-rose-950/30 border border-rose-800/50 rounded-xl text-sm text-rose-400 font-bold" type="number" min="0" value={form.currentBalance} onChange={(e) => setForm({ ...form, currentBalance: e.target.value })} /></div>
          )}
          {!editingId && (
            <div><label className="block text-xs font-bold text-slate-300 mb-1">Opening Balance (₹)</label><input className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-rose-400 font-bold" type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} /></div>
          )}
          <div className="flex gap-2 pt-2">
            {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', phone: '', city: '', openingBalance: 0, currentBalance: 0 }); }} className="w-1/3 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs">Cancel</button>}
            <button type="submit" className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow-lg">
              {editingId ? 'Update Party' : 'Save Party'}
            </button>
          </div>
        </form>
      </div>

      <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="font-extrabold text-white text-lg">👥 Wholesale Parties Directory</h3>
          <div className="relative w-full sm:w-64">
            <input value={partySearch} onChange={(e) => setPartySearch(e.target.value)} placeholder="Search party / city / phone..." className="w-full p-2.5 pr-8 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-amber-500" />
            {partySearch && <button type="button" onClick={() => setPartySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">×</button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/70 text-slate-400 uppercase">
              <tr>
                <th className="p-3">S.No.</th>
                <th className="p-2.5">Party Name</th>
                <th className="p-2.5">City</th>
                <th className="p-2.5">Phone</th>
                <th className="p-2.5">Current Balance (₹)</th>
                <th className="p-2.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredParties.map((p, index) => (
                <tr key={p._id} className="hover:bg-slate-800/40">
                  <td className="p-3">{index + 1}</td>
                  <td className="p-2.5 font-bold text-white">{p.name}</td>
                  <td className="p-2.5 text-slate-300">{p.city || '-'}</td>
                  <td className="p-2.5 text-slate-300">{p.phone || '-'}</td>
                  <td className="p-2.5 font-black text-rose-400">₹{Number(p.currentBalance || 0).toFixed(2)}</td>
                  <td className="p-2.5 text-center">
                    <div className="flex justify-center gap-2">
                      <button
  type="button"
  onClick={() => openPartyPayment(p)}
  className="text-emerald-400 hover:text-emerald-300"
  title="Receive Payment"
>
  💵
</button>

<button
  type="button"
  onClick={() => openPaymentHistory(p)}
  className="text-cyan-400 hover:text-cyan-300"
  title="Payment History"
>
  📋
</button>

                      <button type="button" onClick={() => handleEdit(p)} className="text-amber-400 hover:text-amber-300"><Edit className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handleDelete(p._id)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
                      
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
            {showPaymentModal && paymentParty && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">
                  Receive Party Payment
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Record payment received from party
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={savePartyPayment} className="p-5 space-y-4">

              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3">
                <div className="text-xs text-slate-400">Party</div>
                <div className="text-sm font-black text-white">
                  {paymentParty.name}
                </div>

                <div className="text-xs text-slate-400 mt-2">
                  Current Due
                </div>
                <div className="text-lg font-black text-rose-400">
                  ₹{Number(paymentParty.currentBalance || 0).toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentDate: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-emerald-700 rounded-xl text-sm text-white font-black"
                  placeholder="Enter payment amount"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentMode: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Reference / UTR
                </label>
                <input
                  value={paymentForm.reference}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      reference: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                  placeholder="Online payment reference / UTR"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Remark / Detail
                </label>
                <input
                  value={paymentForm.remark}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      remark: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                  placeholder="Payment detail..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs"
                  disabled={paymentSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={paymentSaving}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow-lg disabled:opacity-50"
                >
                  {paymentSaving ? 'Saving...' : 'Save Payment'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
            {showPaymentHistory && paymentHistoryParty && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">
                  Payment History / Ledger
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {paymentHistoryParty.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPaymentHistory(false);
                  setPaymentHistoryParty(null);
                }}
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-5 overflow-y-auto">

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3">
                  <div className="text-xs text-slate-400">
                    Current Due
                  </div>
                  <div className="text-lg font-black text-rose-400">
                    ₹{Number(paymentHistoryParty.currentBalance || 0).toFixed(2)}
                  </div>
                </div>

                <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3">
                  <div className="text-xs text-slate-400">
                    Total Payments
                  </div>
                  <div className="text-lg font-black text-emerald-400">
                    ₹{paymentHistory
                      .reduce(
                        (sum, item) => sum + Number(item.amount || 0),
                        0
                      )
                      .toFixed(2)}
                  </div>
                </div>
              </div>

              {paymentHistoryLoading ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  Loading payment history...
                </div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No payment history found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-400 uppercase">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3">Mode</th>
                        <th className="p-3">Reference / UTR</th>
                        <th className="p-3">Remark</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-800">
                      {paymentHistory.map((payment) => (
                        <tr
                          key={payment._id}
                          className="hover:bg-slate-800/40"
                        >
                          <td className="p-3 text-slate-300">
                            {payment.paymentDate || '-'}
                          </td>

                          <td className="p-3 text-right font-black text-emerald-400">
                            ₹{Number(payment.amount || 0).toFixed(2)}
                          </td>

                          <td className="p-3">
                            <span
                              className={
                                payment.paymentMode === 'Online'
                                  ? 'text-cyan-400 font-bold'
                                  : 'text-amber-400 font-bold'
                              }
                            >
                              {payment.paymentMode || 'Cash'}
                            </span>
                          </td>

                          <td className="p-3 text-slate-300">
                            {payment.reference || '-'}
                          </td>

                          <td className="p-3 text-slate-300">
                            {payment.remark || '-'}
                          </td>
                          <td className="p-3">
  <div className="flex justify-center gap-2">

    <button
      type="button"
      onClick={() => openEditPayment(payment)}
      className="text-amber-400 hover:text-amber-300"
      title="Edit Payment"
    >
      <Edit className="w-4 h-4" />
    </button>

    <button
      type="button"
      onClick={() => deletePartyPayment(payment)}
      className="text-rose-400 hover:text-rose-300"
      title="Delete Payment"
    >
      <Trash2 className="w-4 h-4" />
    </button>

  </div>
</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        
        </div>
      )}
            {editingPayment && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white">
                  Edit Payment
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {paymentHistoryParty?.name || ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingPayment(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveEditedPayment}
              className="p-5 space-y-4"
            >

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Payment Date
                </label>

                <input
                  type="date"
                  value={editPaymentForm.paymentDate}
                  onChange={(e) =>
                    setEditPaymentForm({
                      ...editPaymentForm,
                      paymentDate: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Amount Received (₹)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editPaymentForm.amount}
                  onChange={(e) =>
                    setEditPaymentForm({
                      ...editPaymentForm,
                      amount: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-emerald-700 rounded-xl text-sm text-white font-black"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Payment Mode
                </label>

                <select
                  value={editPaymentForm.paymentMode}
                  onChange={(e) =>
                    setEditPaymentForm({
                      ...editPaymentForm,
                      paymentMode: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Reference / UTR
                </label>

                <input
                  value={editPaymentForm.reference}
                  onChange={(e) =>
                    setEditPaymentForm({
                      ...editPaymentForm,
                      reference: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                  placeholder="Online payment reference / UTR"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Remark / Detail
                </label>

                <input
                  value={editPaymentForm.remark}
                  onChange={(e) =>
                    setEditPaymentForm({
                      ...editPaymentForm,
                      remark: e.target.value
                    })
                  }
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                  placeholder="Payment detail..."
                />
              </div>

              <div className="flex gap-2 pt-2">

                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="flex-1 bg-slate-800 text-slate-300 py-2.5 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow-lg"
                >
                  Update Payment
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </div>
    
  );
}
// Named exports are provided for the organized frontend structure; the default app above remains unchanged.
export { ToastProvider, useToast, LoginScreen, UserManagementModal, AppContent, AdminDashboard, BillingTab, InvoiceView, StaffTab, ArticlesTab, StockInwardTab, PartiesTab, exportERPDataToExcel };
