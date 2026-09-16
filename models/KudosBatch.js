const mongoose = require('mongoose');

const KudosBatchSchema = new mongoose.Schema({
  month:            { type: String, required: true },
  teamName:         { type: String },
  teamManagerEmail: { type: String },
  parts: [{
    title:   { type: String },
    content: { type: String }
  }],
  status: {
    type: String,
    enum: ['drafting', 'pending_ceo', 'approved', 'ceo_rejected_dismissed', 'sent','ceo_rejected'],
    default: 'drafting'
  },
  sentToCeoAt:     { type: Date },
  approvedByCeoAt: { type: Date },
  sentToAllAt:     { type: Date },
  ceoComment:      { type: String, default: '' },
  createdAt:       { type: Date, default: Date.now }
},{timestamps:true});

module.exports = mongoose.model('KudosBatch', KudosBatchSchema);
