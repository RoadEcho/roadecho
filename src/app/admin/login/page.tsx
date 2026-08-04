'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [isSettingPassword, setIsSettingPassword] = useState(false)

  // Detect if user landed here via an invite or recovery link with tokens in the URL hash
  useEffect(() => {
    const checkHashAndSession = async () => {
      const hash = window.location.hash
      if (hash && (hash.includes('type=invite') || hash.includes('type=recovery') || hash.includes('access_token'))) {
        setIsSettingPassword(true)
      }
    }

    checkHashAndSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        const hash = window.location.hash
        if (hash.includes('type=invite') || hash.includes('type=recovery')) {
          setIsSettingPassword(true)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResetSent(false)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) throw authError

      const { data: adminRecord, error: adminCheckError } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .single()

      if (adminCheckError || !adminRecord) {
        await supabase.auth.signOut()
        throw new Error('Access denied. This account is not authorized as an administrator.')
      }

      // Record admin login into user_logins so it increments Total Logins
      if (data.user) {
        await supabase.from('user_logins').insert({
          user_id: data.user.id,
          email: data.user.email,
        })
      }

      window.location.href = '/admin'
    } catch (err: any) {
      setError(err.message || 'Failed to sign in.')
      setLoading(false)
    }
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      // Record login upon setting password for invited admin
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: adminRecord } = await supabase
          .from('admin_users')
          .select('email')
          .eq('email', session.user.email?.toLowerCase())
          .single()

        if (adminRecord) {
          await supabase.from('user_logins').insert({
            user_id: session.user.id,
            email: session.user.email,
          })
        }
      }

      window.location.href = '/admin'
    } catch (err: any) {
      setError(err.message || 'Failed to set password.')
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your admin email address above first to reset your password.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/login`,
      })

      if (resetError) throw resetError

      setResetSent(true)
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.')
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md">
        
        <div className="mb-4">
          <a href="/" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
            &larr; Back to Home
          </a>
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

        <h1 className="text-2xl font-bold mb-2">
          {isSettingPassword ? '🔒 Set Admin Password' : 'Admin Command Login'}
        </h1>
        <p className="text-slate-400 text-xs mb-6">
          {isSettingPassword ? 'Enter your new password to activate your administrator account.' : 'Restricted access. Enter your administrator credentials.'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-xs">
            {error}
          </div>
        )}

        {resetSent && (
          <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-xs">
            Password reset instructions have been sent to your email.
          </div>
        )}

        {isSettingPassword ? (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving Password...' : 'Save Password & Enter Admin'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Processing...' : 'Sign In to Admin Portal'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
