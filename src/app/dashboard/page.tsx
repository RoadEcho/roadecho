'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Plate {
  id: string
  plate_number: string
  state: string
  display_plate?: string
}

interface Message {
  id: string
  license_plate: string
  state_region: string
  country: string
  message: string
  created_at: string
  plate_display?: string
  plate_state?: string
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
  const [availablePasses, setAvailablePasses] = useState(0)
  const [referralCount, setReferralCount] = useState(0)
  const [passExpiresAt, setPassExpiresAt] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  const [plateInput, setPlateInput] = useState('')
  const [stateInput, setStateInput] = useState('DE')
  const [agreedToCheckoutTerms, setAgreedToCheckoutTerms] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedRef, setCopiedRef] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function initSessionAndData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (!isMounted) return

        if (sessionError || !session) {
          window.location.href = '/login'
          return
        }

        const currentUserId = session.user.id
        setUserId(currentUserId)
        setUserEmail(session.user.email || null)

        await fetchVaultData(session.access_token, currentUserId)
      } catch (err: any) {
        console.error('Session init error:', err)
        if (isMounted) {
          setError(err.message || 'Failed to initialize session.')
          setLoading(false)
        }
      }
    }

    initSessionAndData()

    const queryParams = new URLSearchParams(window.location.search)
    if (queryParams.get('success') === 'true') {
      const timer = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) fetchVaultData(session.access_token, session.user.id)
        })
      }, 2500)
      return () => clearTimeout(timer)
    }

    return () => {
      isMounted = false
    }
  }, [])

  // Live countdown timer effect
  useEffect(() => {
    if (!passExpiresAt) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiry = new Date(passExpiresAt).getTime()
      const difference = expiry - now

      if (difference <= 0) {
        setTimeLeft('Expired')
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) fetchVaultData(session.access_token, session.user.id)
        })
      } else {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((difference % (1000 * 60)) / 1000)
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [passExpiresAt])

  async function fetchVaultData(accessToken: string, currentUserId: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/vault', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
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

      const { data: vaultData } = await supabase
        .from('user_pass_vault')
        .select('available_passes, pass_expires_at')
        .eq('user_id', currentUserId)
        .single()

      if (vaultData) {
        setAvailablePasses(vaultData.available_passes || 0)
        setPassExpiresAt(vaultData.pass_expires_at || null)
      }

      const { count: refCount } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', currentUserId)
        .eq('status', 'converted')

      setReferralCount(refCount || 0)

      const subRes = await fetch('/api/user/submissions', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })
      const subData = await subRes.json()
      if (subRes.ok) {
        setSubmissions(subData.submissions || [])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load vault data.')
    } finally {
      setLoading(false)
    }
  }

  const handleActivatePass = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/vault/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (res.ok) {
        setAvailablePasses((prev) => Math.max(0, prev - 1))
        setPassExpiresAt(data.pass_expires_at)
        fetchVaultData(session.access_token, userId)
      } else {
        setError(data.error || 'Failed to activate pass.')
        setLoading(false)
      }
    } catch (err) {
      setError('An error occurred while activating pass.')
      setLoading(false)
    }
  }

  const handleCheckout = async (type: 'pass' | 'subscription') => {
    if (!agreedToCheckoutTerms) {
      setError('You must agree to the terms before purchasing.')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUserId = session?.user?.id

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, userId: currentUserId }),
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
        const referrerId = localStorage.getItem('road_echo_ref')
        if (referrerId && session.user.email) {
          try {
            await fetch('/api/referral/convert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: session.user.email, referrerId }),
            })
            localStorage.removeItem('road_echo_ref')
          } catch (refErr) {
            console.error('Failed to log referral conversion on claim', refErr)
          }
        }

        setPlateInput('')
        fetchVaultData(session.access_token, session.user.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to claim plate.')
    }
  }

  async function handleReleasePlate(plateId: string) {
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { error } = await supabase
      .from('user_plates')
      .delete()
      .eq('id', plateId)

    if (error) {
      setError(error.message)
    } else {
      fetchVaultData(session.access_token, session.user.id)
    }
  }

  const referralLink = userId ? `https://roadecho.vercel.app/?ref=${userId}` : ''
  const isPassActive = passExpiresAt && new Date(passExpiresAt) > new Date()

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
        <div className="text-center space-y-4">
          <div className="text-xl font-bold text-cyan-400">Loading vault...</div>
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-white mt-10 mb-10">
      <div className="mb-4">
        <a href="/" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
          &larr; Send a Secure Message
        </a>
      </div>

      <div className="flex justify-center mb-4">
        <div className="w-56 h-32 overflow-hidden relative rounded-2xl border border-slate-800 shadow-xl flex items-center justify-center bg-slate-950">
          <img src="/logo.PNG" alt="RoadEcho Logo" className="absolute w-72 max-w-none scale-110 translate-y-1 object-cover" />
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-2">Your Plate Vault & History</h1>
      <p className="text-slate-400 text-sm mb-4">Claim up to 3 license plates and view your complete activity history.</p>

      {userEmail && (
        <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-full text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          Logged in as: <span className="font-mono text-cyan-300">{userEmail}</span>
        </div>
      )}

      <div className="mb-8 p-5 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-4">
        <div>
          <h3 className="font-bold text-cyan-400 text-base">🎁 Referral Rewards Vault</h3>
          <p className="text-xs text-slate-400">Earn stored 24-hour passes when 5 friends use your link or someone subscribes!</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
            <p className="text-xl font-black text-cyan-400">{availablePasses}</p>
            <p className="text-xs text-slate-400 mt-0.5">Stored Passes</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
            <p className="text-xl font-black text-cyan-400">{referralCount} <span className="text-xs text-slate-500 font-normal">/ 5</span></p>
            <p className="text-xs text-slate-400 mt-0.5">Referrals</p>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
            <p className="text-xs font-bold text-emerald-400 mt-1 truncate">
              {isPassActive ? timeLeft || 'Active' : 'Inactive'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Pass Status</p>
          </div>
        </div>

        <button
          onClick={handleActivatePass}
          disabled={availablePasses <= 0 || loading}
          className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-40 cursor-pointer"
        >
          Activate 24-Hour Pass From Vault
        </button>

        <div className="pt-2 border-t border-slate-900 space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Unique Referral Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={referralLink}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono select-all"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(referralLink)
                setCopiedRef(true)
                setTimeout(() => setCopiedRef(false), 3000)
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-lg transition whitespace-nowrap cursor-pointer"
            >
              {copiedRef ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div>
            <h3 className="font-semibold text-cyan-400">Unlock Full Access</h3>
            <p className="text-xs text-slate-400">Get an instant 24-hour pass or subscribe for continuous alerts.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => handleCheckout('pass')}
              disabled={!agreedToCheckoutTerms}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg transition text-cyan-300 cursor-pointer disabled:opacity-40"
            >
              24-Hour Pass ($1.99)
            </button>
            <button
              onClick={() => handleCheckout('subscription')}
              disabled={!agreedToCheckoutTerms}
              className="flex-1 sm:flex-none px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-xs font-bold rounded-lg transition text-slate-950 cursor-pointer disabled:opacity-40"
            >
              Subscribe ($2.99/mo)
            </button>
          </div>
        </div>

        <div className="flex items-start space-x-2 text-xs text-slate-400 pt-2 border-t border-slate-900">
          <input
            type="checkbox"
            id="checkout-terms"
            checked={agreedToCheckoutTerms}
            onChange={(e) => setAgreedToCheckoutTerms(e.target.checked)}
            className="mt-0.5 accent-cyan-500 cursor-pointer"
          />
          <label htmlFor="checkout-terms" className="cursor-pointer leading-relaxed">
            Fees cover secure digital decryption, delivery, and alerts. I agree to the{' '}
            <a href="/terms" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Terms of Service</a> and{' '}
            <a href="/privacy" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">Privacy Policy</a>.
          </label>
        </div>
      </div>

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

      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-300">Claimed Plates</h2>
        {plates.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No plates claimed yet.</p>
        ) : (
          plates.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl">
              <div>
                <span className="font-mono font-bold text-sm tracking-wider text-cyan-400">
                  {p.display_plate || p.plate_number.substring(0, 12)}
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

      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-slate-300">Messages Received</h2>
        {messages.length === 0 ? (
          <p className="text-slate-500 text-sm italic">No messages found for your plates.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row justify-between text-xs text-slate-400 font-mono gap-1 border-b border-slate-900 pb-2">
                <div>
                  <span className="text-cyan-400 font-bold">Plate:</span> {m.plate_display || m.license_plate.substring(0, 12)} ({m.plate_state || m.state_region})
                </div>
                <div>
                  <span className="text-cyan-400 font-bold">Received:</span> {new Date(m.created_at).toLocaleString()}
                </div>
              </div>

              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>Location Sent: {m.state_region}, {m.country || 'USA'}</span>
              </div>

              {hasAccess || isPassActive ? (
                <div className="p-3 bg-slate-900 border border-cyan-500/50 rounded-lg space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-cyan-400 font-semibold">🔓 Unlocked Message</p>
                    {isPassActive && (
                      <span className="text-xs font-mono text-emerald-400">
                        Expires in: {timeLeft}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-100 text-sm">{m.message}</p>
                </div>
              ) : (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center space-y-2">
                  <p className="text-sm font-semibold text-cyan-400">🔒 Secure Message Waiting in Vault</p>
                  <p className="text-xs text-slate-400">Unlock this message payload or enable continuous alerts below.</p>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      onClick={() => handleCheckout('pass')}
                      disabled={!agreedToCheckoutTerms}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-lg text-cyan-300 transition cursor-pointer disabled:opacity-40"
                    >
                      Unlock ($1.99)
                    </button>
                    <button
                      onClick={() => handleCheckout('subscription')}
                      disabled={!agreedToCheckoutTerms}
                      className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-xs font-bold rounded-lg text-slate-950 transition cursor-pointer disabled:opacity-40"
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

      <div className="space-y-4 mb-8">
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

      <div className="border-t border-slate-800 pt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-400">
        <a href="/faq" className="hover:text-cyan-400 transition-colors">FAQ</a>
        <span>&bull;</span>
        <a href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</a>
        <span>&bull;</span>
        <a href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</a>
      </div>
    </div>
  )
}
