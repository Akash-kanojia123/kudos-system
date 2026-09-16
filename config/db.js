
// const mongoose = require('mongoose');

// async function connectDB() {
//   await mongoose.connect(process.env.MONGODB_URI);
//   console.log('✅ MongoDB connected');
// }

// module.exports = connectDB;

const mongoose = require('mongoose');

let cachedConnection = null;

async function connectDB() {
  if (cachedConnection) return cachedConnection;
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    cachedConnection = conn;
    console.log('✅ MongoDB connected');
    return conn;
  } catch (error) {
    console.error('❌ MongoDB error:', error);
    throw error;
  }
}

module.exports = connectDB;