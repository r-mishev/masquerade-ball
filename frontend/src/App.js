import React, { useState, useEffect } from 'react';
import './App.css'; // Assume basic styling

const API_URL = process.env.NODE_ENV === 'production' 
  ? "https://masquerade-ball-c5iq.onrender.com"
  : "http://localhost:5000/api";

function App() {
  const [user, setUser] = useState(null); // { loginCode, isAdmin }
  const [loginInput, setLoginInput] = useState("");
  const [error, setError] = useState("");

  // LOGIN HANDLER
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginCode: loginInput })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setError("");
      } else {
        setError(data.message);
      }
    } catch (err) { setError("Server Error"); }
  };

  if (!user) {
    return (
      <div className="login-container">
        <h1>Teddy Bear Tracker Login</h1>
        <form onSubmit={handleLogin}>
          <input 
            type="text" 
            placeholder="Enter 6-digit Code" 
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)} 
            maxLength={6}
          />
          <button type="submit">Enter</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="app-container">
      <header>
        <span>Logged in as: {user.loginCode} ({user.isAdmin ? 'Admin' : 'Staff'})</span>
        <button onClick={() => setUser(null)}>Logout</button>
      </header>
      <main>
        <StaffView user={user} />
        {user.isAdmin && <AdminView />}
      </main>
    </div>
  );
}

// --- STAFF VIEW COMPONENT ---
function StaffView({ user }) {
  const [formData, setFormData] = useState({ name: '', email: '', amount: '' });
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', msg: '' }
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch(`${API_URL}/donate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorName: formData.name,
          donorEmail: formData.email,
          amount: parseFloat(formData.amount),
          enteredBy: user.loginCode
        })
      });

      if (res.ok) {
        setStatus({ type: 'success', msg: 'Donation logged! Certificate generating...' });
        setFormData({ name: '', email: '', amount: '' });
      } else {
        setStatus({ type: 'error', msg: 'Failed to log donation.' });
      }
    } catch (err) {
      setStatus({ type: 'error', msg: 'Network error.' });
    }
    setLoading(false);
  };

  return (
    <div className="section">
      <h2>📝 Log Donation</h2>
      <form onSubmit={handleSubmit}>
        <input 
          placeholder="Donor Name" 
          required 
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
        />
        <input 
          type="email" 
          placeholder="Donor Email" 
          required 
          value={formData.email}
          onChange={e => setFormData({...formData, email: e.target.value})}
        />
        <input 
          type="number" 
          placeholder="Amount ($)" 
          min="10" 
          required 
          value={formData.amount}
          onChange={e => setFormData({...formData, amount: e.target.value})}
        />
        <button disabled={loading}>
          {loading ? "Processing..." : "Submit Donation"}
        </button>
      </form>
      {status && <p className={status.type}>{status.msg}</p>}
    </div>
  );
}

// --- ADMIN VIEW COMPONENT ---
function AdminView() {
  const [stats, setStats] = useState({ grandTotal: 0, todaysTotal: 0 });
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const res = await fetch(`${API_URL}/admin/stats`);
    const data = await res.json();
    setStats(data);
  };

  const drawRaffle = async () => {
    const res = await fetch(`${API_URL}/admin/draw-raffle`);
    const data = await res.json();
    setWinner(data);
  };

  return (
    <div className="section admin-section">
      <h2>📊 Admin Dashboard</h2>
      <div className="stats-grid">
        <div className="card">
          <h3>Today's Total</h3>
          <p>${stats.todaysTotal.toFixed(2)}</p>
        </div>
        <div className="card">
          <h3>Grand Total</h3>
          <p>${stats.grandTotal.toFixed(2)}</p>
        </div>
      </div>

      <hr />
      
      <div className="raffle-area">
        <h3>🎟️ Raffle Draw</h3>
        <button onClick={drawRaffle} className="raffle-btn">Draw Raffle Winner</button>
        
        {winner && (
          <div className="winner-reveal">
            <h4>🎉 Winner! 🎉</h4>
            <p><strong>Name:</strong> {winner.winnerName}</p>
            <p><strong>Email:</strong> {winner.winnerEmail}</p>
            <p><strong>Total Entries:</strong> {winner.totalEntries}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;