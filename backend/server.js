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
const registerPurchaseRoutes = require('./routes/purchase.routes');
const registerReportRoutes = require('./routes/report.routes');
const registerPartyGrowthRoutes = require('./routes/party-growth.routes');
const { registerBusinessToolsRoutes, auditMutationMiddleware } = require('./routes/business-tools.routes');
const { startBackupScheduler } = require('./services/backupScheduler');

const app = express();
app.use(helmet());

const corsOptions = {
  origin: [
    'https://supergold.onrender.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));


// Public authentication route.
registerPublicAuthRoutes(app);

// Everything else under /api requires login.
app.use('/api', authMiddleware);
registerProtectedAuthRoutes(app);
app.use('/api', accessControl);
app.use('/api', auditMutationMiddleware);

registerPartyRoutes(app);
registerPartyPaymentRoutes(app);
registerArticleRoutes(app);
registerStockRoutes(app);
registerBillRoutes(app);
registerStaffRoutes(app);
registerExpenseRoutes(app);
registerPurchaseRoutes(app);
registerReportRoutes(app);
registerPartyGrowthRoutes(app);
registerBusinessToolsRoutes(app);

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
    const Sequence = require('./models/Sequence.js');
    const CashBookEntry = require('./models/CashBookEntry.js');
    await Sequence.createCollection().catch((err) => { if (err.codeName !== 'NamespaceExists' && err.code !== 48) throw err; });
    await Article.syncIndexes();
    await Bill.syncIndexes();
    // Legacy unique entryNo_1 indexes treat missing/null entry numbers as the same
    // value and block new Cashbook upserts. Replace with a partial unique index
    // that only applies to actual string entry numbers.
    try {
      const indexes = await CashBookEntry.collection.indexes();
      if (indexes.some(index => index.name === 'entryNo_1' && !index.partialFilterExpression)) {
        await CashBookEntry.collection.dropIndex('entryNo_1');
      }
    } catch (indexError) {
      if (indexError.codeName !== 'IndexNotFound' && indexError.code !== 27) throw indexError;
    }
    await CashBookEntry.collection.createIndex(
      { entryNo: 1 },
      { name: 'entryNo_1', unique: true, partialFilterExpression: { entryNo: { $type: 'string' } } }
    );
  } catch (err) {
    console.error('Model index sync warning:', err.message);
  }
  try { await ensureDefaultUsers(); } catch (err) { console.error('Default login setup error:', err.message); }
  startBackupScheduler();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Super Gold ERP Server running on port ${PORT}`));

module.exports = app;
