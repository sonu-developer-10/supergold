const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { authMiddleware, accessControl } = require('./middleware/auth');
const { registerPublicAuthRoutes, registerProtectedAuthRoutes, migrateLegacyRoles, ensureDefaultUsers } = require('./routes/auth.routes');
const registerPartyRoutes = require('./routes/party.routes');
const registerArticleRoutes = require('./routes/article.routes');
const registerStockRoutes = require('./routes/stock.routes');
const registerBillRoutes = require('./routes/bill.routes');
const registerStaffRoutes = require('./routes/staff.routes');
const registerExpenseRoutes = require('./routes/expense.routes');
const { connectDatabase } = require('./config/database');
const registerPartyPaymentRoutes = require('./routes/party-payment.routes');

const app = express();
app.use(helmet());
app.use(cors({
  origin: [
    'https://supergold.onrender.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());
app.use(express.json());

// Public authentication route.
registerPublicAuthRoutes(app);

// Everything else under /api requires login.
app.use('/api', authMiddleware);
registerProtectedAuthRoutes(app);
app.use('/api', accessControl);

registerPartyRoutes(app);
registerPartyPaymentRoutes(app);
registerArticleRoutes(app);
registerStockRoutes(app);
registerBillRoutes(app);
registerStaffRoutes(app);
registerExpenseRoutes(app);

app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Route not found!" });
});
app.use((err, req, res, next) => {
  console.error("❌ Error Details:", err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ success: false, message: err.message || "Internal Server Error" });
});

connectDatabase(async () => {
  await migrateLegacyRoles();
  // Keep Article indexes aligned with the variant-aware schema. This removes the
  // old articleCode-only unique index and creates the intended compound index.
  try {
    const Article = require('./models/Article.js');
    const Bill = require('./models/Bill.js');
    await Article.syncIndexes();
    await Bill.syncIndexes();
  } catch (err) {
    console.error('Model index sync warning:', err.message);
  }
  try { await ensureDefaultUsers(); } catch (err) { console.error('Default login setup error:', err.message); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Super Gold ERP Server running on port ${PORT}`));

module.exports = app;
