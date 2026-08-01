'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Plate {
  id: string
  plate_number: string
  state: string
}

interface Message {
  id: string
  license_plate: string
  state_region: string
  country: string
  message: string
  created_at: string
}

interface Submission {
  id: string
  state_region: string
  country: string
  message: string
  created_at: string
}

export default function VaultDashboard() {
  const [plates, setPlates] = useState<Plate[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [hasAccess, setHasAccess] = useState(false)
  const [plateInput, setPlateInput] = useState('')
  const [stateInput, setStateInput] = useState('DE')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUserData()
  }, [])

  async function fetchUserData() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }

    try {
      // 1. Fetch Vault data (plates, received messages, access status)
      const res = await fetch('/api/vault', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to load vault data.')
      } else {
        setPlates(data.plates || [])
        setMessages(data.messages || [])
        setHasAccess(data.hasAccess || false)
      }

      // 2. Fetch user's own sent message history
      const subRes = await fetch('/api/user/submissions', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      const subData = await subRes.json()
      if (subRes.ok) {
        setSubmissions(subData.submissions || [])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load vault data.')
    }

    setLoading(false)
  }

  // --- Stripe Checkout Handler ---
  const handleCheckout = async (type: 'pass' | 'subscription') => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, userId }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to initiate checkout.')
      }
    } catch (err: any) {
      setError('An error occurred during checkout.')
    }
  }

  async function handleClaimPlate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      window.location.href = '/login'
      return
    }

    if (plates.length >= 3) {
      setError('You have reached the maximum limit of 3 claimed plates.')
      return
    }

    const plateNum = plateInput.trim().toUpperCase()
    const plateState = stateInput.trim().toUpperCase()

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          plateNumber: plateNum,
          state: plateState,
          country: 'USA'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to claim plate.')
      } else {
        setPlateInput('')
        fetchUserData()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to claim plate.')
    }
  }

  async function handleReleasePlate(plateId: string) {
    setError(null)
    const { error } = await supabase
      .from('user_plates')
      .delete()
      .eq('id', plateId)

    if (error) {
      setError(error.message)
    } else {
      fetchUserData()
    }
  }

  if (loading) return <div className="p-6 text-white text-center mt-20">Loading vault...</div>

  return (
    <div className="max-w-2xl mx-auto p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-white mt-10 mb-10">
      <h1 className="text-2xl font-bold mb-2">Your Plate Vault & History</h1>
      <p className="text-slate-400 text-sm mb-6">Claim up to 3 license plates and view your complete activity history.</p>

      {/* Upgrade / Checkout Buttons */}
      {!hasAccess && (
        <div className="mb-8 p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="font-semibold text-cyan-400">Unlock Full Access</h3>
            <p className="text-xs text-slate-400">Get a 24-hour pass or subscribe for continuous alerts.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleCheckout('pass')}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg transition text-cyan-300 cursor-pointer"
            >
              24-Hour Pass ($1.99)
            </button>
            <button
              onClick={() => handleCheckout('subscription')}
              className="flex-1 sm:flex-none px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-xs font-bold rounded-lg transition text-slate-950 cursor-pointer"
            >
              Subscribe ($2.99/mo)
            </button>
          </div>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">{error}</div>}

      <form onSubmit={handleClaimPlate} className="mb-8 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-3 flex-1">
          <input
            type="text"
            placeholder="Plate Number"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value)}
            required
            className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white uppercase placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            placeholder="State"
            maxLength={2}
            value={stateInput}
            onChange={(e) => setStateInput(e.target.value)}
            required
            className="w-20 sm:w-24 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white uppercase text-center placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button
          type="submit"
          disabled={plates.length >= 3}
          className="w-full sm:w-auto px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
        >
          Claim ({plates.length}/3)
        </button>
      </form>

      {/* Claimed Plates Section */}
      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-300">Claimed Plates</h2>
        {plates.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No plates claimed yet.</p>
        ) : (
          plates.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <div>
                <span className="font-mono font-bold text-sm tracking-wider text-cyan-400">
                  Secured Vault ID: {p.plate_number.substring(0, 12)}...
                </span>
                <span className="ml-2 px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded">{p.state}</span>
              </div>
              <button
                onClick={() => handleReleasePlate(p.id)}
                className="text-sm text-red-400 hover:text-red-300 transition cursor-pointer"
              >
                Release
              </button>
            </div>
          ))
        )}
      </div>

      {/* Messages Received Section */}
      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-300">Messages Received</h2>
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No messages found for your plates.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>Location: {m.state_region}, {m.country || 'USA'}</span>
                <span>{new Date(m.created_at).toLocaleDateString()}</span>
              </div>

              {hasAccess ? (
                <div className="p-3 bg-slate-900 border border-cyan-500/50 rounded-lg space-y-1">
                  <p className="text-xs text-cyan-400 font-semibold">🔓 Unlocked Message</p>
                  <p className="text-slate-100 text-sm">{m.message}</p>
                </div>
              ) : (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center space-y-2">
                  <p className="text-sm font-semibold text-cyan-400">🔒 Secure Message Waiting in Vault</p>
                  <p className="text-xs text-slate-400">Unlock this message payload or enable continuous alerts below.</p>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      onClick={() => handleCheckout('pass')}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg text-cyan-300 transition cursor-pointer"
                    >
                      Unlock ($1.99)
                    </button>
                    <button
                      onClick={() => handleCheckout('subscription')}
                      className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-xs font-bold rounded-lg text-slate-950 transition cursor-pointer"
                    >
                      Subscribe ($2.99/mo)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* My Sent Submissions History Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-300">Your Sent Message History</h2>
        {submissions.length === 0 ? (
          <p className="text-slate-500 text-sm italic">You haven't sent any messages yet.</p>
        ) : (
          submissions.map((sub) => (
            <div key={sub.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>Destination: {sub.state_region}, {sub.country || 'USA'}</span>
                <span>{new Date(sub.created_at).toLocaleDateString()}</span>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <p className="text-slate-100 text-sm italic">"{sub.message}"</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
