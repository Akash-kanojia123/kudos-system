require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/tl', require('./routes/tl'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/ceo', require('./routes/ceo'));
app.use('/api/tm', require('./routes/tm'));
app.use('/api/auth', require('./routes/auth'));
require('./scheduler/dailyScanner'); 
// TEMPORARY TEST ENDPOINT
app.get('/test-scan', async (req, res) => {
  const { scanAllTLs } = require('./services/gmailScanner');
  const result = await scanAllTLs();
  res.json(result);
});
(async () => {
  await connectDB();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`\n🚀 Kudos System: http://localhost:${PORT}`);
    console.log(`   TL:         http://localhost:${PORT}/tl.html`);
    console.log(`   TM:         http://localhost:${PORT}/tm.html`);
    console.log(`   CEO:        http://localhost:${PORT}/ceo.html`);
    console.log(`   Assistant:  http://localhost:${PORT}/assistant.html\n`);
  });
})();