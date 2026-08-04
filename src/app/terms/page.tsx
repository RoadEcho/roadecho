export default function TermsOfService() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 bg-slate-950 text-slate-200">
      <div className="w-full max-w-2xl p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md my-8">
        <h1 className="text-2xl font-bold text-cyan-400 mb-4">Terms of Service</h1>
        <p className="text-xs text-slate-400 mb-6">Last updated: August 2026 | Worldwide Operations</p>

        <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
          <h2 className="text-base font-semibold text-white pt-2">1. Nature of Service & DPPA Compliance</h2>
          <p>
            RoadEcho is a privacy-first, secure digital messaging and notification utility designed to bridge communication between vehicle owners using cryptographic plate hashing. Raw license plate strings and state inputs are transformed using SHA-256 cryptographic hashing with unique server-side salts; plain-text PII and DMV records are never stored. Fees paid on the platform strictly cover secure digital decryption, data delivery, and real-time alert services.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">2. Anonymity & Non-Unmasking Policy</h2>
          <p>
            RoadEcho operates on a zero-knowledge architecture. The platform strictly does not track, unmask, or reveal the identity or personal information of anonymous senders, immunizing the company from FTC deceptive trade practice claims. Users acknowledge and agree that fees do not include or guarantee sender identification.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">3. Prohibited Conduct & AI Pre-Moderation (Section 230 Safe Harbor)</h2>
          <p>
            All messages are screened in real-time by autonomous OpenAI pre-moderation filters before entering database queues. Harassment, threats, stalking vectors, or illegal content are automatically intercepted and destroyed, securing robust Section 230 safe-harbor protection. Violation of platform rules results in permanent transmission bans.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">4. Global Compliance & Data Rights (GDPR / UK GDPR)</h2>
          <p>
            For international users across the European Union, United Kingdom, and Canada, RoadEcho complies with regional data privacy frameworks. Users maintain absolute Data Subject Rights, including instant self-service account deletion and permanent record purging via the user dashboard.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">5. Referral Rewards Program</h2>
          <p>
            Users may earn stored 24-hour access passes through our referral program by sharing their unique referral link. Stored vault passes are non-transferable, hold no cash value, and cannot be redeemed for fiat currency or refunds. Self-referrals, automated script signups, and fraudulent conversion padding will result in immediate forfeiture of stored vault passes and permanent account suspension. RoadEcho reserves the right to alter, suspend, or terminate the referral reward structure at any time without notice.
          </p>

          <h2 className="text-base font-semibold text-white pt-2">6. Intellectual Property & Proprietary Rights</h2>
          <p>
            All source code, database schemas, cryptographic hashing algorithms, server-side environment logic, user interfaces, text, graphics, logos, and software architecture comprising RoadEcho are the exclusive intellectual property of the business entity and are protected under international copyright, trade secret, trademark, and other intellectual property laws. Users and third parties are strictly prohibited from copying, modifying, adapting, distributing, decompiling, reverse engineering, scraping, or attempting to extract the proprietary source code, system blueprints, or database structures of the platform. Any unauthorized reproduction or extraction constitutes an immediate material breach of these Terms and will be prosecuted to the fullest extent of the law.
          </p>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 text-center">
          <a href="/" className="text-xs text-cyan-400 hover:underline">&larr; Return to RoadEcho Home</a>
        </div>
      </div>
    </main>
  );
}
