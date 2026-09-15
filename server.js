require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// ============================================================
// CORS — Allow Chrome Extension + Localhost + Railway
// ============================================================
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    // Allow Chrome extensions (chrome-extension://...)
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow localhost + Railway
    const allowedOrigins = [
      'http://localhost:4000',
      'http://localhost:3000',
      'https://kudos-system-production.up.railway.app'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Block everything else
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// Routes
// ============================================================
app.use('/api/tl', require('./routes/tl'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/ceo', require('./routes/ceo'));
app.use('/api/tm', require('./routes/tm'));
app.use('/api/auth', require('./routes/auth'));

// Scheduler
require('./scheduler/dailyScanner');

// ============================================================
// TEMPORARY TEST ENDPOINT
// ============================================================
app.get('/test-scan', async (req, res) => {
  const { scanAllTLs } = require('./services/gmailScanner');
  const result = await scanAllTLs();
  res.json(result);
});

// ============================================================
// Start Server
// ============================================================
(async () => {
  await connectDB();
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Kudos System: http://localhost:${PORT}`);
    console.log(`   TL:         http://localhost:${PORT}/tl.html`);
    console.log(`   TM:         http://localhost:${PORT}/tm.html`);
    console.log(`   CEO:        http://localhost:${PORT}/ceo.html`);
    console.log(`   Assistant:  http://localhost:${PORT}/assistant.html\n`);
  });
})();