'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

interface AnalyticsData {
  totalMessages: number
  uniquePlatesCount: number
  totalUnlocks: number
  totalSubscribers: number
  totalShares: number
  totalReferrals: number
  totalLogins: number
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
  sharesBreakdown: {
    daily: Record<string, number>
    weekly: Record<string, number>
    monthly: Record<string, number>
    yearly: Record<string, number>
  }
  loginsBreakdown: {
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

interface AdminUser {
  id: string
  email: string
  created_at: string
}

interface SenderUser {
  email: string
  messageCount: number
  lastMessageAt: string
}

interface UnlockRecord {
  id: string
  email: string
  licensePlate: string
  createdAt: string
  expiresAt: string
  timeLeft: string
  isExpired: boolean
  status: string
  transactionRef: string
}

interface ShareRecord {
  id: string
  user_id: string | null
  email?: string
  licensePlate?: string
  platform: string
  created_at: string
  metadata?: any
}

interface MessageRecord {
  id: string
  email?: string
  plate_hash?: string
  license_plate?: string
  message?: string
  state?: string
  country?: string
  created_at: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [senders, setSenders] = useState<SenderUser[]>([])
  const [unlocksList, setUnlocksList] = useState<UnlockRecord[]>([])
  const [sharesList, setSharesList] = useState<ShareRecord[]>([])
  const [messagesList, setMessagesList] = useState<MessageRecord[]>([])
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily')

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  async function checkAdminAndFetch() {
    try {
      setLoading(true)
      setError(null)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session || !session.user || !session.user.email) {
        router.push('/admin/login')
        return
      }

      setAdminEmail(session.user.email)

      const { data: adminRecord, error: adminErr } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', session.user.email)
        .single()

      if (adminErr || !adminRecord) {
        await supabase.auth.signOut()
        router.push('/admin/login')
        return
      }

      const res = await fetch('/api/analytics', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics')
      setData(json)

      // Fetch granular message logs directly from Supabase to ensure they load reliably
      const { data: msgRows } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
      if (msgRows) {
        setMessagesList(msgRows)
      }

      // Fetch user logins directly and compute breakdowns
      const { data: loginsRows } = await supabase
        .from('user_logins')
        .select('*')
        .order('created_at', { ascending: false })

      const dailyLogins: Record<string, number> = {}
      const weeklyLogins: Record<string, number> = {}
      const monthlyLogins: Record<string, number> = {}
      const yearlyLogins: Record<string, number> = {}

      if (loginsRows) {
        loginsRows.forEach(item => {
          const date = new Date(item.created_at)
          const dayKey = date.toISOString().split('T')[0]
          const monthKey = dayKey.substring(0, 7)
          const yearKey = dayKey.substring(0, 4)

          dailyLogins[dayKey] = (dailyLogins[dayKey] || 0) + 1
          monthlyLogins[monthKey] = (monthlyLogins[monthKey] || 0) + 1
          yearlyLogins[yearKey] = (yearlyLogins[yearKey] || 0) + 1

          const d = new Date(date)
          d.setHours(0,0,0,0)
          d.setDate(d.getDate() - d.getDay())
          const weekKey = `Week of ${d.toISOString().split('T')[0]}`
          weeklyLogins[weekKey] = (weeklyLogins[weekKey] || 0) + 1
        })
      }

      setData(prev => prev ? {
        ...prev,
        totalLogins: loginsRows?.length || 0,
        loginsBreakdown: {
          daily: dailyLogins,
          weekly: weeklyLogins,
          monthly: monthlyLogins,
          yearly: yearlyLogins
        }
      } : prev)

      const userRes = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const userJson = await userRes.json()
      if (userRes.ok) {
        setUserStats(userJson.userStats || userJson)
        if (userJson.admins) {
          setAdmins(userJson.admins)
        }
      }

      const adminRes = await fetch('/api/admin/users-list', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (adminRes.ok) {
        const adminData = await adminRes.json()
        setAdmins(adminData.admins || [])
      }

      const senderRes = await fetch('/api/admin/senders', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (senderRes.ok) {
        const senderData = await senderRes.json()
        setSenders(senderData.senders || [])
      }

      const unlocksRes = await fetch('/api/admin/unlocks', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (unlocksRes.ok) {
        const unlockData = await unlocksRes.json()
        const items = unlockData.unlocks || []
        setUnlocksList(items)
        setData(prev => prev ? { ...prev, totalUnlocks: items.length } : prev)
      }

      const sharesRes = await fetch('/api/shares', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (sharesRes.ok) {
        const shareData = await sharesRes.json()
        setSharesList(shareData.shares || [])
        if (shareData.count !== undefined && data) {
          setData(prev => prev ? { ...prev, totalShares: shareData.count } : prev)
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email: newEmail })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to add admin')

      setSuccess(`Admin invitation sent to ${newEmail}`)
      setNewEmail('')
      checkAdminAndFetch()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleRemoveAdmin(emailToRemove: string) {
    setError(null)
    setSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      const res = await fetch('/api/admin/remove', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ email: emailToRemove })
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to remove admin')

      setAdmins(prev => prev.filter(adm => adm.email !== emailToRemove))
      setSuccess('Admin removed successfully.')
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you sure you want to permanently delete this user account? This action cannot be undone.')) {
      return
    }

    setError(null)
    setSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/admin/login')
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete user')

      setSuccess('User deleted successfully.')
      checkAdminAndFetch()
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    }
  }

  if (loading) return <div className="p-10 text-white text-center bg-slate-950 min-h-screen">Verifying secure admin access...</div>
  if (error && !data) return <div className="p-10 text-red-400 text-center bg-slate-950 min-h-screen">Access Denied: {error}</div>

  const resolvedTotalUnlocks = unlocksList.length > 0 ? unlocksList.length : (data?.totalUnlocks || 0)

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-white my-8">
      
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-xl mb-6">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-cyan-400 flex items-center gap-2">
            🔒 RoadEcho Admin Command Center
          </h1>
          {adminEmail && (
            <p className="text-xs text-slate-400 mt-1">
              Logged in as: <span className="text-cyan-400 font-medium">{adminEmail}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/dashboard"
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-bold transition cursor-pointer"
          >
            🚗 Go to Vault
          </a>
          <button onClick={checkAdminAndFetch} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer">
            Refresh Data
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/admin/login'); }} className="px-3 py-1.5 bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800 rounded-lg text-xs font-semibold transition cursor-pointer">
            Sign Out
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-xs">{error}</div>}
      {success && <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 text-xs">{success}</div>}

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Messages</p>
          <p className="text-2xl font-black text-cyan-400 mt-1">{messagesList.length > 0 ? messagesList.length : (data?.totalMessages || 0)}</p>
        </div>
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Plates Messaged</p>
          <p className="text-2xl font-black text-blue-400 mt-1">{data?.uniquePlatesCount || 0}</p>
        </div>
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Unlocks</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{resolvedTotalUnlocks}</p>
        </div>
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Subscribers</p>
          <p className="text-2xl font-black text-cyan-300 mt-1">{data?.totalSubscribers || 0}</p>
        </div>
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Shares</p>
          <p className="text-2xl font-black text-teal-400 mt-1">{sharesList.length > 0 ? sharesList.length : (data?.totalShares || 0)}</p>
        </div>
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Referrals</p>
          <p className="text-2xl font-black text-pink-400 mt-1">{data?.totalReferrals || 0}</p>
        </div>
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Logins</p>
          <p className="text-2xl font-black text-indigo-400 mt-1">{data?.totalLogins || 0}</p>
        </div>
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Accounts</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{userStats?.totalUsers || 0}</p>
        </div>
      </div>

      {/* Timeframe Switcher Tabs & Condensed Breakdowns */}
      <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Activity Breakdowns</h2>
          <div className="flex gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md font-semibold capitalize transition cursor-pointer ${
                  activeTab === tab ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase">Messages ({activeTab})</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {data?.messagesBreakdown?.[activeTab] && Object.keys(data.messagesBreakdown[activeTab]).length > 0 ? (
                Object.entries(data.messagesBreakdown[activeTab]).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300">{key}</span>
                    <span className="text-cyan-400 font-bold">{val} msgs</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No records.</p>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase">Unlocks ({activeTab})</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {data?.unlocksBreakdown?.[activeTab] && Object.keys(data.unlocksBreakdown[activeTab]).length > 0 ? (
                Object.entries(data.unlocksBreakdown[activeTab]).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300">{key}</span>
                    <span className="text-emerald-400 font-bold">{val} unlocks</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No records.</p>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase">Shares ({activeTab})</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {data?.sharesBreakdown?.[activeTab] && Object.keys(data.sharesBreakdown[activeTab]).length > 0 ? (
                Object.entries(data.sharesBreakdown[activeTab]).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300">{key}</span>
                    <span className="text-teal-400 font-bold">{val} shares</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No records.</p>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase">Logins ({activeTab})</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {data?.loginsBreakdown?.[activeTab] && Object.keys(data.loginsBreakdown[activeTab]).length > 0 ? (
                Object.entries(data.loginsBreakdown[activeTab]).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300">{key}</span>
                    <span className="text-indigo-400 font-bold">{val} logins</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic">No records.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Team Management Section */}
      <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl mb-6 space-y-3">
        <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Manage Administrator Team</h2>
        <p className="text-xs text-slate-400">Enter an email address to dispatch an automated password-setup invitation.</p>
        
        <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="new.admin@gmail.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="w-full sm:flex-1 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
          />
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap"
          >
            Send Admin Invite
          </button>
        </form>

        <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
          {admins.length > 0 ? (
            admins.map((adm) => (
              <div key={adm.id} className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                <span className="font-mono text-cyan-300 truncate pr-2">{adm.email}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAdmin(adm.email)}
                  className="text-red-400 hover:text-red-300 transition cursor-pointer shrink-0"
                >
                  Remove
                </button>
              </div>
            ))
          ) : (
            <p className="text-slate-500 text-xs italic">No additional admins listed.</p>
          )}
        </div>
      </div>

      {/* Logs & Directories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        
        {/* Granular Messages Sent Log */}
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Granular Messages Sent Log</h2>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {messagesList.length > 0 ? (
              messagesList.map((msg) => (
                <div key={msg.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-[11px] text-cyan-300">Location: {msg.state ? `${msg.state}, ${msg.country || 'USA'}` : (msg.country || 'USA')}</p>
                      <p className="text-[11px] text-slate-300 mt-0.5 truncate max-w-[200px]">
                        "{msg.message || 'No message content'}"
                      </p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 uppercase tracking-wide">
                      {msg.state || msg.country || 'USA'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/80 flex justify-between">
                    <span>{new Date(msg.created_at).toLocaleString()}</span>
                    <span className="text-slate-400">{msg.email || 'Anonymous'}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs italic text-center py-4">No message logs recorded.</p>
            )}
          </div>
        </div>

        {/* Message Senders Directory */}
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Message Senders Directory</h2>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {senders.length > 0 ? (
              senders.map((s, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                  <div>
                    <p className="font-medium text-white">{s.email}</p>
                    <p className="text-[11px] text-slate-500">Total Sent: {s.messageCount}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(s.lastMessageAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs italic text-center py-4">No message senders recorded.</p>
            )}
          </div>
        </div>

        {/* Vault Unlocks Log */}
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Vault Unlocks Directory</h2>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {unlocksList.length > 0 ? (
              unlocksList.map((item) => (
                <div key={item.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-white">{item.email}</p>
                      <p className="text-[11px] text-cyan-400 font-mono">Plate: {item.licensePlate}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      item.isExpired ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}>
                      {item.timeLeft || item.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs italic text-center py-4">No vault unlocks recorded.</p>
            )}
          </div>
        </div>

        {/* Granular Shares Log */}
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Granular Shares Log</h2>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {sharesList.length > 0 ? (
              sharesList.map((share) => (
                <div key={share.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-[11px] text-slate-300">ID: {share.id.slice(0, 8)}...</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        User: {share.user_id ? `${share.user_id.slice(0, 8)}...` : 'Anonymous'}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-950 text-teal-300 border border-teal-800 uppercase tracking-wide">
                      {share.platform || 'general'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/80 flex justify-between">
                    <span>{new Date(share.created_at).toLocaleString()}</span>
                    {share.email && <span>{share.email}</span>}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs italic text-center py-4">No share logs recorded.</p>
            )}
          </div>
        </div>

        {/* Registered User Directory */}
        <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-3 md:col-span-2">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-wide">Registered User Directory</h2>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {userStats?.users && userStats.users.length > 0 ? (
              userStats.users.map(u => (
                <div key={u.id} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                  <div>
                    <span className="font-medium text-white block max-w-[160px] sm:max-w-xs truncate">{u.email}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Joined: {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u.id)}
                    className="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 rounded-md font-semibold transition cursor-pointer shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs italic text-center py-4">No registered users found.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
