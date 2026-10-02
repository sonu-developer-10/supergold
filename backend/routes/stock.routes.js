const Stock = require('../models/Stock.js');
const Article = require('../models/Article.js');

function registerRoutes(app) {
// --- STOCK ROUTES ---
app.get('/api/stock', async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ articleCode: 1 });
    res.json(stocks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/stock/inward', async (req, res) => {
  try {
    const { articleCode, brand, color, sizeRange, cartons, pairsPerCarton, loosePairs, mrp, purchaseRate, sellingPrice } = req.body;
    const c = parseInt(cartons || 0);
    const l = parseInt(loosePairs || 0);
    const ppt = parseInt(pairsPerCarton || 12);
    const totalPairs = (c * ppt) + l;

    let stockItem = await Stock.findOne({ articleCode });
    if (stockItem) {
      stockItem.brand = brand || stockItem.brand;
      stockItem.color = color || stockItem.color;
      stockItem.sizeRange = sizeRange || stockItem.sizeRange;
      stockItem.cartons += c;
      stockItem.loosePairs += l;
      stockItem.totalPairs += totalPairs;
      stockItem.mrp = parseFloat(mrp || stockItem.mrp);
      stockItem.purchaseRate = parseFloat(purchaseRate || stockItem.purchaseRate);
      stockItem.sellingPrice = parseFloat(sellingPrice || stockItem.sellingPrice);
      stockItem.lastUpdated = Date.now();
      await stockItem.save();
    } else {
      stockItem = new Stock({
        articleCode, brand, color, sizeRange,
        cartons: c,
        pairsPerCarton: ppt,
        loosePairs: l,
        totalPairs,
        mrp: parseFloat(mrp || 0),
        purchaseRate: parseFloat(purchaseRate || 0),
        sellingPrice: parseFloat(sellingPrice || 0)
      });
      await stockItem.save();
    }

    // Sync purchaseRate / sellingPrice back to Article
    await Article.findOneAndUpdate({ articleCode }, {
      brand: brand || undefined,
      color: color || undefined,
      sizeRange: sizeRange || undefined,
      mrp: parseFloat(mrp || 0),
      purchaseRate: parseFloat(purchaseRate || 0),
      sellingPrice: parseFloat(sellingPrice || 0),
      wholesaleRate: parseFloat(sellingPrice || 0)
    });

    res.status(200).json(stockItem);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/stock/:id', async (req, res) => {
  try {
    const { cartons, pairsPerCarton, loosePairs, purchaseRate, sellingPrice, mrp } = req.body;
    
    const currentStock = await Stock.findById(req.params.id);
    if (!currentStock) return res.status(404).json({ error: 'Stock item not found' });

    const c = cartons !== undefined ? parseInt(cartons) : currentStock.cartons;
    const l = loosePairs !== undefined ? parseInt(loosePairs) : currentStock.loosePairs;
    const ppt = pairsPerCarton !== undefined ? parseInt(pairsPerCarton) : currentStock.pairsPerCarton;
    const totalPairs = (c * ppt) + l;

    const updated = await Stock.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, cartons: c, loosePairs: l, pairsPerCarton: ppt, totalPairs, lastUpdated: Date.now() }, 
      { new: true }
    );

    // Sync updated price back to Article
    if (updated && updated.articleCode) {
      await Article.findOneAndUpdate({ articleCode: updated.articleCode }, {
        purchaseRate: updated.purchaseRate,
        sellingPrice: updated.sellingPrice,
        wholesaleRate: updated.sellingPrice,
        mrp: updated.mrp
      });
    }

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/stock/:id', async (req, res) => {
  try {
    await Stock.findByIdAndDelete(req.params.id);
    res.json({ message: 'Stock deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

}

module.exports = registerRoutes;
