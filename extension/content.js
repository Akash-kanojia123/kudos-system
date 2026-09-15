 const SERVER_URL = 'https://kudos-system-production.up.railway.app';;

console.log('🏆 Kudos Extractor LOADED');

// ============================================================
// FLOATING BUTTON
// ============================================================

function addButton() {
  if (document.getElementById('kudos-btn')) return;
  if (!document.body) return;

  const btn = document.createElement('button');
  btn.id = 'kudos-btn';
  btn.textContent = '🏆 Extract Kudos';
  btn.style.cssText = 'position:fixed;bottom:90px;right:30px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;padding:14px 22px;border-radius:30px;font-size:14px;font-weight:700;cursor:pointer;z-index:2147483647;box-shadow:0 8px 25px rgba(102,126,234,0.5);font-family:Arial,sans-serif;';

  btn.addEventListener('click', extractNow);
  document.body.appendChild(btn);
  console.log('✅ Button added');
}

// ============================================================
// GET EMAIL
// ============================================================

function getEmail() {
  console.log('🔍 === SCANNING ===');

  // Sender name (may be empty)
  let senderName = '';
  const nameEl = document.querySelector('span.gD');
  if (nameEl) {
    senderName = nameEl.getAttribute('name') || nameEl.textContent.trim();
  }

  // Subject
  let subject = '';
  const subjEl = document.querySelector('h2.hP');
  if (subjEl) subject = subjEl.textContent.trim();

  // Body
  let body = '';

  const containers = document.querySelectorAll('[role="listitem"], .adn.ads');
  for (const container of containers) {
    const hasSender = container.querySelector('.gD[email]');
    const hasBody = container.querySelector('div.a3s');
    if (hasSender && hasBody) {
      const bodyEl = container.querySelector('div.a3s');
      if (bodyEl) {
        const text = (bodyEl.innerText || '').trim();
        if (text.length > body.length) body = text;
      }
    }
  }

  // Fallback
  if (body.length < 30) {
    const allBodies = document.querySelectorAll('div.a3s');
    for (const el of allBodies) {
      const text = (el.innerText || '').trim();
      if (/Print all|In new window|Search for all messages/i.test(text)) continue;
      if (text.length > body.length && text.length < 10000) body = text;
    }
  }

  console.log('📊 Found:');
  console.log('   Name:', senderName || '(empty)');
  console.log('   Subject:', subject);
  console.log('   Body length:', body.length);

  return { senderName, subject, body };
}

// ============================================================
// CLEAN BODY
// ============================================================

function clean(text) {
  let c = text;

  // Remove Gmail UI text
  const uiPatterns = [
    /Print all\s*In new window/gi,
    /Print all/gi,
    /In new window/gi,
    /Search for all messages with label.*?\n/gi,
    /Remove label.*?from this conversation/gi,
    /Summarize this email/gi,
    /Add reaction/gi,
    /Reply\s*More/gi,
    /\bReply\b/g,
    /to me\b/gi,
    /\bInbox\b/g,
    /\b[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+[AP]M\s*\([^)]+\)/gi,
    /\b\d+\s+days?\s+ago\b/gi
  ];
  uiPatterns.forEach(p => { c = c.replace(p, ''); });

  // Cut signature
  const sigCuts = [
    /\n\s*Best\s*,?\s*\n[\s\S]*/i,
    /\n\s*Best Regards[\s\S]*/i,
    /\n\s*Regards\s*,?\s*\n[\s\S]*/i,
    /\n\s*Thanks\s*,?\s*\n[\s\S]*/i,
    /\n\s*Sincerely\s*,?\s*\n[\s\S]*/i,
    /\n\s*Warm Regards[\s\S]*/i
  ];
  sigCuts.forEach(p => { c = c.replace(p, ''); });

  // Cut disclaimer
  const disclaimers = [
    /\n\s*Disclaimer:?[\s\S]*/i,
    /\nThis email and any files[\s\S]*/i,
    /\nConfidential[\s\S]*/i,
    /\nThe information contained[\s\S]*/i,
    /\nIf you are not the intended[\s\S]*/i,
    /\nPlease consider the environment[\s\S]*/i
  ];
  disclaimers.forEach(p => { c = c.replace(p, ''); });

  // Remove quoted replies
  c = c.replace(/\nOn .* wrote:[\s\S]*/i, '');
  c = c.replace(/\n-{3,}\s*Original Message\s*-{3,}[\s\S]*/i, '');

  // Signature-specific lines
  c = c.replace(/\nLinkedIn:\s*@?[\w-]+/gi, '');
  c = c.replace(/\nEmail:\s*\S+/gi, '');
  c = c.replace(/\nTel:\s*\S+/gi, '');
  c = c.replace(/\nPhone:\s*\S+/gi, '');
  c = c.replace(/\nTechnical Lead\s*\|?\s*Grazitti Interactive\s*/gi, '');
  c = c.replace(/\n[A-Z][a-z]+\s+[A-Z][a-z]+\s*\|\s*Grazitti Interactive\s*/g, '');

  // URLs
  c = c.replace(/https?:\/\/[^\s]+/g, '');
  c = c.replace(/www\.[^\s]+/g, '');

  // Whitespace
  c = c.replace(/\n{3,}/g, '\n\n');
  c = c.replace(/[ \t]+/g, ' ');
  c = c.replace(/\n /g, '\n');

  return c.trim();
}

