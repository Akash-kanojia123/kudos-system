function buildEntry(k) {
  const clientLine = k.clientName && k.clientName !== 'Client'
    ? `<b>From:</b> ${k.clientName}${k.clientEmail ? ' &lt;' + k.clientEmail + '&gt;' : ''}<br>`
    : `<b>Source:</b> Internal Recognition<br>`;

  return `
    <div style="margin-bottom:25px;padding:20px;background:#fff;border-left:4px solid #667eea;border-radius:6px;">
      <div style="font-size:13px;color:#666;margin-bottom:10px;">
        ${clientLine}
        <b>Team:</b> ${k.team}
      </div>
      <div style="font-size:14px;color:#333;line-height:1.6;margin-bottom:15px;font-style:italic;">
        "${k.message}"
      </div>
      <div style="font-size:14px;color:#333;">
        ${(k.members || []).map(m => `
          <div style="padding:8px 0;border-bottom:1px solid #eee;">
            <b>${m.name}</b>${m.role ? ' — <span style="color:#667eea;">' + m.role + '</span>' : ''}
            ${m.contribution ? '<div style="color:#555;font-size:13px;margin-top:4px;">' + m.contribution + '</div>' : ''}
          </div>
        `).join('')}
      </div>
      <div style="font-size:12px;color:#999;margin-top:10px;">
        Submitted by ${k.submittedBy}
      </div>
    </div>
  `;
}

function chunkArray(arr, maxPerChunk) {
  const total = arr.length;
  const numChunks = Math.ceil(total / maxPerChunk);
  const baseSize = Math.floor(total / numChunks);
  const remainder = total % numChunks;

  const chunks = [];
  let index = 0;

  for (let i = 0; i < numChunks; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    chunks.push(arr.slice(index, index + size));
    index += size;
  }

  return chunks;
}

function autoDraft(kudos, month) {
  const maxPerPart = parseInt(process.env.MAX_PER_PART || '10', 10);
  const chunks = chunkArray(kudos, maxPerPart);

  const parts = chunks.map((chunk, idx) => ({
    title: `Part ${idx + 1} — Kudos (${chunk.length} entries)`,
    content: chunk.length ? chunk.map(buildEntry).join('') : '<em>No entries.</em>'
  }));

  if (parts.length === 0) {
    parts.push({ title: 'Part 1', content: '<em>No kudos.</em>' });
  }

  return { parts };
}

module.exports = { autoDraft };