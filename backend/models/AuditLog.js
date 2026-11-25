const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: String, username: String, role: String, method: String, path: String,
  statusCode: Number, ip: String, summary: String, createdAt: { type: Date, default: Date.now, index: true }
});
schema.index({ createdAt: -1 });
module.exports = mongoose.model('AuditLog', schema);
