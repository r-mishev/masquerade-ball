const mongoose = require('mongoose');

// A. Users Collection
const userSchema = new mongoose.Schema({
  loginCode: { 
    type: String, 
    required: true, 
    unique: true, 
    minlength: 6, 
    maxlength: 6 
  },
  isAdmin: { type: Boolean, default: false }
});

// B. Donations Collection
const donationSchema = new mongoose.Schema({
  donorName: { type: String, required: true },
  donorEmail: { type: String, required: true, lowercase: true, trim: true },
  amount: { type: Number, required: true, min: 10 },
  timestamp: { type: Date, default: Date.now },
  enteredBy: { type: String, required: true } // Stores staff loginCode
});

const User = mongoose.model('User', userSchema);
const Donation = mongoose.model('Donation', donationSchema);

module.exports = { User, Donation };