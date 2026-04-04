import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const VerifyCertificate = () => {
  // useParams() gets the :id from /synapse-ai/:id
  const { id } = useParams(); 
  const [searchParams] = useSearchParams();
  // useSearchParams() gets the ?name=... from the URL
  const name = searchParams.get('name');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-blue-900 max-w-md w-full text-center">
        <div className="mb-6">
           <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
             Officially Verified
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

export default VerifyCertificate;