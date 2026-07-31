export default function TermsOfService() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 bg-slate-950 text-slate-200">
      <div className="w-full max-w-2xl p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md my-8">
        <h1 className="text-2xl font-bold text-cyan-400 mb-4">Terms of Service</h1>
        <p className="text-xs text-slate-400 mb-6">Last updated: July 2026</p>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white pt-2">1. Nature of Service</h2>
          <p>
            RoadEcho is a privacy-first, secure digital messaging and notification utility designed to bridge communication between vehicle owners using cryptographic plate hashing. Fees paid on the platform strictly cover secure digital decryption, data delivery, and real-time alert services.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">2. Anonymity & Non-Unmasking Policy</h2>
          <p>
            RoadEcho operates on a zero-knowledge architecture. The platform strictly does not track, unmask, or reveal the identity or personal information of anonymous senders. Users acknowledge and agree that fees do not include or guarantee sender identification.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">3. Prohibited Conduct & AI Pre-Moderation</h2>
          <p>
            All messages are screened in real-time by autonomous AI pre-moderation filters. Harassment, threats, stalking vectors, or illegal content are automatically blocked. Violation of platform rules results in permanent transmission bans.
          </p>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 text-center">
          <a href="/" className="text-xs text-cyan-400 hover:underline">&larr; Return to RoadEcho Home</a>
        </div>
      </div>
    </main>
  );
}
