const express = require('express');
const router = express.Router();
const { getAuthUrl, getTokensFromCode } = require('../config/gmail');
const User = require('../models/User');

router.get('/gmail/start', (req, res) => {
  const tlEmail = req.query.email;
  if (!tlEmail) {
    return res.status(400).send('Missing email. Use: /api/auth/gmail/start?email=your@email.com');
  }
  const url = getAuthUrl(tlEmail);
  res.redirect(url);
});

router.get('/gmail/callback', async (req, res) => {
  const { code, state } = req.query;
  const tlEmail = state;

  if (!code || !tlEmail) {
    return res.send('<h1>❌ Authorization Failed</h1><p>Missing code or email.</p>');
  }

  try {
    const tokens = await getTokensFromCode(code);

    if (!tokens.refresh_token) {
      return res.send(`
        <h1>❌ No refresh token</h1>
        <p>Revoke app at <a href="https://myaccount.google.com/permissions">Google Permissions</a> and retry.</p>
      `);
    }

    await User.findOneAndUpdate(
      { email: tlEmail },
      {
        $set: {
          gmailRefreshToken: tokens.refresh_token,
          gmailConnected: true
        }
      },
      { upsert: true, new: true }
    );

    console.log(`✅ Gmail connected: ${tlEmail}`);

    res.send(`
      <!DOCTYPE html><html><body style="font-family:Arial;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
        <div style="background:#fff;padding:40px;border-radius:16px;max-width:500px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.2);">
          <h1 style="color:#4CAF50;">✅ Gmail Connected!</h1>
          <p>We'll now monitor your inbox for client kudos emails.</p>
          <p style="color:#999;font-size:12px;">Email: ${tlEmail}</p>
          <p style="color:#999;font-size:12px;">You can close this tab.</p>
        </div>
      </body></html>
    `);
  } catch (err) {
    console.error('OAuth error:', err);
    res.send(`<h1>❌ Failed</h1><p>${err.message}</p>`);
  }
});

router.get('/gmail/status', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const user = await User.findOne({ email });
  res.json({ connected: user ? user.gmailConnected : false });
});

router.post('/gmail/disconnect', async (req, res) => {
  const { email } = req.body;
  await User.updateOne({ email }, { $set: { gmailConnected: false, gmailRefreshToken: '' } });
  res.json({ success: true });
});

module.exports = router;