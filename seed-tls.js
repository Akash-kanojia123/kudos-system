require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected');

  const users = [
    { name: 'Akash Kanojia', email: 'akash.kanojia@grazitti.com', team: 'Analytics' }
  ];

  for (const u of users) {
    await User.findOneAndUpdate({ email: u.email }, u, { upsert: true });
    console.log(`✅ ${u.email}`);
  }

  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });