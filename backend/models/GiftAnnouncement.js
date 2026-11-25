const mongoose = require('mongoose');
const giftAnnouncementSchema = new mongoose.Schema({
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', required: true, index: true },
  partyName: { type: String, default: '' },
  title: { type: String, required: true, trim: true },
  message: { type: String, default: '' },
  gift: { type: String, default: '' },
  announcedAt: { type: Date, default: Date.now },
  createdBy: { type: String, default: '' }
}, { timestamps: true });
module.exports = mongoose.models.GiftAnnouncement || mongoose.model('GiftAnnouncement', giftAnnouncementSchema);
