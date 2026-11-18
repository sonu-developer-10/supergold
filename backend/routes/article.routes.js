const Article = require('../models/Article.js');
const Stock = require('../models/Stock.js');

function registerRoutes(app) {

// --- ARTICLES ROUTES ---
app.get('/api/articles', async (req, res) => {
  try {
    const articles = await Article.find().sort({ articleCode: 1 });
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- ADD NEW ARTICLE ---
app.post('/api/articles', async (req, res) => {
  try {
    const {
      articleCode,
      brand,
      color,
      sizeRange,
      mrp,
      purchaseRate,
      wholesaleRate,
      sellingPrice,
      purchaseDiscountPercent,
      sellingDiscountPercent,
      pairsInPeti,
      cartons,
      loosePairs
    } = req.body;

    const normalizedArticleCode = String(articleCode || '').trim().toUpperCase();
    const normalizedSizeRange = String(sizeRange || '').trim();

    const effectiveRate = Number(
      sellingPrice !== undefined && sellingPrice !== ''
        ? sellingPrice
        : (wholesaleRate || 0)
    );

    if (!normalizedArticleCode) {
      return res.status(400).json({ error: 'Article Code is required' });
    }

    // DUPLICATE CHECK:
    // Same Article Code + Same Rate + Same Size Range = NOT ALLOWED
    const existingArticles = await Article.find();

    const duplicate = existingArticles.find((a) => {
      const existingCode = String(a.articleCode || '').trim().toUpperCase();
      const existingSize = String(a.sizeRange || '').trim();
      const existingRate = Number(
        a.sellingPrice !== undefined && a.sellingPrice !== ''
          ? a.sellingPrice
          : (a.wholesaleRate || 0)
      );

      return (
        existingCode === normalizedArticleCode &&
        existingSize === normalizedSizeRange &&
        existingRate === effectiveRate
      );
    });

    if (duplicate) {
      return res.status(409).json({
        error: 'Same Article Code, Rate and Size Range already exists.'
      });
    }

    const article = new Article({
      articleCode: normalizedArticleCode,
      brand,
      color,
      sizeRange: normalizedSizeRange,
      mrp: parseFloat(mrp || 0),
      purchaseRate: parseFloat(purchaseRate || 0),
      wholesaleRate: parseFloat(
        wholesaleRate || sellingPrice || 0
      ),
      sellingPrice: parseFloat(
        sellingPrice || wholesaleRate || 0
      ),
      purchaseDiscountPercent: parseFloat(purchaseDiscountPercent || 0),
      sellingDiscountPercent: parseFloat(sellingDiscountPercent || 0),
      pairsInPeti: parseInt(pairsInPeti || 12)
    });

    const savedArticle = await article.save();

    // Auto-Sync to Stock Collection
    const c = parseInt(cartons || 0);
    const l = parseInt(loosePairs || 0);
    const ppt = parseInt(pairsInPeti || 12);
    const totalPairs = (c * ppt) + l;

    let stockItem = await Stock.findOne({
      articleCode: normalizedArticleCode,
      sizeRange: normalizedSizeRange,
      purchaseRate: parseFloat(purchaseRate || 0),
      sellingPrice: parseFloat(sellingPrice || wholesaleRate || 0)
    });

    if (stockItem) {
      stockItem.brand = brand || stockItem.brand;
      stockItem.color = color || stockItem.color;
      stockItem.sizeRange = normalizedSizeRange || stockItem.sizeRange;
      stockItem.mrp = parseFloat(mrp || stockItem.mrp);
      stockItem.purchaseRate = parseFloat(
        purchaseRate || stockItem.purchaseRate
      );
      stockItem.sellingPrice = parseFloat(
        sellingPrice || wholesaleRate || stockItem.sellingPrice
      );
      stockItem.pairsPerCarton = ppt;
      stockItem.cartons += c;
      stockItem.loosePairs += l;
      stockItem.totalPairs += totalPairs;
      stockItem.lastUpdated = Date.now();

      await stockItem.save();
    } else {
      await Stock.create({
        articleCode: normalizedArticleCode,
        brand,
        color,
        sizeRange: normalizedSizeRange,
        cartons: c,
        pairsPerCarton: ppt,
        loosePairs: l,
        totalPairs,
        mrp: parseFloat(mrp || 0),
        purchaseRate: parseFloat(purchaseRate || 0),
        sellingPrice: parseFloat(
          sellingPrice || wholesaleRate || 0
        )
      });
    }

    res.status(201).json(savedArticle);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- EDIT ARTICLE ---
app.put('/api/articles/:id', async (req, res) => {
  try {
    const {
      articleCode,
      brand,
      color,
      sizeRange,
      mrp,
      purchaseRate,
      wholesaleRate,
      sellingPrice,
      purchaseDiscountPercent,
      sellingDiscountPercent,
      pairsInPeti,
      cartons,
      loosePairs
    } = req.body;

    const currentArticle = await Article.findById(req.params.id);

    if (!currentArticle) {
      return res.status(404).json({
        error: 'Article not found'
      });
    }

    const oldArticleCode = String(
      currentArticle.articleCode || ''
    ).trim().toUpperCase();

    const normalizedArticleCode = String(
      articleCode || currentArticle.articleCode || ''
    ).trim().toUpperCase();

    const normalizedSizeRange = String(
      sizeRange || currentArticle.sizeRange || ''
    ).trim();

    const effectiveRate = Number(
      sellingPrice !== undefined && sellingPrice !== ''
        ? sellingPrice
        : (wholesaleRate || 0)
    );

    // DUPLICATE CHECK WHILE EDITING
    const existingArticles = await Article.find({
      _id: { $ne: req.params.id }
    });

    const duplicate = existingArticles.find((a) => {
      const existingCode = String(
        a.articleCode || ''
      ).trim().toUpperCase();

      const existingSize = String(
        a.sizeRange || ''
      ).trim();

      const existingRate = Number(
        a.sellingPrice !== undefined && a.sellingPrice !== ''
          ? a.sellingPrice
          : (a.wholesaleRate || 0)
      );

      return (
        existingCode === normalizedArticleCode &&
        existingSize === normalizedSizeRange &&
        existingRate === effectiveRate
      );
    });

    if (duplicate) {
      return res.status(409).json({
        error: 'Same Article Code, Rate and Size Range already exists.'
      });
    }

    const updatedArticle = await Article.findByIdAndUpdate(
      req.params.id,
      {
        articleCode: normalizedArticleCode,
        brand,
        color,
        sizeRange: normalizedSizeRange,
        mrp: parseFloat(mrp || 0),
        purchaseRate: parseFloat(purchaseRate || 0),
        wholesaleRate: parseFloat(
          wholesaleRate || sellingPrice || 0
        ),
        sellingPrice: parseFloat(
          sellingPrice || wholesaleRate || 0
        ),
        purchaseDiscountPercent: parseFloat(purchaseDiscountPercent || 0),
        sellingDiscountPercent: parseFloat(sellingDiscountPercent || 0),
        pairsInPeti: parseInt(pairsInPeti || 12)
      },
      { new: true }
    );

    // Find stock using OLD article code.
    // This is important when Article Code itself is edited.
    const stockItem = await Stock.findOne({
      articleCode: oldArticleCode,
      sizeRange: String(currentArticle.sizeRange || '').trim(),
      purchaseRate: Number(currentArticle.purchaseRate || 0),
      sellingPrice: Number(currentArticle.sellingPrice || currentArticle.wholesaleRate || 0)
    });

    if (stockItem) {
      stockItem.articleCode = normalizedArticleCode;
      stockItem.brand = brand;
      stockItem.color = color;
      stockItem.sizeRange = normalizedSizeRange;
      stockItem.mrp = parseFloat(mrp || 0);
      stockItem.purchaseRate = parseFloat(purchaseRate || 0);
      stockItem.sellingPrice = parseFloat(
        sellingPrice || wholesaleRate || 0
      );

      const currentPpt = Math.max(1, Number(stockItem.pairsPerCarton || 12));
const newPpt = Math.max(1, parseInt(pairsInPeti || currentPpt));

const newCartons = cartons !== undefined
  ? parseInt(cartons || 0)
  : stockItem.cartons;

const newLoosePairs = loosePairs !== undefined
  ? parseInt(loosePairs || 0)
  : stockItem.loosePairs;

// Agar sirf Pairs In Cartons change hua hai,
// to actual physical stock same rehna chahiye.
const packagingOnlyChange =
  newPpt !== currentPpt &&
  newCartons === stockItem.cartons &&
  newLoosePairs === stockItem.loosePairs;

stockItem.pairsPerCarton = newPpt;

if (packagingOnlyChange) {
  const physicalPairs = Number(stockItem.totalPairs || 0);

  stockItem.cartons = Math.floor(physicalPairs / newPpt);
  stockItem.loosePairs = physicalPairs % newPpt;
  stockItem.totalPairs = physicalPairs;
} else {
  stockItem.cartons = newCartons;
  stockItem.loosePairs = newLoosePairs;

  stockItem.totalPairs =
    (stockItem.cartons * newPpt) +
    stockItem.loosePairs;
}

      stockItem.lastUpdated = Date.now();

      await stockItem.save();
    }

    res.json(updatedArticle);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- DELETE ARTICLE ---
app.delete('/api/articles/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (article) {
      await Stock.deleteOne({
        articleCode: article.articleCode,
        sizeRange: article.sizeRange,
        purchaseRate: Number(article.purchaseRate || 0),
        sellingPrice: Number(article.sellingPrice || article.wholesaleRate || 0)
      });

      await Article.findByIdAndDelete(req.params.id);
    }

    res.json({
      message: 'Article and synced stock deleted'
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

}

module.exports = registerRoutes;