const User = require('../models/User');
const nodemailer = require('nodemailer');
const { getGmailClient } = require('../config/gmail');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ============================================================
// CONSTANTS
// ============================================================

const KUDOS_KEYWORDS = [
  'kudos', 'great work', 'shout-out', 'shout out', 'shoutout',
  'appreciate', 'excellent work', 'thank you for', 'well done',
  'fantastic work', 'outstanding', 'impressed', 'amazing work',
  'keep up the good work', 'great job', 'exceeded expectations',
  'awesome work', 'brilliant', 'superb', 'exceptional work'
];

const INTERNAL_DOMAIN = '@grazitti.com';

const SYSTEM_EMAILS = [
  process.env.EMAIL_FROM,

].filter(Boolean).map(e => e.toLowerCase());

const SYSTEM_SUBJECT_PATTERNS = [
  /Kudos System/i,
  /Kudos Alerts/i,
  /Monthly Kudos/i,
  /client kudos email.* detected/i,
  /🏆 \d+ client kudos/i,
  /Part \d+ — Kudos/i
];

// ============================================================
// SCAN ONE TL — WITH FULL DEBUG LOGS
// ============================================================

async function scanTLGmail(tl) {
  if (!tl.gmailRefreshToken || !tl.gmailConnected) {
    console.log(`   ⏭️ Skipping ${tl.email} — Gmail not connected`);
    return { skipped: true };
  }

  console.log(`\n🔍 Scanning ${tl.email}...`);
  const gmail = getGmailClient(tl.gmailRefreshToken);

  const keywordQuery = KUDOS_KEYWORDS.map(k => `"${k}"`).join(' OR ');
  const query = `newer_than:7d -from:grazitti.com -in:sent (${keywordQuery})`;

  console.log(`   Query: ${query.substring(0, 100)}...`);

  let messages = [];
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    });
    messages = res.data.messages || [];
    console.log(`   Gmail returned: ${messages.length} emails matching query`);
  } catch (err) {
    console.error(`❌ Scan failed ${tl.email}:`, err.message);
    return { error: err.message };
  }

  const seenIds = new Set(tl.seenMessageIds || []);
  const newMessages = messages.filter(m => !seenIds.has(m.id));

  console.log(`   Already seen: ${messages.length - newMessages.length}`);
  console.log(`   New messages: ${newMessages.length}`);

  if (newMessages.length === 0) {
    console.log(`   No new kudos`);
    return { scanned: messages.length, newKudos: 0 };
  }

  const kudosDetails = [];
  console.log(`\n   --- Processing each email ---`);

  for (const msg of newMessages) {
    try {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date']
      });
      const headers = detail.data.payload.headers || [];
      const getHeader = (n) => headers.find(h => h.name === n)?.value || '';

      const from = getHeader('From');
      const subject = getHeader('Subject');

      const senderEmailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
      const senderEmail = (senderEmailMatch ? senderEmailMatch[1] : from).toLowerCase();

      console.log(`\n   📧 Email: "${subject}"`);
      console.log(`      From: ${senderEmail}`);
      console.log(`      Message ID: ${msg.id.substring(0, 20)}...`);

      // FILTER 1: Internal domain
      if (senderEmail.includes(INTERNAL_DOMAIN)) {
        console.log(`      ⏭️ SKIPPED — internal domain (${INTERNAL_DOMAIN})`);
        continue;
      }

      // FILTER 2: System's own email
      if (SYSTEM_EMAILS.includes(senderEmail)) {
        console.log(`      ⏭️ SKIPPED — matches SYSTEM_EMAILS list`);
        continue;
      }

      // FILTER 3: System subject patterns
      const matchedPattern = SYSTEM_SUBJECT_PATTERNS.find(p => p.test(subject));
      if (matchedPattern) {
        console.log(`      ⏭️ SKIPPED — subject matches pattern: ${matchedPattern}`);
        continue;
      }

      console.log(`      ✅ ACCEPTED as client kudos`);

      kudosDetails.push({
        messageId: msg.id,
        from: from.replace(/<[^>]+>/, '').trim().replace(/"/g, ''),
        email: senderEmail,
        subject: subject
      });
    } catch (e) {
      console.error(`      ❌ Message fetch error: ${e.message}`);
    }
  }

  console.log(`\n   --- Summary ---`);
  console.log(`   Accepted: ${kudosDetails.length}`);
  console.log(`   Skipped: ${newMessages.length - kudosDetails.length}`);

  // Save seen IDs
  const allSeen = [...new Set([...seenIds, ...kudosDetails.map(k => k.messageId)])].slice(-500);
  await User.updateOne({ _id: tl._id }, { $set: { seenMessageIds: allSeen } });

  // Send alert
  if (kudosDetails.length > 0) {
    await sendAlert(tl, kudosDetails);
  }

  return { scanned: messages.length, newKudos: kudosDetails.length };
}

