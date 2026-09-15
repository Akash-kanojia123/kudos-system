const express = require('express');
const router = express.Router();
const Kudos = require('../models/Kudos');
const KudosBatch = require('../models/KudosBatch');
const { sendToCeo, sendRejectionToTL } = require('../services/emailService');
const { autoDraft } = require('../services/autoDraft');

// ============================================================
// PENDING LIST for TM
router.get('/pending/:email', async (req, res) => {
  try {
    const pending = await Kudos.find({
      status: 'tm_pending',
      teamManagerEmail: req.params.email
    }).sort({ submittedAt: -1 });

    const approved = await Kudos.find({
      status: 'tm_approved',
      teamManagerEmail: req.params.email
    }).sort({ submittedAt: -1 });

    const rejected = await Kudos.find({
      status: 'tm_rejected',
      teamManagerEmail: req.params.email
    }).sort({ tmReviewedAt: -1 });

    // NEW: Get batches sent back by CEO
    const ceoRejectedBatches = await KudosBatch.find({
      status: 'ceo_rejected',
      teamManagerEmail: req.params.email
    }).sort({ createdAt: -1 });

    res.json({ pending, approved, rejected, ceoRejectedBatches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// TM UPDATE a kudos
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { message, members, comment } = req.body;
    const kudos = await Kudos.findById(req.params.id);
    if (!kudos) return res.status(404).json({ error: 'Not found' });

    if (message) kudos.message = message;
    if (members) kudos.members = members;
    if (comment !== undefined) kudos.tmComment = comment;
    await kudos.save();

    res.json({ success: true, kudos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// TM APPROVE a kudos
// ============================================================
router.post('/approve/:id', async (req, res) => {
  try {
    const kudos = await Kudos.findById(req.params.id);
    if (!kudos) return res.status(404).json({ error: 'Not found' });

    kudos.status = 'tm_approved';
    kudos.tmReviewedAt = new Date();
    kudos.tmComment = ''; // Clear any previous rejection reason
    await kudos.save();

    res.json({ success: true, kudos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// TM REJECT a kudos → sends email to TL
// ============================================================
router.post('/reject/:id', async (req, res) => {
  try {
    const kudos = await Kudos.findById(req.params.id);
    if (!kudos) return res.status(404).json({ error: 'Not found' });

    const comment = req.body.comment || 'Rejected by TM - please revise';

    kudos.status = 'tm_rejected';
    kudos.tmComment = comment;
    kudos.tmReviewedAt = new Date();
    await kudos.save();

    // Send rejection email to TL
    try {
      await sendRejectionToTL(kudos, comment);
    } catch (e) {
      console.log('⚠️ Rejection email failed:', e.message);
    }

    res.json({ success: true, kudos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// TM SEND ALL APPROVED to CEO
// ============================================================
router.post('/send-to-ceo/:email', async (req, res) => {
  try {
    const kudos = await Kudos.find({
      status: 'tm_approved',
      teamManagerEmail: req.params.email
    });

    if (kudos.length === 0) {
      return res.status(400).json({ error: 'No approved kudos' });
    }

    const month = kudos[0].month;
    const teamName = kudos[0].team;

    await Kudos.updateMany(
      { _id: { $in: kudos.map(k => k._id) } },
      { $set: { status: 'ceo_pending' } }
    );

    const draft = autoDraft(kudos, month);

    let batch = await KudosBatch.findOne({
      month,
      teamManagerEmail: req.params.email
    });

    if (!batch) {
      batch = await KudosBatch.create({
        month,
        teamName,
        teamManagerEmail: req.params.email
      });
    }

    batch.parts = draft.parts;
    batch.teamName = teamName;
    batch.status = 'pending_ceo';
    batch.sentToCeoAt = new Date();
    await batch.save();

    await Kudos.updateMany(
      { _id: { $in: kudos.map(k => k._id) } },
      { $set: { batchId: batch._id } }
    );

    await sendToCeo(batch, month);

    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============================================================
// TM: RESEND a CEO-rejected batch to CEO
// ============================================================
router.post('/resend-to-ceo/:batchId', async (req, res) => {
  try {
    const batch = await KudosBatch.findById(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    if (batch.status !== 'ceo_rejected') {
      return res.status(400).json({ error: 'Only CEO-rejected batches can be re-sent' });
    }

    // Update batch status back to pending_ceo
    batch.status = 'pending_ceo';
    batch.sentToCeoAt = new Date();
    batch.ceoComment = ''; // Clear old rejection comment
    await batch.save();

    // Update all kudos in this batch → ceo_pending again
    await Kudos.updateMany(
      { batchId: batch._id },
      { $set: { status: 'ceo_pending' } }
    );

    // Send email to CEO again
    const { sendToCeo } = require('../services/emailService');
    await sendToCeo(batch, batch.month);

    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============================================================
// TM: SEND BATCH BACK TO TLs for editing
// ============================================================
router.post('/send-back-to-tls/:batchId', async (req, res) => {
  try {
    const batch = await KudosBatch.findById(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    if (batch.status !== 'ceo_rejected') {
      return res.status(400).json({ 
        error: `This batch is "${batch.status}", not "ceo_rejected". Only CEO-rejected batches can be sent back.` 
      });
    }

    // Find kudos by batchId
    let kudos = await Kudos.find({ batchId: batch._id });

    // Fallback: if batchId was cleared, find by team + month + status
    if (kudos.length === 0) {
      console.log('⚠️ No kudos by batchId. Trying fallback by team + month...');
      kudos = await Kudos.find({
        team: batch.teamName,
        teamManagerEmail: batch.teamManagerEmail,
        month: batch.month,
        status: 'tm_approved'
      });
    }

    if (kudos.length === 0) {
      return res.status(400).json({ 
        error: 'No kudos found in this batch. The kudos may have already been edited or re-sent.' 
      });
    }

    const { sendRejectionToTL } = require('../services/emailService');

    for (const k of kudos) {
      k.status = 'tm_rejected';
      k.tmComment = `CEO requested changes: ${batch.ceoComment || 'Please review'}`;
      k.tmReviewedAt = new Date();
      await k.save();

      try {
        await sendRejectionToTL(k, k.tmComment);
      } catch (e) {
        console.log(`⚠️ Email failed for ${k.submittedByEmail}:`, e.message);
      }
    }

    // Mark batch as dismissed
    batch.status = 'ceo_rejected_dismissed';
    await batch.save();

    // Clear batchId from kudos so they detach from the old batch
    await Kudos.updateMany(
      { _id: { $in: kudos.map(k => k._id) } },
      { $set: { batchId: null } }
    );

    res.json({ success: true, count: kudos.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;