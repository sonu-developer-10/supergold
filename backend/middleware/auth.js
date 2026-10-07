const crypto = require('crypto');
const AuthUser = require('../models/AuthUser');
const AuthSession = require('../models/AuthSession');

const AUTH_SECRET = process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'supergold-local-development-secret-change-this');
const TOKEN_DAYS = 7;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
if (!AUTH_SECRET) throw new Error('AUTH_SECRET must be configured in production.');

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

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function createToken(user, rememberMe = true) {
  const expiresIn = rememberMe ? TOKEN_DAYS * 24 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
  const payload = { id: String(user._id), username: user.username, role: user.role, exp: Date.now() + expiresIn, sid: crypto.randomUUID() };
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
    if (!payload.exp || payload.exp < Date.now() || !payload.sid) return null;
    return payload;
  } catch { return null; }
}

async function createPersistentSession(token, user, rememberMe) {
  const payload = verifyToken(token);
  const expiresAt = new Date(payload.exp);
  await AuthSession.create({ tokenHash: tokenHash(token), userId: user._id, expiresAt, lastActivity: new Date() });
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ success: false, message: 'Authentication required. Please login again.' });

  try {
    const session = await AuthSession.findOne({ tokenHash: tokenHash(token), userId: payload.id }).lean();
    if (!session) return res.status(401).json({ success: false, message: 'Session expired or invalid. Please login again.' });
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      await AuthSession.deleteOne({ _id: session._id });
      return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
    }
    if (Date.now() - new Date(session.lastActivity).getTime() >= IDLE_TIMEOUT_MS) {
      await AuthSession.deleteOne({ _id: session._id });
      return res.status(401).json({ success: false, message: 'Session expired due to 30 minutes of inactivity. Please login again.' });
    }

    await AuthSession.updateOne({ _id: session._id }, { $set: { lastActivity: new Date() } });
    req.user = payload;
    req.authToken = token;
    next();
  } catch (err) {
    console.error('Auth session check error:', err.message);
    return res.status(503).json({ success: false, message: 'Authentication service temporarily unavailable.' });
  }
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
  const isPartyPayment = /^\/party-payments(?:\/|$)/.test(path);
  if (role === 'special_staff') {
    if (isBill || isArticle || isParty || isStaffData || isExpense || isPartyPayment) return next();
  }
  if (role === 'staff') {
    if (isBill && method !== 'DELETE') return next();
    if (isArticle && method === 'GET') return next();
    if (isParty && (method === 'GET' || method === 'POST')) return next();
    if (isPartyPayment && method === 'GET') return next();
  }
  return res.status(403).json({ success: false, message: 'You do not have permission for this action.' });
}

module.exports = { authMiddleware, accessControl, adminOnly, hashPassword, verifyPassword, createToken, createPersistentSession, tokenHash, AuthSession };
