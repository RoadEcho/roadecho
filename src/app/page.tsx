'use client';

import { useState } from 'react';

export default function Home() {
  const [plate, setPlate] = useState('');
  const [state, setState] = useState('CA');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: plate.toUpperCase(), state, message }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus('Secure message sent successfully!');
        setMessage('');
        setPlate('');
      } else {
        setStatus(`Error: ${data.error || 'Failed to send'}`);
      }
    } catch (err) {
      setStatus('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center text-cyan-400">RoadEcho</h1>
        <p className="text-sm text-slate-400 mb-6 text-center">
          Privacy-first plate-to-plate messaging with AI pre-moderation.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">License Plate</label>
              <input
                type="text"
                required
                placeholder="ABC1234"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white uppercase focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="CA">CA</option>
                <option value="NY">NY</option>
                <option value="TX">TX</option>
                <option value="FL">FL</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase">Message</label>
            <textarea
              required
              rows={4}
              placeholder="Your lights are on / Great parking job!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Processing & Moderating...' : 'Send Secure Message'}
          </button>
        </form>

        {status && (
          <p className={`mt-4 text-center text-sm font-medium ${status.includes('Success') ? 'text-green-400' : 'text-red-400'}`}>
            {status}
          </p>
        )}
      </div>
    </main>
  );
}
