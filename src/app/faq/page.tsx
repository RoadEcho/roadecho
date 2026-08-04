export default function FAQPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-6 bg-slate-950 text-slate-200">
      <div className="w-full max-w-2xl p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md my-8">
        <h1 className="text-2xl font-bold text-cyan-400 mb-2">Frequently Asked Questions</h1>
        <p className="text-xs text-slate-400 mb-6">Everything you need to know about RoadEcho security, privacy, and operations.</p>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          {/* Section 1 */}
          <div>
            <h2 className="text-base font-semibold text-white mb-2 pt-2 border-t border-slate-800/80 first:border-0 first:pt-0">
              1. Core Mechanics & Privacy
            </h2>
            <div className="space-y-3 pl-2">
              <div>
                <strong className="text-slate-200 block">What is RoadEcho?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  RoadEcho is a privacy-first, secure digital messaging and notification utility designed to seamlessly bridge communication between vehicle owners using cryptographic plate hashing.
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block">How does RoadEcho protect my license plate and privacy?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  To ensure absolute compliance with the Driver&apos;s Privacy Protection Act (DPPA) and international privacy laws, raw license plate strings are transformed using SHA-256 cryptographic hashing with unique server-side salts. No raw plate numbers or plain-text Personally Identifiable Information (PII) are ever stored in the database.
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block">Can someone unmask or reveal an anonymous sender?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  No. RoadEcho operates on a strict zero-knowledge architecture, meaning the platform does not track, unmask, or reveal the identity or personal information of anonymous senders.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-base font-semibold text-white mb-2 pt-2 border-t border-slate-800/80">
              2. Messaging & Moderation
            </h2>
            <div className="space-y-3 pl-2">
              <div>
                <strong className="text-slate-200 block">How are messages sent and screened?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  Senders look up a vehicle by state and plate, type or dictate a message via browser-native voice integration, and submit it with a mandatory terms agreement. All messages pass through real-time autonomous OpenAI pre-moderation filters to instantly intercept and block harassment, threats, or toxic language.
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block">What happens if a message violates platform rules?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  Any content flagged by the autonomous pre-moderation gate is automatically rejected and blocked from entering the vault queue.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-base font-semibold text-white mb-2 pt-2 border-t border-slate-800/80">
              3. Vaults, Monetization & Data Rights
            </h2>
            <div className="space-y-3 pl-2">
              <div>
                <strong className="text-slate-200 block">How do I claim my license plate?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vehicle owners can voluntarily claim up to three plate inboxes digitally via secure email authentication. Physical registration documents and government ID uploads are strictly prohibited to eliminate unnecessary PII liability.
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block">How does the Referral Rewards Vault work?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  You receive a unique referral link in your vault dashboard. When friends use your link to send a message or claim a plate, a 24-hour access pass is safely deposited into your stored pass vault.
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block">How do I activate my stored referral passes?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  Go to your dashboard vault, check your available stored passes, and click &quot;Activate 24-Hour Pass From Vault&quot; whenever you are ready to unlock waiting messages. Active time extends cleanly if you have remaining duration.
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block">What do platform fees cover?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fees paid on the platform strictly cover secure digital decryption, data delivery, and real-time alert services.
                </p>
              </div>
              <div>
                <strong className="text-slate-200 block">What are the pricing options?</strong>
                <ul className="list-disc list-inside text-xs text-slate-400 mt-1 space-y-1">
                  <li><strong className="text-slate-300">Free Core:</strong> Register plates, look up vehicles, and manage incoming vault items with zero friction.</li>
                  <li><strong className="text-slate-300">24-Hour Pass ($1.99):</strong> Pay a one-time digital decryption and delivery fee to read a waiting message payload.</li>
                  <li><strong className="text-slate-300">Active Subscriber ($2.99 / month):</strong> Receive continuous real-time alert notifications and streamlined vault access.</li>
                </ul>
              </div>
              <div>
                <strong className="text-slate-200 block">How do I delete my account and data (GDPR Compliance)?</strong>
                <p className="text-xs text-slate-400 mt-0.5">
                  In compliance with international GDPR and UK GDPR regulations, you maintain absolute Data Subject Rights. You can execute instant self-service account deletion and permanent data record purging directly through your user dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-800 text-center">
          <a href="/" className="text-xs text-cyan-400 hover:underline">&larr; Return to RoadEcho Home</a>
        </div>
      </div>
    </main>
  );
}
