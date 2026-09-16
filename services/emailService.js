require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  family: 4,
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000
});

function wrapEmail(title, body) {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0;">
      <div style="max-width:700px;margin:0 auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <h1 style="color:#667eea;margin-top:0;">${title}</h1>
        ${body}
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #eee;color:#999;font-size:12px;text-align:center;">
          Kudos System
        </div>
      </div>
    </body>
    </html>`;
}

function renderParts(parts) {
  const COLORS = ['#667eea', '#4CAF50', '#ff9800', '#e91e63', '#9c27b0'];
  return parts.map((p, i) => `
    <div style="border-left:4px solid ${COLORS[i % COLORS.length]};padding:15px;margin:20px 0;background:#f9f9f9;border-radius:6px;">
      <h2 style="color:#333;margin-top:0;">${p.title}</h2>
      ${p.content}
    </div>
  `).join('');
}

// ============================================================
// TL → TM
// ============================================================
async function sendToTm(kudos) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';

  const body = `
    <p>Hi Team Manager,</p>
    <p><b>${kudos.submittedBy}</b> has submitted kudos for your review.</p>

    <div style="background:#f9f9f9;padding:20px;border-left:4px solid #667eea;margin:20px 0;border-radius:6px;">
      <div style="font-size:13px;color:#666;margin-bottom:10px;">
        <b>Client:</b> ${kudos.clientName}<br>
        <b>Team:</b> ${kudos.team}
      </div>
      <div style="font-size:14px;color:#333;line-height:1.6;margin-bottom:15px;font-style:italic;">
        "${(kudos.message || '').substring(0, 300)}${(kudos.message || '').length > 300 ? '...' : ''}"
      </div>
      <div style="font-size:14px;color:#333;">
        ${(kudos.members || []).map(m => `
          <div style="padding:6px 0;border-bottom:1px solid #eee;">
            <b>${m.name}</b>${m.role ? ' — ' + m.role : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <div style="text-align:center;margin:35px 0;">
      <a href="${baseUrl}/tm.html"
         style="display:inline-block;background:#4CAF50;color:#fff;padding:14px 32px;
                text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">
        ✅ Review in Dashboard
      </a>
    </div>

    <p style="color:#666;font-size:13px;">
      Or open: <a href="${baseUrl}/tm.html">${baseUrl}/tm.html</a><br>
      Your email: <b>${kudos.teamManagerEmail}</b>
    </p>
  `;

  await transporter.sendMail({
    from: `"Kudos System" <${process.env.EMAIL_FROM}>`,
    to: kudos.teamManagerEmail,
    replyTo: process.env.EMAIL_FROM,
    subject: `🏆 New Kudos from ${kudos.submittedBy} — Awaiting Your Review`,
    html: wrapEmail(`🏆 New Kudos for Review`, body)
  });

  console.log(`✅ Sent to TM: ${kudos.teamManagerEmail}`);
}

// ============================================================
// TM → CEO
// ============================================================
async function sendToCeo(batch, month) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';

  const body = `
    <p>Hi CEO,</p>
    <p>Kudos from <b>${batch.teamName || 'team'}</b> for <b>${month}</b> are ready for review.</p>
    ${renderParts(batch.parts)}
    <div style="text-align:center;margin:35px 0;">
      <a href="${baseUrl}/ceo.html"
         style="display:inline-block;background:#4CAF50;color:#fff;padding:14px 32px;
                text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">
        ✅ Review & Forward to Assistant
      </a>
    </div>
    <p style="color:#666;font-size:13px;">Or open: <a href="${baseUrl}/ceo.html">${baseUrl}/ceo.html</a></p>
  `;

  await transporter.sendMail({
    from: `"Kudos System" <${process.env.EMAIL_FROM}>`,
    to: process.env.CEO_EMAIL,
    replyTo: process.env.EMAIL_FROM,
    subject: `🏆 Kudos Awaiting Approval — ${batch.teamName || month}`,
    html: wrapEmail(`🏆 Kudos — ${month}`, body)
  });

  console.log('✅ Sent to CEO');
}

// ============================================================
// CEO → Assistant
// ============================================================
async function sendToAssistant(batch) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';

  const body = `
    <p>Hi Assistant,</p>
    <p>CEO has approved kudos for <b>${batch.teamName || 'team'}</b>.</p>
    ${renderParts(batch.parts)}
    <div style="text-align:center;margin:35px 0;">
      <a href="${baseUrl}/assistant.html"
         style="display:inline-block;background:#667eea;color:#fff;padding:14px 32px;
                text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">
        📤 Send to All Employees
      </a>
    </div>
  `;

  await transporter.sendMail({
    from: `"Kudos System" <${process.env.EMAIL_FROM}>`,
    to: process.env.ASSISTANT_EMAIL,
    replyTo: process.env.EMAIL_FROM,
    subject: `✅ CEO Approved — Ready to Send — ${batch.teamName || ''}`,
    html: wrapEmail(`✅ Approved Kudos`, body)
  });

  console.log('✅ Sent to Assistant');
}

