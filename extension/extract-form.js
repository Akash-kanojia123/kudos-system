// ============================================================
// EXTRACT FORM
// ============================================================

const SERVER_URL = 'http://localhost:4000';
let pendingData = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addMemberBtn').addEventListener('click', () => addMemberRow());
  document.getElementById('cancelBtn').addEventListener('click', () => window.close());
  document.getElementById('sendTmBtn').addEventListener('click', sendToTM);

  chrome.storage.local.get(['formData'], (result) => {
    if (!result.formData) {
      alert('No data found. Please extract from Gmail first.');
      window.close();
      return;
    }
    pendingData = result.formData;
    fillForm();
  });
});

function fillForm() {
  document.getElementById('senderName').value = pendingData.senderName || '';
  document.getElementById('senderEmail').value = pendingData.senderEmail || '';
  document.getElementById('subject').value = pendingData.subject || '';
  document.getElementById('team').value = pendingData.team || '';
  document.getElementById('teamManagerEmail').value = pendingData.teamManagerEmail || '';
  document.getElementById('message').value = pendingData.cleanBody || '';

  const container = document.getElementById('members');
  container.innerHTML = '';

  if (pendingData.members && pendingData.members.length > 0) {
    pendingData.members.forEach(m => addMemberRow(m.name, m.role, m.contribution));
  } else {
    addMemberRow();
  }
}

function addMemberRow(name = '', role = '', contribution = '') {
  const container = document.getElementById('members');
  const div = document.createElement('div');
  div.className = 'member';
  div.innerHTML = `
    <div class="member-header">
      <span class="member-num">${container.children.length + 1}</span>
      <span class="member-label">Team Member</span>
      <button type="button" class="remove">✕</button>
    </div>
    <input placeholder="Full Name" class="m-name" value="${esc(name)}">
    <input placeholder="Role (optional)" class="m-role" value="${esc(role)}">
    <textarea placeholder="Contribution (optional)" class="m-contribution">${esc(contribution)}</textarea>
  `;
  div.querySelector('.remove').addEventListener('click', () => {
    if (container.children.length === 1) {
      alert('At least one member required.');
      return;
    }
    div.remove();
    renumber();
  });
  container.appendChild(div);
}

function renumber() {
  document.querySelectorAll('#members .member').forEach((m, i) => {
    const el = m.querySelector('.member-num');
    if (el) el.textContent = i + 1;
  });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendToTM() {
  const senderName = document.getElementById('senderName').value.trim();
  const senderEmail = document.getElementById('senderEmail').value.trim();
  const subject = document.getElementById('subject').value.trim();
  const team = document.getElementById('team').value.trim();
  const teamManagerEmail = document.getElementById('teamManagerEmail').value.trim();
  const message = document.getElementById('message').value.trim();

  // Validation
  if (!message) return showMsg('❌ Message required', false);
  if (!team) return showMsg('❌ Team required', false);
  if (!teamManagerEmail) return showMsg('❌ TM email required', false);

  // Client name optional — use fallback
  const finalSenderName = senderName || 'Client';

  const members = [];
  document.querySelectorAll('#members .member').forEach(m => {
    const n = m.querySelector('.m-name').value.trim();
    const r = m.querySelector('.m-role').value.trim();
    const c = m.querySelector('.m-contribution').value.trim();
    if (n) members.push({ name: n, role: r, contribution: c });
  });

  if (members.length === 0) return showMsg('❌ Add at least one member', false);

  showMsg('⏳ Saving...', true);

  try {
    const saveRes = await fetch(`${SERVER_URL}/api/tl/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: finalSenderName,
        clientEmail: senderEmail,
        subject: subject,
        rawBody: pendingData.cleanBody || message,
        message: message,
        submittedBy: pendingData.tlName,
        submittedByEmail: pendingData.tlEmail,
        team: team,
        teamManagerEmail: teamManagerEmail,
        members: members
      })
    });

    const saveData = await saveRes.json();
    if (!saveData.success) return showMsg('❌ ' + saveData.error, false);

    showMsg('📤 Sending to TM...', true);

    const sendRes = await fetch(`${SERVER_URL}/api/tl/send-to-tm/${saveData.kudos._id}`, { method: 'POST' });
    const sendData = await sendRes.json();

    if (sendData.success) {
      showMsg('✅ Sent to TM! Closing...', true);
      chrome.storage.local.remove('formData');
      setTimeout(() => window.close(), 2000);
    } else {
      showMsg('❌ ' + sendData.error, false);
    }
  } catch (err) {
    showMsg('❌ Server not running. Start: npm start', false);
  }
}

function showMsg(text, ok) {
  const m = document.getElementById('msg');
  m.textContent = text;
  m.className = 'msg ' + (ok ? 'ok' : 'err');
}