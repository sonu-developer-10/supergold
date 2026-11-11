const AuthUser = require('../models/AuthUser');
const { authMiddleware, adminOnly, hashPassword, verifyPassword, createToken, createPersistentSession, tokenHash, AuthSession } = require('../middleware/auth');
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

async function ensureDefaultUser(username, password, role) {
  if (!username || !password) return;
  const normalized = String(username).trim().toLowerCase();
  const existing = await AuthUser.findOne({ username: normalized });
  if (!existing) {
    await new AuthUser({ username: normalized, passwordHash: hashPassword(password), role, active: true }).save();
    console.log(`Default ${role} login created: ${normalized}`);
  }
}
async function migrateLegacyRoles() {
  try { await AuthUser.updateMany({ role: 'manager' }, { $set: { role: 'special_staff' } }); }
  catch (err) { console.error('Legacy role migration error:', err.message); }
}
async function ensureDefaultUsers() {
  const isProduction = process.env.NODE_ENV === 'production';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'admin123');
  if (!adminPassword) throw new Error('ADMIN_PASSWORD must be configured in production.');
  await ensureDefaultUser(adminUsername, adminPassword, 'admin');
  await ensureDefaultUser(process.env.MANAGER_USERNAME || '', process.env.MANAGER_PASSWORD || '', 'special_staff');
  await ensureDefaultUser(process.env.STAFF_USERNAME || '', process.env.STAFF_PASSWORD || '', 'staff');
}

function registerPublicAuthRoutes(app) {
// Public login route
app.post('/api/auth/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required.' });
    const user = await AuthUser.findOne({ username, active: true });
    if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    const token = createToken(user, req.body.rememberMe !== false);
    await createPersistentSession(token, user, req.body.rememberMe !== false);
    res.json({ success: true, token, user: { id: String(user._id), username: user.username, role: user.role } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  if (req.authToken) await AuthSession.deleteOne({ tokenHash: tokenHash(req.authToken) });
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await AuthUser.findById(req.user.id).select('_id username role active');
    if (!user || !user.active) return res.status(401).json({ success: false, message: 'Account is inactive.' });
    res.json({ success: true, user: { id: String(user._id), username: user.username, role: user.role } });
  } catch (err) { res.status(401).json({ success: false, message: 'Invalid session.' }); }
});

}

function registerProtectedAuthRoutes(app) {
// Admin can create/manage multiple login accounts.
app.get('/api/auth/users', adminOnly, async (req, res) => {
  try {
    const users = await AuthUser.find().select('_id username role active createdAt').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.post('/api/auth/users', adminOnly, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = ['admin', 'special_staff', 'staff'].includes(req.body.role) ? req.body.role : 'staff';
    if (!username || !/^[a-z0-9._-]{3,40}$/.test(username) || password.length < 6) return res.status(400).json({ success: false, message: 'Username 3-40 characters ka ho sakta hai: letters, numbers, dot, dash, underscore. Password minimum 6 characters.' });
    if (await AuthUser.exists({ username })) return res.status(409).json({ success: false, message: 'Username already exists.' });
    const user = await new AuthUser({ username, passwordHash: hashPassword(password), role, active: true }).save();
    res.status(201).json({ success: true, user: { id: String(user._id), username: user.username, role: user.role, active: user.active } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.put('/api/auth/users/:id', adminOnly, async (req, res) => {
  try {
    const updates = {};
    if (req.body.role && ['admin', 'special_staff', 'staff'].includes(req.body.role)) updates.role = req.body.role;
    if (typeof req.body.active === 'boolean') updates.active = req.body.active;
    if (req.body.password) {
      if (String(req.body.password).length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      updates.passwordHash = hashPassword(req.body.password);
    }
    const user = await AuthUser.findByIdAndUpdate(req.params.id, updates, { new: true }).select('_id username role active createdAt');
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/auth/users/:id', adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) return res.status(400).json({ success: false, message: 'You cannot delete the account currently in use.' });
    const deleted = await AuthUser.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Account not found.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

}

module.exports = { registerPublicAuthRoutes, registerProtectedAuthRoutes, migrateLegacyRoles, ensureDefaultUsers };
