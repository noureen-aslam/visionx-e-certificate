import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, useSearchParams, Navigate } from 'react-router-dom';
import './App.css';

const API_BASE = 'https://visionx-e-certificate.onrender.com';

// --- COMPONENT 1: The Verification Page (For QR Scans) ---
const VerifyCertificate = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-blue-900 max-w-md w-full text-center">
        <div className="mb-6">
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
            ✅ Officially Verified
          </span>
        </div>
        <h1 className="text-2xl font-bold text-blue-900 mb-4">VisionX Certificate</h1>

        <div className="space-y-4 text-left border-t border-b py-6 my-4">
          <p className="text-gray-600"><strong>Student Name:</strong> {name || "Attendee"}</p>
          <p className="text-gray-600"><strong>Certificate ID:</strong> {id}</p>
          <p className="text-gray-600"><strong>Event:</strong> Synapse AI – AI Coding Secrets</p>
          <p className="text-gray-600"><strong>Status:</strong> ✅ Issued & Authentic</p>
        </div>

        <p className="text-sm text-gray-400 italic">
          This digital record confirms the participant's attendance and completion of the workshop hosted by VisionX Club at Presidency University.
        </p>
      </div>
    </div>
  );
};

// --- COMPONENT 2: The Main Portal (For Claiming Certificates) ---
const CertificatePortal = () => {
  const [step, setStep] = useState(1);
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
        body: JSON.stringify({ rollNumber: rollNumber.toUpperCase().trim() })
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
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_VISIONX_API_KEY
        },
        body: JSON.stringify({ name, email, rollNumber })
      });
      
      
      if (res.ok) {
        setStatus(`Success! Sent to ${email}`);
        setStep(1);
        setRollNumber('');
        setEmail('');
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
              placeholder="Ex: 20221CSE0XXX"
              required
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
            />
          </div>
          <button className="primary-btn send" disabled={loading}>
            {loading ? 'Sending PDF...' : 'Claim Certificate'}
          </button>
          <button type="button" onClick={() => setStep(1)} className="text-btn">
            Not you? Go back
          </button>
        </form>
      )}

      {status && (
        <div className={`status ${status.includes('Success') ? 'success' : 'error'}`}>
          {status}
        </div>
      )}
    </div>
  );
};

// --- MAIN APP COMPONENT WITH ROUTES ---
function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<CertificatePortal />} />
          <Route path="/synapse-ai/:id" element={<VerifyCertificate />} />
          <Route path="/synapse-ai" element={<CertificatePortal />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;