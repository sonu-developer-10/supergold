const crypto = require('crypto');
const AuthUser = require('../models/AuthUser');

const AUTH_SECRET = process.env.AUTH_SECRET || 'supergold-change-this-secret-in-production';
const TOKEN_DAYS = 7;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const activeSessions = new Map();
const SESSION_VERSION = crypto.randomBytes(32).toString('hex');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  try {
    const [salt, stored] = String(storedHash).split(':');
    if (!salt || !stored) return false;
    const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(derived, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createToken(user, rememberMe = true) {
  const expiresIn = rememberMe ? TOKEN_DAYS * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const payload = { id: String(user._id), username: user.username, role: user.role, exp: Date.now() + expiresIn, sv: SESSION_VERSION };
  const encoded = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(encoded).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.sv !== SESSION_VERSION) return null;
    return payload;
  } catch { return null; }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload) {
    if (token) activeSessions.delete(token);
    return res.status(401).json({ success: false, message: 'Authentication required. Please login again.' });
  }
  const lastActivity = activeSessions.get(token);
  if (!lastActivity || (Date.now() - lastActivity) >= IDLE_TIMEOUT_MS) {
    activeSessions.delete(token);
    return res.status(401).json({ success: false, message: 'Session expired due to 30 minutes of inactivity. Please login again.' });
  }
  activeSessions.set(token, Date.now());
  req.user = payload;
  req.authToken = token;
  next();
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required.' });
  next();
}

function accessControl(req, res, next) {
  const role = req.user?.role;
  if (role === 'admin') return next();
  const path = req.path;
  const method = req.method;
  const isBill = /^\/bills(?:\/|$)/.test(path);
  const isParty = /^\/parties(?:\/|$)/.test(path);
  const isArticle = /^\/articles(?:\/|$)/.test(path);
  const isStaffData = /^\/staff(?:-|\/)/.test(path) || path === '/staff';
  const isExpense = /^\/expenses(?:\/|$)/.test(path);
  if (role === 'special_staff') {
    if (isBill || isArticle || isParty || isStaffData || isExpense) return next();
  }
  if (role === 'staff') {
    if (isBill && method !== 'DELETE') return next();
    if (isArticle && method === 'GET') return next();
    if (isParty && (method === 'GET' || method === 'POST')) return next();
  }
  return res.status(403).json({ success: false, message: 'This action is not available for this account.' });
}

setInterval(() => {
  const now = Date.now();
  for (const [token, lastActivity] of activeSessions.entries()) {
    if (now - lastActivity >= IDLE_TIMEOUT_MS) activeSessions.delete(token);
  }
}, 5 * 60 * 1000);

module.exports = { authMiddleware, adminOnly, accessControl, hashPassword, verifyPassword, createToken, activeSessions, IDLE_TIMEOUT_MS };
