const { scanAllTLs } = require('../services/gmailScanner');

module.exports = async (req, res) => {
  try {
    console.log('⏰ Vercel Cron triggered at:', new Date().toISOString());
    const result = await scanAllTLs();
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('❌ Cron error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};