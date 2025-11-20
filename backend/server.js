require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { User, Donation } = require('./models');
const { generateAndEmail } = require('./utils/automation');

const app = express();
app.use(express.json());
app.use(cors());

// Connect DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// --- SEED ROUTE (Run once to populate users) ---
app.get('/seed-users', async (req, res) => {
  const users = [
    { loginCode: 'ADM001', isAdmin: true },
    { loginCode: 'ADM002', isAdmin: true },
    { loginCode: 'ADM003', isAdmin: true },
    { loginCode: 'ADM004', isAdmin: true },
    { loginCode: 'STF001', isAdmin: false },
    { loginCode: 'STF002', isAdmin: false },
  ];
  try {
    await User.insertMany(users);
    res.send('Users seeded');
  } catch (e) { res.send('Already seeded or error'); }
});

// --- AUTH ---
app.post('/api/login', async (req, res) => {
  const { loginCode } = req.body;
  const user = await User.findOne({ loginCode });
  if (!user) return res.status(404).json({ message: "Invalid Code" });
  res.json({ loginCode: user.loginCode, isAdmin: user.isAdmin });
});

// --- STAFF: DONATE ---
app.post('/api/donate', async (req, res) => {
  const { donorName, donorEmail, amount, enteredBy } = req.body;
  
  if (amount < 10) return res.status(400).json({ message: "Minimum donation is $10" });

  try {
    const newDonation = new Donation({ donorName, donorEmail, amount, enteredBy });
    await newDonation.save();
    
    // Trigger automation asynchronously (Fire and Forget)
    generateAndEmail(newDonation); 
    
    res.status(201).json({ message: "Donation logged successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error saving donation" });
  }
});

// --- ADMIN: STATS ---
app.get('/api/admin/stats', async (req, res) => {
  try {
    // Grand Total
    const allDonations = await Donation.find({});
    const grandTotal = allDonations.reduce((acc, curr) => acc + curr.amount, 0);

    // Today's Total
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    
    const todaysDonations = await Donation.find({ timestamp: { $gte: startOfDay } });
    const todaysTotal = todaysDonations.reduce((acc, curr) => acc + curr.amount, 0);

    res.json({ grandTotal, todaysTotal });
  } catch (err) {
    res.status(500).json({ message: "Error fetching stats" });
  }
});

// --- ADMIN: RAFFLE ---
app.get('/api/admin/draw-raffle', async (req, res) => {
  try {
    const donations = await Donation.find({});
    const entriesMap = {}; // { 'email': count }
    const nameMap = {}; // { 'email': 'name' } to return name later

    // 1. Calculate Entries
    donations.forEach(d => {
      let points = 0;
      if (d.amount >= 50) points = 15;
      else if (d.amount >= 20) points = 5;
      else if (d.amount >= 15) points = 3;
      else if (d.amount >= 10) points = 1;

      entriesMap[d.donorEmail] = (entriesMap[d.donorEmail] || 0) + points;
      nameMap[d.donorEmail] = d.donorName; // Store most recent name used
    });

    // 2. Weighted Pool
    const pool = [];
    Object.keys(entriesMap).forEach(email => {
      const count = entriesMap[email];
      for(let i=0; i<count; i++) {
        pool.push(email);
      }
    });

    if (pool.length === 0) return res.json({ message: "No entries found" });

    // 3. Select Winner
    const winningEmail = pool[Math.floor(Math.random() * pool.length)];
    
    res.json({
      winnerName: nameMap[winningEmail],
      winnerEmail: winningEmail,
      totalEntries: entriesMap[winningEmail]
    });

  } catch (err) {
    res.status(500).json({ message: "Error running raffle" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));