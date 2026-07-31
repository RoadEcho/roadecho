'use client';

import { useState } from 'react';

export default function Home() {
  const [plate, setPlate] = useState('');
  const [state, setState] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate, state, message }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus('Secure message sent successfully!');
        setPlate('');
        setState('');
        setMessage('');
      } else {
        setStatus(data.error || 'Failed to send message.');
      }
    } catch (err) {
      setStatus('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
      <div className="w-full max-w-md p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md">
        
        {/* Full Logo Display with Watermark Cropped */}
        <div className="flex justify-center mb-6">
          <div className="w-56 h-32 overflow-hidden relative rounded-2xl border border-slate-800 shadow-xl flex items-center justify-center bg-slate-950">
            <img 
              src="/logo.PNG" 
              alt="RoadEcho Logo" 
              className="absolute w-72 max-w-none scale-110 translate-y-1 object-cover" 
            />
          </div>
        </div>

        <p className="text-slate-400 text-center text-sm mb-6">
          Privacy-first plate-to-plate messaging with cryptographic hashing and AI pre-moderation.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              License Plate
            </label>
            <input
              type="text"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC1234"
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              State / Province / Region
            </label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value.toUpperCase())}
              placeholder="CA, ON, Tokyo, etc."
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your lights are on / Great parking job!"
              rows={4}
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Processing through AI...' : 'Send Secure Message'}
          </button>
        </form>

        {status && (
          <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-center text-sm text-cyan-300">
            {status}
          </div>
        )}
      </div>
    </main>
  );
}