// ============================================================
// Assistant → All
// ============================================================
async function sendToAll(batch) {
  const recipients = (process.env.ALL_EMPLOYEES || '')
    .split(',').map(e => e.trim()).filter(Boolean);

  const body = `
    <p>Dear Team,</p>
    <p>Here are this month's kudos:</p>
    ${renderParts(batch.parts)}
    <p>Please acknowledge in your team group.</p>
    <p>Keep up the great work! 🎉</p>
  `;

  await transporter.sendMail({
    from: `"Kudos System" <${process.env.EMAIL_FROM}>`,
    to: recipients.join(','),
    replyTo: process.env.EMAIL_FROM,
    subject: `🏆 Monthly Kudos — ${batch.teamName || ''}`,
    html: wrapEmail(`🏆 Monthly Kudos`, body)
  });

  console.log(`✅ Sent to ${recipients.length} employees`);
}

// ============================================================
// REJECTION: TM → TL
// ============================================================
async function sendRejectionToTL(kudos, tmComment) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';

  const body = `
    <p>Hi ${kudos.submittedBy},</p>
    <p>Your Team Manager reviewed your kudos and <b>sent it back for changes</b>.</p>

    <div style="background:#fff3cd;border-left:4px solid #f44336;padding:15px;margin:20px 0;border-radius:6px;">
      <b>Reason from TM:</b>
      <p style="margin:8px 0 0;font-style:italic;">"${tmComment}"</p>
    </div>

    <div style="background:#f9f9f9;padding:15px;border-radius:6px;margin:20px 0;">
      <b>Kudos Details:</b><br>
      Client: ${kudos.clientName}<br>
      Team: ${kudos.team}<br>
      Message preview: ${(kudos.message || '').substring(0, 200)}...
    </div>

    <div style="text-align:center;margin:35px 0;">
      <a href="${baseUrl}/tl.html"
         style="display:inline-block;background:#f44336;color:#fff;padding:14px 32px;
                text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">
        ✏️ Edit & Resend
      </a>
    </div>

    <p style="color:#666;font-size:13px;">
      Or open: <a href="${baseUrl}/tl.html">${baseUrl}/tl.html</a><br>
      Enter your email: <b>${kudos.submittedByEmail}</b>
    </p>
  `;

  await transporter.sendMail({
    from: `"Kudos System" <${process.env.EMAIL_FROM}>`,
    to: kudos.submittedByEmail,
    replyTo: process.env.EMAIL_FROM,
    subject: `↩️ Kudos Needs Revision — ${kudos.clientName}`,
    html: wrapEmail(`↩️ Kudos Sent Back for Revision`, body)
  });

  console.log(`✅ Rejection email sent to TL: ${kudos.submittedByEmail}`);
}

// ============================================================
// REJECTION: CEO → TM
// ============================================================
async function sendRejectionToTM(batch, ceoComment) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:4000';

  const body = `
    <p>Hi Team Manager,</p>
    <p>The CEO reviewed your kudos batch and <b>sent it back for changes</b>.</p>

    <div style="background:#fff3cd;border-left:4px solid #f44336;padding:15px;margin:20px 0;border-radius:6px;">
      <b>Reason from CEO:</b>
      <p style="margin:8px 0 0;font-style:italic;">"${ceoComment}"</p>
    </div>

    <div style="background:#f9f9f9;padding:15px;border-radius:6px;margin:20px 0;">
      <b>Batch:</b> ${batch.teamName || 'Team'} — ${batch.month}<br>
      <b>Parts:</b> ${batch.parts ? batch.parts.length : 0}<br>
      <b>Status:</b> Now back to "Approved" — ready to review and re-send
    </div>

    <div style="text-align:center;margin:35px 0;">
      <a href="${baseUrl}/tm.html"
         style="display:inline-block;background:#f44336;color:#fff;padding:14px 32px;
                text-decoration:none;border-radius:8px;font-size:16px;font-weight:bold;">
        🔄 Review & Resend
      </a>
    </div>

    <p style="color:#666;font-size:13px;">
      Or open: <a href="${baseUrl}/tm.html">${baseUrl}/tm.html</a><br>
      Enter your email: <b>${batch.teamManagerEmail}</b>
    </p>
  `;

  await transporter.sendMail({
    from: `"Kudos System" <${process.env.EMAIL_FROM}>`,
    to: batch.teamManagerEmail,
    replyTo: process.env.EMAIL_FROM,
    subject: `↩️ Batch Sent Back by CEO — ${batch.teamName}`,
    html: wrapEmail(`↩️ Batch Sent Back by CEO`, body)
  });

  console.log(`✅ Rejection email sent to TM: ${batch.teamManagerEmail}`);
}

module.exports = {
  sendToTm,
  sendToCeo,
  sendToAssistant,
  sendToAll,
  sendRejectionToTL,
  sendRejectionToTM
};