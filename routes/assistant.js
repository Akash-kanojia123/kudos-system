const express = require('express');
const router = express.Router();
const KudosBatch = require('../models/KudosBatch');
const Kudos = require('../models/Kudos');
const { sendToAll } = require('../services/emailService');

router.get('/approved', async (req, res) => {
  const batches = await KudosBatch.find({ status: 'approved' }).sort({ approvedByCeoAt: -1 });
  res.json({ count: batches.length, batches });
});

router.post('/send-to-all/:id', async (req, res) => {
  try {
    const batch = await KudosBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Not found' });

    await sendToAll(batch);

    batch.status = 'sent';
    batch.sentToAllAt = new Date();
    await batch.save();

    await Kudos.updateMany(
      { batchId: batch._id },
      { $set: { status: 'sent' } }
    );

    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;