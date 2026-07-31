'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface AnalyticsData {
  totalMessages: number
  totalUnlocks: number
  messagesBreakdown: {
    daily: Record<string, number>
    weekly: Record<string, number>
    monthly: Record<string, number>
    yearly: Record<string, number>
  }
  unlocksBreakdown: {
    daily: Record<string, number>
    weekly: Record<string, number>
    monthly: Record<string, number>
    yearly: Record<string, number>
  }
}

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  async function checkAdminAndFetch() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        window.location.href = '/login'
        return
      }

      // Replace with your actual admin email address
      const adminEmail = 'roadecho.admin@gmail.com' 
      if (user.email !== adminEmail) {
        setError('Access Denied: Admin privileges required.')
        setLoading(false)
        return
      }

      setAuthorized(true)
      const res = await fetch('/api/analytics')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics')
      setData(json)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-white text-center bg-slate-950 min-h-screen">Verifying admin access...</div>
  if (error || !authorized) return <div className="p-10 text-red-400 text-center bg-slate-950 min-h-screen">Error: {error || 'Unauthorized'}</div>

  return (
    <div className="max-w-4xl mx-auto p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-white mt-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">RoadEcho Admin Command Center</h1>
        <button onClick={checkAdminAndFetch} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition cursor-pointer">
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-sm">Total Messages Sent</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">{data?.totalMessages || 0}</p>
        </div>
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-sm">Total Vault Unlocks</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{data?.totalUnlocks || 0}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition cursor-pointer ${
              activeTab === tab ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            {tab} Breakdown
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold mb-4 text-slate-300 capitalize">Messages ({activeTab})</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {data?.messagesBreakdown[activeTab] && Object.keys(data.messagesBreakdown[activeTab]).length > 0 ? (
              Object.entries(data.messagesBreakdown[activeTab]).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm font-mono">
                  <span className="text-slate-300">{key}</span>
                  <span className="text-cyan-400 font-bold">{val} msgs</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm italic">No data recorded for this period.</p>
            )}
          </div>
        </div>

        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
          <h2 className="text-lg font-semibold mb-4 text-slate-300 capitalize">Unlocks ({activeTab})</h2>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {data?.unlocksBreakdown[activeTab] && Object.keys(data.unlocksBreakdown[activeTab]).length > 0 ? (
              Object.entries(data.unlocksBreakdown[activeTab]).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm font-mono">
                  <span className="text-slate-300">{key}</span>
                  <span className="text-emerald-400 font-bold">{val} unlocks</span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-sm italic">No data recorded for this period.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
