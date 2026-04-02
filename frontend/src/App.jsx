import { useState } from 'react';
import './App.css';

// Ensure the API URL doesn't have a trailing slash
const API_BASE = "https://visionx-e-certificate.onrender.com";

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendForm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Generating and sending your certificate... please wait.');

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
        // Handle cases where the server returns an HTML error page (like a 500 error)
        setStatus(`Server Error: ${response.status}. The certificate service might be restarting.`);
        setLoading(false);
        return;
      }

      if (response.ok) {
        setStatus(`✅ Success! Certificate sent to ${email}`);
        setName(''); // Clear form on success
        setEmail('');
      } else {
        const errorMessage = data.message || data.error || 'Internal Server Error';
        setStatus(`❌ Error: ${errorMessage}`);
      }
    } catch (error) {
      setStatus('❌ Connection Error: Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

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