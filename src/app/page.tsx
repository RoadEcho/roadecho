'use client';

import { useState } from 'react';

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
        recognition.abort(); // Forces iOS Safari to instantly release the hardware mic
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RoadEcho',
          text: 'Check out RoadEcho—secure, privacy-first plate-to-plate messaging!',
          url: window.location.origin,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(window.location.origin);
      alert('RoadEcho link copied to clipboard!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setStatus('You must agree to the terms before sending.');
      return;
    }

    setLoading(true);
    setStatus(null);

    // Capture user location coordinates if permitted by the browser
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

        <div className="flex justify-between items-center mb-6">
          <p className="text-slate-400 text-xs">
            Privacy-first plate-to-plate messaging with cryptographic hashing and AI pre-moderation.
          </p>
          <div className="flex items-center space-x-3 ml-2">
            <button
              type="button"
              onClick={handleShare}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium whitespace-nowrap cursor-pointer bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700"
            >
              📤 Share
            </button>
            <a href="/dashboard" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium whitespace-nowrap">
              Plate Vault &rarr;
            </a>
          </div>
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

          {/* Legal Click-Wrap Agreement with Clickable Links */}
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
              I agree that fees cover secure digital decryption and delivery services. I understand RoadEcho does not unmask anonymous senders and abides by{' '}
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
      </div>
    </main>
  );
}
