const mongoose = require('mongoose');

const KudosSchema = new mongoose.Schema({
  clientName:    { type: String, required: true },
  clientEmail:   { type: String, default: '' },
  subject:       { type: String, default: '' },
  rawBody:       { type: String, required: true },
  message:       { type: String, default: '' },

  team:             { type: String, required: true },
  teamManagerEmail: { type: String, default: '' },
  members: [{
    name:         { type: String, required: true },
    role:         { type: String, default: '' },
    contribution: { type: String, default: '' }
  }],

  submittedBy:      { type: String, required: true },
  submittedByEmail: { type: String, required: true },

  status: {
    type: String,
    enum: [
      'tl_review', 'tm_pending', 'tm_approved', 'tm_rejected',
      'ceo_pending', 'ceo_approved', 'ceo_rejected', 'sent'
    ],
    default: 'tl_review'
  },

  submittedAt:    { type: Date, default: Date.now },
  tmReviewedAt:   { type: Date },
  tmComment:      { type: String, default: '' },
  ceoReviewedAt:  { type: Date },
  ceoComment:     { type: String, default: '' },

  month:   { type: String, required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'KudosBatch' }
},{timestamps:true});

module.exports = mongoose.model('Kudos', KudosSchema);