'use client';

import { useState } from 'react';

export function ExampleForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('submitting');
    
    // Simulate a network request
    setTimeout(() => {
      setStatus('success');
    }, 500);
  };

  if (status === 'success') {
    return (
      <div className="p-4 bg-green-50 text-green-900 border border-green-200 rounded-md" role="alert">
        <h2 className="font-bold">Thank you!</h2>
        <p>Your submission has been received.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white border rounded-lg shadow-sm max-w-md flex flex-col gap-4">
      <h2 className="text-xl font-bold">Contact Us</h2>
      
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="font-medium text-sm">Full Name</label>
        <input 
          id="name" 
          name="name" 
          type="text" 
          required 
          className="border rounded p-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="topic" className="font-medium text-sm">Topic</label>
        <select id="topic" name="topic" className="border rounded p-2" required>
          <option value="">Select a topic...</option>
          <option value="support">Technical Support</option>
          <option value="sales">Sales Inquiry</option>
          <option value="feedback">General Feedback</option>
        </select>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input 
          id="newsletter" 
          name="newsletter" 
          type="checkbox" 
          className="w-4 h-4"
        />
        <label htmlFor="newsletter" className="text-sm">
          Subscribe to our newsletter
        </label>
      </div>

      <button 
        type="submit" 
        disabled={status === 'submitting'}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sending...' : 'Submit'}
      </button>
    </form>
  );
}