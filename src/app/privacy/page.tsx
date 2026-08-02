export default function PrivacyPolicy() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 bg-slate-950 text-slate-200">
      <div className="w-full max-w-2xl p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md my-8">
        <h1 className="text-2xl font-bold text-cyan-400 mb-4">Privacy Policy</h1>
        <p className="text-xs text-slate-400 mb-6">Last updated: July 2026</p>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white pt-2">1. Zero-Knowledge Cryptographic Hashing</h2>
          <p>
            To ensure absolute compliance with the Driver&apos;s Privacy Protection Act (DPPA) and state privacy laws, raw license plate strings are transformed using SHA-256 cryptographic hashing with unique salts. No raw plate numbers or plain-text PII are ever stored in our database.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">2. Data Collection & Vault Claims</h2>
          <p>
            Vehicle owners voluntarily claim their plate inboxes digitally via secure email authentication. Physical registration documents or government identification uploads are strictly prohibited to prevent unnecessary data exposure.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">3. Referral Tracking & Local Storage</h2>
          <p>
            When visitors arrive via a unique referral link, we temporarily store the referrer identifier in your browser's local storage to attribute earned reward passes and prevent duplicate milestone claims upon conversion. Referral tracking is tied strictly to anonymized user metrics and authenticated email events.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">4. Security & Compliance Audit Trails</h2>
          <p>
            We maintain secure immutable audit logs confirming terms agreement timestamps and message queue events without compromising sender or recipient anonymity.
          </p>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 text-center">
          <a href="/" className="text-xs text-cyan-400 hover:underline">&larr; Return to RoadEcho Home</a>
        </div>
      </div>
    </main>
  );
}
