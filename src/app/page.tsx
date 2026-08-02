'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [plate, setPlate] = useState('');
  const [country, setCountry] = useState('USA');
  const [region, setRegion] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);

  // Capture referral parameter from URL and store it locally
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refId = params.get('ref');
    if (refId) {
      localStorage.setItem('road_echo_ref', refId);
    }
  }, []);

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      setMessage(transcript);

      if (event.results[event.results.length - 1].isFinal) {
        recognition.abort();
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert('Microphone permission denied. Please allow microphone access in your browser or device settings.');
      } else {
        alert(`Speech error: ${event.error || 'Unknown error'}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      alert('Could not start microphone. Please try again.');
    }
  };

  const handleShare = async () => {
    try {
      await fetch('/api/analytics/share', { method: 'POST' });
    } catch (e) {
      // Silently fail
    }

    const shareText = "Ever wish you could anonymously text a driver about their parking or send a cool note? Check out RoadEcho — the safe, anonymous way to message any vehicle license plate! 🚗💨 https://roadecho.vercel.app";

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RoadEcho - Secure Plate Messaging',
          text: 'Check out RoadEcho — the safe, anonymous way to message any vehicle license plate!',
          url: 'https://roadecho.vercel.app',
        });
      } catch (err) {
        copyToClipboard(shareText);
      }
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setStatus('You must agree to the terms before sending.');
      return;
    }

    setLoading(true);
    setStatus(null);

    let latitude = null;
    let longitude = null;

    if (navigator.geolocation) {
      try {
        const position: GeolocationPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (err) {
        console.log('Location access declined or unavailable, proceeding without coordinates.');
      }
    }

    try {
      // 1. Send the secure message
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plate, 
          country, 
          region, 
          message, 
          senderEmail, 
          agreedToTerms,
          latitude,
          longitude 
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // 2. Check if there's a stored referral ID and trigger conversion credit!
        const referrerId = localStorage.getItem('road_echo_ref');
        if (referrerId && senderEmail) {
          try {
            await fetch('/api/referral/convert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: senderEmail, referrerId }),
            });
            localStorage.removeItem('road_echo_ref');
          } catch (refErr) {
            console.error('Failed to log referral conversion', refErr);
          }
        }

        setStatus('Secure message sent successfully!');
        setPlate('');
        setRegion('');
        setSenderEmail('');
        setMessage('');
        setAgreedToTerms(false);
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
        <div className="flex justify-center mb-4">
          <div className="w-56 h-32 overflow-hidden relative rounded-2xl border border-slate-800 shadow-xl flex items-center justify-center bg-slate-950">
            <img 
              src="/logo.PNG" 
              alt="RoadEcho Logo" 
              className="absolute w-72 max-w-none scale-110 translate-y-1 object-cover" 
            />
          </div>
        </div>

        <div className="mb-6 text-center">
          <p className="text-slate-400 text-xs">
            Privacy-first plate-to-plate messaging with cryptographic hashing and AI pre-moderation.
          </p>
        </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Country
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="USA, CA, UK..."
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                State / Region
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value.toUpperCase())}
                placeholder="CA, ON, Tokyo..."
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Your Email (For Confirmation)
            </label>
            <input
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Message
              </label>
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-cyan-400 hover:bg-slate-700'
                }`}
              >
                {isListening ? 'Listening...' : '🎤 Speak Message'}
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your lights are on / Great parking job!"
              rows={4}
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
          </div>

          {/* Legal Click-Agreement */}
          <div className="flex items-start space-x-2 text-xs text-slate-400 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              required
              className="mt-0.5 accent-cyan-500 cursor-pointer"
            />
            <label htmlFor="terms" className="cursor-pointer leading-relaxed">
              I understand RoadEcho does not unmask anonymous senders and abides by{' '}
              <a href="/terms" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Terms</a> &amp;{' '}
              <a href="/privacy" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Privacy Policy</a>.
            </label>
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

        {/* Curiosity Hook Banner */}
        <div className="mt-6 p-4 bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-cyan-400">🚗 Own a vehicle?</h3>
            <p className="text-xs text-slate-300 mt-0.5">Curious if another driver left a note for you? Check your plate in your secure vault.</p>
          </div>
          <a 
            href="/dashboard" 
            className="whitespace-nowrap px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition"
          >
            Check My Plate &rarr;
          </a>
        </div>
      </div>

      {/* Viral Share Card */}
      <div className="w-full max-w-md mx-auto mt-6 p-6 bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-xl text-center">
        <div className="inline-block p-2 bg-cyan-500/10 text-cyan-400 rounded-full mb-3 text-lg">
          🚗💨
        </div>
        <h3 className="text-base font-bold text-white mb-1">Find out if someone messaged your license plate!</h3>
        <p className="text-slate-400 text-xs mb-4 leading-relaxed">
          Check your secure plate vault and share RoadEcho with friends so they can check their plates too!
        </p>
        
        <button
          onClick={handleShare}
          className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
        >
          <span>📤 Share RoadEcho with Friends</span>
        </button>

        {copied && (
          <p className="text-xs text-emerald-400 mt-2 font-medium">
            ✓ Link copied to clipboard! Ready to paste anywhere.
          </p>
        )}
      </div>

      {/* Footer Navigation Link Outside Main Card */}
      <footer className="mt-6 text-center text-xs text-slate-500 space-x-4">
        <a href="/faq" className="hover:text-cyan-400 transition-colors">FAQ</a>
        <span>•</span>
        <a href="/terms" className="hover:text-cyan-400 transition-colors">Terms</a>
        <span>•</span>
        <a href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</a>
      </footer>
    </main>
  );
}
