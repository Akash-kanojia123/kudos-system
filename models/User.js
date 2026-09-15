const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
  
  team:  { type: String },

  // Gmail integration
  gmailRefreshToken: { type: String, default: '' },
  gmailConnected:    { type: Boolean, default: false },
  seenMessageIds:    [{ type: String }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);