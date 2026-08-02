'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSubmitted(true)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
      <div className="w-full max-w-md p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md">
        
        {/* Back Button */}
        <div className="mb-6">
          <a href="/" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            &larr; Back to Home
          </a>
        </div>

        <h1 className="text-2xl font-bold mb-2">RoadEcho Login</h1>
        <p className="text-slate-400 text-sm mb-6">Enter your email to sign in or create an account via magic link.</p>

        {error && <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">{error}</div>}

        {submitted ? (
          <div className="p-4 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-sm text-center">
            Check your email for the magic login link!
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* Terms & Privacy Checkbox */}
            <div className="flex items-start space-x-2 text-xs text-slate-400 pt-1">
              <input
                type="checkbox"
                id="login-terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                required
                className="mt-0.5 accent-cyan-500 cursor-pointer"
              />
              <label htmlFor="login-terms" className="cursor-pointer leading-relaxed">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Terms of Service</a> and{' '}
                <a href="/privacy" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Privacy Policy</a>.
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg shadow-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Sending Magic Link...' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
