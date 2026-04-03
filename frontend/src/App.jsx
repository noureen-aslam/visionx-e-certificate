import { useState, useEffect } from 'react';
import './App.css';

const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL?.replace(/\/$/, '')) ||
  'https://visionx-e-certificate.onrender.com';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- Verification State ---
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedData, setVerifiedData] = useState({ name: '', id: '' });

  useEffect(() => {
    // Check if the URL contains verification parameters
    const params = new URLSearchParams(window.location.search);
    const verifyId = params.get('verify');
    const studentName = params.get('name');

    if (verifyId && studentName) {
      setIsVerifying(true);
      setVerifiedData({ name: studentName, id: verifyId });
    }
  }, []);

  const sendForm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Processing...');

    try {
      const response = await fetch(`${API_BASE}/generate-and-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      const text = await response.text();
      let data = {};
      
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        setStatus(`Server Error: ${response.status}. Service may be restarting.`);
        return;
      }

      if (response.ok) {
        setStatus(`Success! Certificate sent to ${email}`);
        setName('');
        setEmail('');
      } else {
        const errorMessage = data.message || data.error || 'Internal Server Error';
        const detail = data.detail ? ` — ${data.detail}` : '';
        setStatus(`Error: ${errorMessage}${detail}`);
      }
    } catch (error) {
      setStatus('Connection Error: Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  // --- VIEW 1: VERIFICATION BADGE (Shown when QR is scanned) ---
  if (isVerifying) {
    return (
      <div className="app-container">
        <div className="glass-card verification-card">
          <div className="verify-icon">✅</div>
          <h1 style={{ color: '#2ecc71' }}>Certificate Verified</h1>
          <p className="verify-subtitle">Official VisionX Club Academic Record</p>
          
          <div className="verify-details">
            <div className="verify-item">
              <label>Issued To</label>
              <p>{verifiedData.name}</p>
            </div>
            <div className="verify-item">
              <label>Event</label>
              <p>Synapse AI – AI Coding Secrets</p>
            </div>
            <div className="verify-item">
              <label>Certificate ID</label>
              <p className="mono">{verifiedData.id}</p>
            </div>
            <div className="verify-item">
              <label>Status</label>
              <p className="status-badge">AUTHENTIC</p>
            </div>
          </div>
          
          <button 
            onClick={() => window.location.href = window.location.origin} 
            className="back-btn"
          >
            ← Back to Generator
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW 2: ORIGINAL GENERATOR FORM ---
  return (
    <div className="app-container">
      <div className="glass-card">
        <h1>VisionX Club Certificate Generator</h1>
        <div className="event-info">
          <p><strong>Event:</strong> Synapse AI – AI Coding Secrets</p>
          <p><strong>Type:</strong> Peer-to-Peer Workshop</p>
          <p><strong>Date:</strong> 1st April 2026</p>
        </div>

        <form onSubmit={sendForm} className="form-card">
          <div className="input-group">
            <label>Full Name</label>
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="As it should appear on certificate"
              required 
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Enter your registered email"
              required 
              disabled={loading}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Processing...' : 'Generate & Send Certificate'}
          </button>
        </form>

        {status && (
          <div className={`status-message ${status.includes('Success') ? 'success' : 'error'}`}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;