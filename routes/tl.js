const express = require('express');
const router = express.Router();
const Kudos = require('../models/Kudos');

router.post('/extract', async (req, res) => {
  try {
    const {
      clientName, clientEmail, subject, rawBody,
      submittedBy, submittedByEmail, team, teamManagerEmail,
      members: incomingMembers
    } = req.body;

    if (!clientName || !rawBody || !submittedBy || !submittedByEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const month = new Date().toISOString().slice(0, 7);

    const members = Array.isArray(incomingMembers) ? incomingMembers.map(m => ({
      name: m.name || '',
      role: m.role || '',
      contribution: m.contribution || ''
    })).filter(m => m.name) : [];

    const kudos = await Kudos.create({
      clientName,
      clientEmail: clientEmail || '',
      subject: subject || '',
      rawBody,
      message: rawBody,
      submittedBy,
      submittedByEmail,
      team: team || 'Unknown',
      teamManagerEmail: teamManagerEmail || '',
      members,
      month,
      status: 'tl_review'
    });

    res.json({ success: true, kudos, membersParsed: members.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my/:email', async (req, res) => {
  const kudos = await Kudos.find({
    submittedByEmail: req.params.email
  }).sort({ submittedAt: -1 });
  res.json({ count: kudos.length, kudos });
});

router.put('/:id', async (req, res) => {
  const { message, members, team } = req.body;

  const kudos = await Kudos.findById(req.params.id);
  if (!kudos) return res.status(404).json({ error: 'Not found' });

  if (message) kudos.message = message;
  if (members) kudos.members = members;
  if (team) kudos.team = team;
  await kudos.save();

  res.json({ success: true, kudos });
});

const { sendToTm } = require('../services/emailService');

router.post('/send-to-tm/:id', async (req, res) => {
  try {
    const kudos = await Kudos.findById(req.params.id);
    if (!kudos) return res.status(404).json({ error: 'Not found' });

    if (!kudos.members || kudos.members.length === 0) {
      return res.status(400).json({ error: 'Add at least one team member first' });
    }

    kudos.status = 'tm_pending';
    await kudos.save();

    // Send email to TM
    if (kudos.teamManagerEmail) {
      try {
        await sendToTm(kudos);
      } catch (e) {
        console.log('⚠️ Email failed but status updated:', e.message);
      }
    }

    res.json({ success: true, kudos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update existing kudos (for draft editing)
router.put('/:id', async (req, res) => {
  try {
    const { message, members, team, clientName, clientEmail, subject, teamManagerEmail } = req.body;

    const kudos = await Kudos.findById(req.params.id);
    if (!kudos) return res.status(404).json({ error: 'Not found' });

    if (message) kudos.message = message;
    if (members) kudos.members = members;
    if (team) kudos.team = team;
    if (clientName) kudos.clientName = clientName;
    if (clientEmail) kudos.clientEmail = clientEmail;
    if (subject) kudos.subject = subject;
    if (teamManagerEmail) kudos.teamManagerEmail = teamManagerEmail;

    await kudos.save();
    res.json({ success: true, kudos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;