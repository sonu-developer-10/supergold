const Article = require('../models/Article.js');
const Stock = require('../models/Stock.js');

function registerRoutes(app) {
// --- ARTICLES ROUTES (WITH AUTOMATIC STOCK SYNCHRONIZATION) ---
app.get('/api/articles', async (req, res) => {
  try {
    const articles = await Article.find().sort({ articleCode: 1 });
    res.json(articles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/articles', async (req, res) => {
  try {
    const { articleCode, brand, color, sizeRange, mrp, purchaseRate, wholesaleRate, sellingPrice, pairsInPeti, cartons, loosePairs } = req.body;
    
    const article = new Article({
      articleCode,
      brand,
      color,
      sizeRange,
      mrp: parseFloat(mrp || 0),
      purchaseRate: parseFloat(purchaseRate || 0),
      wholesaleRate: parseFloat(wholesaleRate || sellingPrice || 0),
      sellingPrice: parseFloat(sellingPrice || wholesaleRate || 0),
      pairsInPeti: parseInt(pairsInPeti || 12)
    });
    const savedArticle = await article.save();

    // Auto-Sync to Stock Collection
    const c = parseInt(cartons || 0);
    const l = parseInt(loosePairs || 0);
    const ppt = parseInt(pairsInPeti || 12);
    const totalPairs = (c * ppt) + l;

    let stockItem = await Stock.findOne({ articleCode });
    if (stockItem) {
      stockItem.brand = brand || stockItem.brand;
      stockItem.color = color || stockItem.color;
      stockItem.sizeRange = sizeRange || stockItem.sizeRange;
      stockItem.mrp = parseFloat(mrp || stockItem.mrp);
      stockItem.purchaseRate = parseFloat(purchaseRate || stockItem.purchaseRate);
      stockItem.sellingPrice = parseFloat(sellingPrice || wholesaleRate || stockItem.sellingPrice);
      stockItem.cartons += c;
      stockItem.loosePairs += l;
      stockItem.totalPairs += totalPairs;
      stockItem.lastUpdated = Date.now();
      await stockItem.save();
    } else {
      await Stock.create({
        articleCode,
        brand,
        color,
        sizeRange,
        cartons: c,
        pairsPerCarton: ppt,
        loosePairs: l,
        totalPairs,
        mrp: parseFloat(mrp || 0),
        purchaseRate: parseFloat(purchaseRate || 0),
        sellingPrice: parseFloat(sellingPrice || wholesaleRate || 0)
      });
    }

    res.status(201).json(savedArticle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/articles/:id', async (req, res) => {
  try {
    const { articleCode, brand, color, sizeRange, mrp, purchaseRate, wholesaleRate, sellingPrice, pairsInPeti, cartons, loosePairs } = req.body;
    
    const updatedArticle = await Article.findByIdAndUpdate(req.params.id, {
      brand, color, sizeRange,
      mrp: parseFloat(mrp || 0),
      purchaseRate: parseFloat(purchaseRate || 0),
      wholesaleRate: parseFloat(wholesaleRate || sellingPrice || 0),
      sellingPrice: parseFloat(sellingPrice || wholesaleRate || 0),
      pairsInPeti: parseInt(pairsInPeti || 12)
    }, { new: true });

    // Sync Update to Stock Record
    const stockItem = await Stock.findOne({ articleCode: updatedArticle.articleCode });
    if (stockItem) {
      stockItem.brand = brand;
      stockItem.color = color;
      stockItem.sizeRange = sizeRange;
      stockItem.mrp = parseFloat(mrp || 0);
      stockItem.purchaseRate = parseFloat(purchaseRate || 0);
      stockItem.sellingPrice = parseFloat(sellingPrice || wholesaleRate || 0);
      if (cartons !== undefined) stockItem.cartons = parseInt(cartons || 0);
      if (loosePairs !== undefined) stockItem.loosePairs = parseInt(loosePairs || 0);
      stockItem.totalPairs = (stockItem.cartons * stockItem.pairsPerCarton) + stockItem.loosePairs;
      stockItem.lastUpdated = Date.now();
      await stockItem.save();
    }

    res.json(updatedArticle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (article) {
      await Stock.deleteOne({ articleCode: article.articleCode });
      await Article.findByIdAndDelete(req.params.id);
    }
    res.json({ message: 'Article and synced stock deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

}

module.exports = registerRoutes;
