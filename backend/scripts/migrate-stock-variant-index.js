// Run only against the LOCAL wholesale_erp_test database first.
// This script refuses to modify indexes if duplicate Article+Size+MRP rows exist.
const mongoose = require('mongoose');
const Stock = require('../models/Stock');
const Article = require('../models/Article');

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wholesale_erp_test';

async function migrate(Model, collectionName, newIndexName) {
  const collection = Model.collection;
  const duplicates = await collection.aggregate([
    { $group: { _id: { articleCode: '$articleCode', sizeRange: '$sizeRange', mrp: { $ifNull: ['$mrp', 0] } }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 20 }
  ]).toArray();
  if (duplicates.length) {
    console.error(`\n${collectionName}: duplicate Article+Size+MRP variants found. No index was changed.`);
    console.error(JSON.stringify(duplicates, null, 2));
    throw new Error(`Resolve duplicate ${collectionName} variants manually before migration.`);
  }

  const indexes = await collection.indexes();
  for (const index of indexes) {
    const keys = Object.keys(index.key || {});
    const isLegacy = index.unique && keys.join(',') === 'articleCode,sizeRange,sellingPrice';
    if (isLegacy) {
      await collection.dropIndex(index.name);
      console.log(`${collectionName}: dropped legacy index ${index.name}`);
    }
  }
  await collection.createIndex(
    { articleCode: 1, sizeRange: 1, mrp: 1 },
    { unique: true, name: newIndexName }
  );
  console.log(`${collectionName}: created ${newIndexName}`);
}

(async () => {
  try {
    await mongoose.connect(uri);
    await migrate(Stock, 'stocks', 'stock_variant_article_size_mrp_unique');
    await migrate(Article, 'articles', 'article_variant_article_size_mrp_unique');
    console.log('STOCK_VARIANT_INDEX_MIGRATION_OK');
  } catch (error) {
    console.error('STOCK_VARIANT_INDEX_MIGRATION_FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
