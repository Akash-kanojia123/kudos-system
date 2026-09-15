const status = document.getElementById('status');

function show(msg, ok) {
  status.textContent = msg;
  status.className = 'status ' + (ok ? 'ok' : 'err');
  setTimeout(() => { status.className = 'status'; }, 3000);
}

chrome.storage.local.get(['tlName', 'tlEmail', 'team', 'teamManager'], (d) => {
  if (d.tlName) document.getElementById('tlName').value = d.tlName;
  if (d.tlEmail) document.getElementById('tlEmail').value = d.tlEmail;
  if (d.team) document.getElementById('team').value = d.team;
  if (d.teamManager) document.getElementById('teamManager').value = d.teamManager;
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const data = {
    tlName: document.getElementById('tlName').value.trim(),
    tlEmail: document.getElementById('tlEmail').value.trim(),
    team: document.getElementById('team').value.trim(),
    teamManager: document.getElementById('teamManager').value.trim()
  };

  if (!data.tlName || !data.tlEmail) {
    show('❌ Name and email required', false);
    return;
  }

  chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) {
      show('❌ ' + chrome.runtime.lastError.message, false);
      return;
    }
    show('✅ Saved!', true);
  });
});