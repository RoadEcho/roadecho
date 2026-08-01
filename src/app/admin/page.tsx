'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

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

interface UserStats {
  totalUsers: number
  activeUsers: number
  users: Array<{
    id: string
    email: string
    createdAt: string
    lastSignIn: string | null
  }>
}

export default function AdminDashboard() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  async function checkAdminAndFetch() {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      // 1. If no session exists at all, redirect to login
      if (!session || !session.user) {
        router.push('/login')
        return
      }

      // 2. If logged in with the wrong account, sign out and redirect to login
      const adminEmail = 'roadecho.admin@gmail.com' 
      if (session.user.email !== adminEmail) {
        await supabase.auth.signOut()
        router.push('/login')
        return
      }

      // 3. Fetch analytics using secure bearer token
      const res = await fetch('/api/analytics', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics')
      setData(json)

      // 4. Fetch user stats and directory
      const userRes = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const userJson = await userRes.json()
      if (userRes.ok) {
        setUserStats(userJson)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="p-10 text-white text-center bg-slate-950 min-h-screen">Verifying secure admin access...</div>
  if (error) return <div className="p-10 text-red-400 text-center bg-slate-950 min-h-screen">Access Denied: {error}</div>

  return (
    <div className="max-w-4xl mx-auto p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-white mt-10 mb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">RoadEcho Admin Command Center</h1>
        <button onClick={checkAdminAndFetch} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition cursor-pointer">
          Refresh Data
        </button>
      </div>

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Total Messages</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">{data?.totalMessages || 0}</p>
        </div>
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Total Unlocks</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{data?.totalUnlocks || 0}</p>
        </div>
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Total Accounts</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{userStats?.totalUsers || 0}</p>
        </div>
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider">Active (30 Days)</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{userStats?.activeUsers || 0}</p>
        </div>
      </div>

      {/* Message & Unlock Breakdowns */}
      <div className="grid grid-cols-2 sm:flex gap-2 mb-6 border-b border-slate-800 pb-4">
        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition cursor-pointer text-center ${
              activeTab === tab ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            {tab} Breakdown
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

      {/* User Directory Section */}
      <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl">
        <h2 className="text-lg font-semibold mb-4 text-slate-300">Registered User Directory</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {userStats?.users && userStats.users.length > 0 ? (
            userStats.users.map(u => (
              <div key={u.id} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-lg text-sm">
                <div>
                  <p className="font-medium text-white">{u.email}</p>
                  <p className="text-xs text-slate-500">Joined: {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right text-xs text-slate-400 font-mono">
                  Last Active: {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : 'Never'}
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-500 text-sm italic">No registered users found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