// ============================================================
// PARSE MEMBERS (handles both formats)
// ============================================================

function parseMembers(body, senderName) {
  const out = [];
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);

  const skip = /^(hi|hello|dear|thanks|thank you|regards|best|great|keep it up|i['']d|from|to|subject|a special|team:|submitted by)/i;

  // Format 1: "Name – For contribution"
  for (const line of lines) {
    if (skip.test(line)) continue;
    if (line.length < 15) continue;
    if (/^(Sr\.|Lead|Data|Project|Team|Manager|Analyst|Engineer|Coordinator|Director|Head)/i.test(line)) continue;

    const m = line.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\s*[–\-—:]\s*(?:For\s+)?(.+)$/);
    if (m) {
      const name = m[1].trim();
      const contrib = m[2].trim().replace(/^for\s+/i, '');
      const parts = name.split(/\s+/);
      if (parts.length >= 2 && parts.length <= 4 && contrib.length >= 10) {
        if (senderName && name.toLowerCase() === senderName.toLowerCase()) continue;
        if (out.find(x => x.name.toLowerCase() === name.toLowerCase())) continue;
        out.push({ name, role: '', contribution: contrib });
      }
    }
  }

  // Format 2: "Role: Name"
  for (const line of lines) {
    const roleMatch = line.match(/^([A-Za-z][A-Za-z\s.]+):\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})$/);
    if (roleMatch) {
      const role = roleMatch[1].trim();
      const name = roleMatch[2].trim();
      if (/^(team|from|to|subject|cc|bcc)$/i.test(role)) continue;
      if (senderName && name.toLowerCase() === senderName.toLowerCase()) continue;
      if (out.find(x => x.name.toLowerCase() === name.toLowerCase())) continue;
      out.push({ name, role: role, contribution: '' });
    }
  }

  console.log(`👥 Parsed ${out.length} members`);
  return out;
}

// ============================================================
// MAIN EXTRACT
// ============================================================

function extractNow() {
  console.log('🔍 Extracting...');

  const data = getEmail();

  if (!data.body || data.body.length < 30) {
    alert('❌ Could not read email body.\n\nOpen an email first, then click Extract.');
    return;
  }

  const cleanedBody = clean(data.body);
  const members = parseMembers(cleanedBody, data.senderName);

  chrome.storage.local.get(['tlName', 'tlEmail', 'team', 'teamManager'], (userInfo) => {
    if (!userInfo.tlName || !userInfo.tlEmail) {
      alert('⚠️ Click the extension icon and save your settings first.');
      return;
    }

    const payload = {
      senderName: data.senderName || '',
      senderEmail: '',
      subject: data.subject || '',
      cleanBody: cleanedBody,
      members: members,
      tlName: userInfo.tlName,
      tlEmail: userInfo.tlEmail,
      team: userInfo.team || '',
      teamManagerEmail: userInfo.teamManager || ''
    };

    chrome.storage.local.set({ formData: payload }, () => {
      window.open(chrome.runtime.getURL('extract-form.html'), '_blank');
      console.log('✅ Form opened');
    });
  });
}

// ============================================================
// INIT
// ============================================================

function init() {
  addButton();
  const obs = new MutationObserver(() => {
    if (!document.getElementById('kudos-btn')) addButton();
  });
  if (document.body) obs.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

setInterval(() => {
  if (!document.getElementById('kudos-btn')) addButton();
}, 3000);