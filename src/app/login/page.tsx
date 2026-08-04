'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugLog, setDebugLog] = useState<string>('')

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search)
    const errorParam = queryParams.get('error')
    if (errorParam && errorParam !== '{}') {
      setError(errorParam)
    }
  }, [])

  async function handleLogin() {
    setDebugLog('1. Button clicked!')

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      setDebugLog('2. Calling Supabase OTP...')

      const response = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })

      setDebugLog(`3. Raw Response received.`)

      if (response.error) {
        // Force stringify the entire error object to inspect hidden properties
        const errorString = JSON.stringify(response.error, Object.getOwnPropertyNames(response.error))
        setError(`Supabase Error: ${errorString}`)
      } else {
        setSubmitted(true)
      }
    } catch (err: any) {
      const catchString = JSON.stringify(err, Object.getOwnPropertyNames(err))
      setError(`Catch Error: ${catchString}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
      <div className="w-full max-w-md p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md">
        
        {/* Back Button */}
        <div className="mb-4">
          <Link href="/" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            &larr; Back to Home
          </Link>
        </div>

        {/* Logo Display */}
        <div className="flex justify-center mb-4">
          <div className="w-56 h-32 overflow-hidden relative rounded-2xl border border-slate-800 shadow-xl flex items-center justify-center bg-slate-950">
            <img 
              src="/logo.PNG" 
              alt="RoadEcho Logo" 
              className="absolute w-72 max-w-none scale-110 translate-y-1 object-cover" 
            />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">RoadEcho Login</h1>
        <p className="text-slate-400 text-sm mb-6">Enter your email to sign in or create an account via magic link.</p>

        {/* Live Debug Box */}
        {debugLog && (
          <div className="mb-4 p-3 bg-blue-950/60 border border-blue-800 rounded-lg text-blue-200 text-xs font-mono break-all">
            <strong>Debug:</strong> {debugLog}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-xs font-mono break-all">
            {error}
          </div>
        )}

        {submitted ? (
          <div className="p-4 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-sm text-center">
            Check your email for the magic login link!
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                className="mt-0.5 accent-cyan-500 cursor-pointer"
              />
              <label htmlFor="login-terms" className="cursor-pointer leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Terms of Service</Link> and{' '}
                <Link href="/privacy" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Privacy Policy</Link>.
              </label>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg shadow-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Send Magic Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
