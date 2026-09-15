const express = require('express');
const router = express.Router();
const KudosBatch = require('../models/KudosBatch');
const Kudos = require('../models/Kudos');
const { sendToAssistant, sendRejectionToTM } = require('../services/emailService');

// ============================================================
// CEO: LIST PENDING batches
// ============================================================
router.get('/pending', async (req, res) => {
  try {
    const batches = await KudosBatch.find({ status: 'pending_ceo' }).sort({ sentToCeoAt: -1 });
    res.json({ count: batches.length, batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CEO: APPROVE → forwards to Assistant
// ============================================================
router.post('/approve/:id', async (req, res) => {
  try {
    const batch = await KudosBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Not found' });

    batch.status = 'approved';
    batch.ceoComment = req.body.comment || '';
    batch.approvedByCeoAt = new Date();
    await batch.save();

    await Kudos.updateMany(
      { batchId: batch._id },
      { $set: { status: 'ceo_approved', ceoReviewedAt: new Date() } }
    );

    // Send email to Assistant
    try {
      await sendToAssistant(batch);
    } catch (e) {
      console.log('⚠️ Email to Assistant failed:', e.message);
    }

    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CEO: REJECT → sends email to TM, batch goes back to tm_approved
// ============================================================
router.post('/reject/:id', async (req, res) => {
  try {
    const batch = await KudosBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Not found' });

    const comment = req.body.comment || 'Rejected by CEO - please review';

    batch.status = 'ceo_rejected';
    batch.ceoComment = comment;
    await batch.save();

    // Move all kudos back to tm_approved (keep batchId so TM can trace back)
    await Kudos.updateMany(
      { batchId: batch._id },
      { $set: { status: 'tm_approved' } }
    );

    // Send rejection email to TM
    try {
      await sendRejectionToTM(batch, comment);
    } catch (e) {
      console.log('⚠️ Rejection email failed:', e.message);
    }

    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;