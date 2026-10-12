const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wholesale_erp';

async function connectDatabase(onConnected) {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected Successfully');
    if (onConnected) await onConnected();
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }
}
module.exports = { connectDatabase, MONGO_URI };
