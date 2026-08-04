'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    // Check if user arrived via recovery/invite token session
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Ready for password update
      }
    })
  }, [])

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      setSuccess('Password updated successfully! Redirecting to admin dashboard...')
      setTimeout(() => {
        router.push('/admin')
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h1 className="text-xl font-bold text-cyan-400 mb-2">Set Your Admin Password</h1>
        <p className="text-xs text-slate-400 mb-6">Enter your new secure password below to access the RoadEcho Admin Command Center.</p>

        {error && <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-xs">{error}</div>}
        {success && <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-xs">{success}</div>}

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Save Password & Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
