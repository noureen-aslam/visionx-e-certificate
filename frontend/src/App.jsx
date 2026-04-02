import { useState } from 'react';
import './App.css';

function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);

  const sendForm = async (e) => {
    e.preventDefault();
    setStatus('Sending...');

    try {
      const response = await fetch('http://localhost:5000/generate-and-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await response.json();

      if (response.ok) {
        setStatus('Success! Certificate sent to ' + email);
      } else {
        setStatus(`Error: ${data.message || 'unknown'}`);
      }
    } catch (error) {
      setStatus('Error: ' + error.message);
    }
  };

  return (
    <div className="app-container">
      <h1>VisionX Club Certificate Generator</h1>
      <p>Event: Synapse AI – AI Coding Secrets Every Student Should Know</p>
      <p>Type: Peer-to-Peer Workshop</p>
      <p>Date: 1st April 2026</p>

      <form onSubmit={sendForm} className="form-card">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <button type="submit">Generate & Send Certificate</button>
      </form>

      {status && <div className="status">{status}</div>}
    </div>
  );
}

export default App;
