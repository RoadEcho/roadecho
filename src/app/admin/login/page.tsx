'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)

  useEffect(() => {
    async function loadAdminSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setAdminEmail(session.user.email || null)
        }
      } catch (err) {
        console.error('Session load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAdminSession()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-sm text-slate-400 animate-pulse">Loading Admin Command Center...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <header className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold">RoadEcho Admin Command</h1>
          <p className="text-xs text-slate-400 mt-1">Logged in as: {adminEmail || 'Administrator'}</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Sign Out
        </button>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">System Status</h2>
          <p className="text-2xl font-bold text-emerald-400">Operational</p>
        </div>
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Auth Sync</h2>
          <p className="text-2xl font-bold text-cyan-400">SSR Active</p>
        </div>
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Security</h2>
          <p className="text-2xl font-bold text-indigo-400">Protected</p>
        </div>
      </main>
    </div>
  )
}
