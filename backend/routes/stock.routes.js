const Stock = require('../models/Stock.js');
const Article = require('../models/Article.js');
const StockMovement = require('../models/StockMovement.js');

function registerRoutes(app) {
  // --- STOCK ROUTES ---

  app.get('/api/stock', async (req, res) => {
    try {
      const stocks = await Stock.find().sort({ articleCode: 1 });
      res.json(stocks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/stock/inward', async (req, res) => {
    try {
      const {
        articleCode,
        brand,
        color,
        sizeRange,
        cartons,
        pairsPerCarton,
        loosePairs,
        mrp,
        purchaseRate,
        sellingPrice
      } = req.body;

      const normalizedArticleCode =
        String(articleCode || '').trim().toUpperCase();

      const normalizedSizeRange =
        String(sizeRange || '').trim();

      const normalizedPurchaseRate =
        Number(purchaseRate || 0);

      const normalizedSellingPrice = Number(sellingPrice || 0);
      const normalizedMrp = Number(mrp || 0);

      const c = parseInt(cartons || 0);
      const l = parseInt(loosePairs || 0);
      const ppt = parseInt(pairsPerCarton || 12);
      const totalPairs = (c * ppt) + l;

      if (!normalizedArticleCode) {
        return res.status(400).json({
          error: 'Article Code is required'
        });
      }

      // Same Code + Same Size + Same MRP = same inventory variant.
      let stockItem = await Stock.findOne({
        articleCode: normalizedArticleCode,
        sizeRange: normalizedSizeRange,
        mrp: normalizedMrp
      });

      if (stockItem) {
        stockItem.brand = brand || stockItem.brand;
        stockItem.color = color || stockItem.color;
        // Preserve current rates when the inward form sends blank values.
        stockItem.mrp = normalizedMrp;
        stockItem.purchaseRate = normalizedPurchaseRate;
        stockItem.sellingPrice = normalizedSellingPrice;

        stockItem.cartons += c;
        stockItem.loosePairs += l;
        stockItem.totalPairs += totalPairs;
        stockItem.lastUpdated = Date.now();

        await stockItem.save();
      } else {
        stockItem = new Stock({
          articleCode: normalizedArticleCode,
          brand,
          color,
          sizeRange: normalizedSizeRange,
          cartons: c,
          pairsPerCarton: ppt,
          loosePairs: l,
          totalPairs,
          mrp: normalizedMrp,
          purchaseRate: normalizedPurchaseRate,
          sellingPrice: parseFloat(sellingPrice || 0)
        });

        await stockItem.save();
      }

      await StockMovement.create({ articleCode: normalizedArticleCode, sizeRange: normalizedSizeRange, color: color || '', movementType: 'Stock Inward', quantity: totalPairs, direction: 'IN', referenceType: 'Stock Inward', remarks: 'Manual stock inward' });

      // Sync the exact Article variant. If Stock Inward is for a new custom
      // variant, create the Master Article as well.
      await Article.findOneAndUpdate(
        { articleCode: normalizedArticleCode, sizeRange: normalizedSizeRange, mrp: normalizedMrp },
        {
          $set: {
            brand: brand || '',
            color: color || '',
            mrp: normalizedMrp,
            purchaseRate: normalizedPurchaseRate,
            sellingPrice: normalizedSellingPrice,
            wholesaleRate: normalizedSellingPrice,
            pairsInPeti: ppt
          },
          $setOnInsert: {
            articleCode: normalizedArticleCode,
            sizeRange: normalizedSizeRange,
            purchaseDiscountPercent: parseFloat(mrp || 0) > 0 ? Number((((parseFloat(mrp || 0) - normalizedPurchaseRate) / parseFloat(mrp || 0)) * 100).toFixed(2)) : 0,
            sellingDiscountPercent: parseFloat(mrp || 0) > 0 ? Number((((parseFloat(mrp || 0) - normalizedSellingPrice) / parseFloat(mrp || 0)) * 100).toFixed(2)) : 0
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      res.status(200).json(stockItem);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- EDIT STOCK ---
  app.put('/api/stock/:id', async (req, res) => {
    try {
      const currentStock = await Stock.findById(req.params.id);

      if (!currentStock) {
        return res.status(404).json({
          error: 'Stock item not found'
        });
      }

      const {
        articleCode,
        brand,
        color,
        sizeRange,
        cartons,
        pairsPerCarton,
        loosePairs,
        purchaseRate,
        sellingPrice,
        mrp
      } = req.body;

      const normalizedArticleCode =
        String(
          articleCode !== undefined
            ? articleCode
            : currentStock.articleCode
        ).trim().toUpperCase();

      const normalizedSizeRange =
        String(
          sizeRange !== undefined
            ? sizeRange
            : currentStock.sizeRange
        ).trim();

      const normalizedPurchaseRate =
        Number(
          purchaseRate !== undefined
            ? purchaseRate
            : currentStock.purchaseRate || 0
        );

      const c =
        cartons !== undefined
          ? parseInt(cartons || 0)
          : currentStock.cartons;

      const l =
        loosePairs !== undefined
          ? parseInt(loosePairs || 0)
          : currentStock.loosePairs;

      const ppt =
        pairsPerCarton !== undefined
          ? parseInt(pairsPerCarton || 12)
          : currentStock.pairsPerCarton;

      const totalPairs = (c * ppt) + l;

      const normalizedMrp = Number(mrp !== undefined ? mrp : currentStock.mrp || 0);

      // Prevent duplicate inventory identity: Code + Size + MRP
      const duplicateStock = await Stock.findOne({
        _id: { $ne: req.params.id },
        articleCode: normalizedArticleCode,
        sizeRange: normalizedSizeRange,
        mrp: normalizedMrp
      });

      if (duplicateStock) {
        return res.status(400).json({
          error: 'Same Article Code, Size Range and MRP already exists.'
        });
      }

      const updated = await Stock.findByIdAndUpdate(
        req.params.id,
        {
          articleCode: normalizedArticleCode,
          brand,
          color,
          sizeRange: normalizedSizeRange,
          cartons: c,
          loosePairs: l,
          pairsPerCarton: ppt,
          totalPairs,
          purchaseRate: normalizedPurchaseRate,
          sellingPrice: parseFloat(
            sellingPrice !== undefined
              ? sellingPrice
              : currentStock.sellingPrice || 0
          ),
          mrp: normalizedMrp,
          lastUpdated: Date.now()
        },
        { new: true }
      );

      // Sync the Article variant using its old MRP identity.
      await Article.findOneAndUpdate(
        {
          articleCode: currentStock.articleCode,
          sizeRange: currentStock.sizeRange,
          mrp: Number(currentStock.mrp || 0)
        },
        {
          articleCode: normalizedArticleCode,
          brand,
          color,
          sizeRange: normalizedSizeRange,
          purchaseRate: normalizedPurchaseRate,
          sellingPrice: updated.sellingPrice,
          wholesaleRate: updated.sellingPrice,
          mrp: updated.mrp,
          pairsInPeti: ppt
        }
      );

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/stock/:id', async (req, res) => {
    try {
      await Stock.findByIdAndDelete(req.params.id);

      res.json({
        message: 'Stock deleted'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = registerRoutes;