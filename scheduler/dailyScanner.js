const cron = require('node-cron');
const { scanAllTLs } = require('../services/gmailScanner');

// 9 AM daily
cron.schedule('0 9 * * *', async () => {
  console.log('⏰ 9 AM scan triggered');
  try { await scanAllTLs(); } catch (e) { console.error(e.message); }
});

// 6 PM daily
cron.schedule('0 18 * * *', async () => {
  console.log('⏰ 6 PM scan triggered');
  try { await scanAllTLs(); } catch (e) { console.error(e.message); }
});

console.log('⏰ Daily Gmail scanner started (9 AM + 6 PM)');