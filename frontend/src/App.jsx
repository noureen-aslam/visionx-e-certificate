import { useState } from 'react';
import './App.css';

const API_BASE = 'https://visionx-e-certificate.onrender.com';

function App() {
  const [step, setStep] = useState(1); // 1: Verify, 2: Send
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/verify-student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumber })
      });
      const data = await res.json();
      if (res.ok) {
        setName(data.name);
        setStep(2);
      } else {
        setStatus(data.message || "Roll number not recognized.");
      }
    } catch (err) {
      setStatus("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/generate-and-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, rollNumber })
      });
      if (res.ok) {
        setStatus(`Success! Sent to ${email}`);
        setStep(1); setRollNumber(''); setEmail('');
      } else {
        setStatus("Failed to send certificate.");
      }
    } catch (err) {
      setStatus("Error during processing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="glass-card">
        <h1 className="title">VisionX Club</h1>
        <p className="subtitle">Synapse AI Certificate Portal</p>

        {step === 1 ? (
          <form onSubmit={handleVerify} className="form-content">
            <div className="input-box">
              <label>Academic Roll Number</label>
              <input 
                value={rollNumber} 
                onChange={(e) => setRollNumber(e.target.value)} 
                placeholder="Ex: 20221CSE0XXX" required 
              />
            </div>
            <button className="primary-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify Attendance'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSend} className="form-content">
            <div className="welcome-text">
              Verified: <strong>{name}</strong>
            </div>
            <div className="input-box">
              <label>Delivery Email</label>
              <input 
                type="email" value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Enter your email address" required 
              />
            </div>
            <button className="primary-btn send" disabled={loading}>
              {loading ? 'Sending PDF...' : 'Claim Certificate'}
            </button>
            <button type="button" onClick={() => setStep(1)} className="text-btn">Not you? Go back</button>
          </form>
        )}

        {status && <div className={`status ${status.includes('Success') ? 'success' : 'error'}`}>{status}</div>}
      </div>
    </div>
  );
}

export default App;