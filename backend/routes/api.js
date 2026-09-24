const express = require('express');
const router = express.Router();

const Party = require('../models/Party');
// const Article = require('../models/Article');
const Stock = require('../models/Stock');
const Bill = require('../models/Bill');

// 1. Add / Get Wholesale Parties
router.post('/parties', async (req, res) => {
  try {
    const { name, phone, city, openingBalance } = req.body;
    const party = new Party({
      name,
      phone,
      city,
      openingBalance,
      currentBalance: openingBalance || 0
    });
    await party.save();
    res.status(201).json(party);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/parties', async (req, res) => {
  try {
    const parties = await Party.find();
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add / Get Master Articles
router.post('/articles', async (req, res) => {
  try {
    const article = new Article(req.body);
    await article.save();
    res.status(201).json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/articles', async (req, res) => {
  try {
    const articles = await Article.find();
    res.json(articles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Add Stock Inward (Godown Entry)
router.post('/stock/inward', async (req, res) => {
  try {
    const { articleCode, brand, sizeRange, color, cartons, loosePairs, pairsPerPeti, purchaseRate } = req.body;
    
    // Total Pairs Calculation: (Cartons * PairsPerPeti) + LoosePairs
    const totalPairs = (parseInt(cartons || 0) * parseInt(pairsPerPeti || 12)) + parseInt(loosePairs || 0);

    const stock = new Stock({
      articleCode,
      brand,
      sizeRange,
      color,
      cartons,
      loosePairs,
      pairsPerPeti,
      totalPairs,
      purchaseRate
    });

    await stock.save();
    res.status(201).json(stock);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stock', async (req, res) => {
  try {
    const stocks = await Stock.find();
    res.json(stocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Save Wholesale Bill
router.post('/bills', async (req, res) => {
  try {
    const count = await Bill.countDocuments();
    const billNo = 1001 + count; // Auto Increment Bill Number

    const newBill = new Bill({
      ...req.body,
      billNo
    });

    await newBill.save();

    // Update Party Current Due Balance
    if (req.body.partyId) {
      await Party.findByIdAndUpdate(req.body.partyId, {
        currentBalance: req.body.dueBalance
      });
    }

    res.status(201).json(newBill);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/bills', async (req, res) => {
  try {
    const bills = await Bill.find().sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;