// ============================================================
// SEND ALERT
// ============================================================

async function sendAlert(tl, kudosList) {
  const count = kudosList.length;
  const listHtml = kudosList.map(k => `
    <div style="background:#f9f9f9;padding:15px;border-left:4px solid #4CAF50;border-radius:6px;margin:12px 0;">
      <div style="font-weight:700;">${k.from}</div>
      <div style="color:#666;font-size:13px;">${k.email}</div>
      <div style="margin-top:8px;font-style:italic;">"${k.subject}"</div>
    </div>
  `).join('');

  const html = `
    <div style="font-family:Arial;background:#f4f4f4;padding:20px;">
      <div style="max-width:650px;margin:0 auto;background:#fff;padding:30px;border-radius:12px;">
        <h1 style="color:#4CAF50;">🏆 ${count} Client Kudos Detected!</h1>
        <p>Hi ${tl.name || 'there'},</p>
        <p>We found <b>${count} new client kudos email${count > 1 ? 's' : ''}</b> in your inbox:</p>
        ${listHtml}
        <div style="background:#fff3cd;padding:15px;border-radius:8px;margin:20px 0;border-left:4px solid #ff9800;">
          <b>⚠️ Action Required:</b> Open Gmail and extract each kudos using the 🏆 button.
        </div>
        <div style="text-align:center;margin:30px 0;">
          <a href="https://mail.google.com" style="display:inline-block;background:#4CAF50;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:700;">
            📧 Open Gmail
          </a>
        </div>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: `"Kudos Alerts" <${process.env.EMAIL_FROM}>`,
      to: tl.email,
      subject: `🏆 ${count} client kudos email${count > 1 ? 's' : ''} detected`,
      html
    });
    console.log(`\n   📧 Alert sent to ${tl.email}`);
    console.log(`   📧 Message ID: ${info.messageId}`);
    console.log(`   📧 Response: ${info.response}`);
    console.log(`   📧 Accepted: ${info.accepted}`);
    console.log(`   📧 Rejected: ${info.rejected}`);
  } catch (err) {
    console.error(`   ❌ Alert failed: ${err.message}`);
  }
}

// ============================================================
// SCAN ALL TLs
// ============================================================

async function scanAllTLs() {
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`🔍 Gmail Scan — ${new Date().toLocaleString()}`);
  console.log(`═══════════════════════════════════════════════\n`);

  const tls = await User.find({ gmailConnected: true });
  console.log(`📋 ${tls.length} connected users to scan`);

  // Show what emails are being skipped
  console.log(`\n🚫 Skipping these sender emails: ${SYSTEM_EMAILS.join(', ')}`);
  console.log(`🚫 Skipping these subject patterns: ${SYSTEM_SUBJECT_PATTERNS.length} patterns\n`);

  let total = 0;
  for (const tl of tls) {
    try {
      const r = await scanTLGmail(tl);
      total += r.newKudos || 0;
    } catch (err) {
      console.error(`❌ ${tl.email}:`, err.message);
    }
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`✅ Scan complete. ${total} new kudos found.`);
  console.log(`═══════════════════════════════════════════════\n`);

  return { tlCount: tls.length, totalKudos: total };
}

module.exports = { scanAllTLs, scanTLGmail };