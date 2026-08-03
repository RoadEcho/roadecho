'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AuthConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Verifying your secure login link...')

  useEffect(() => {
    async function handleAuthConfirm() {
      try {
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        const tokenHash = searchParams.get('token_hash') || searchParams.get('token')
        const type = searchParams.get('type') as any

        // Check hash fragment (e.g. #access_token=...&refresh_token=...)
        const hash = window.location.hash
        if (hash) {
          const hashParams = new URLSearchParams(hash.replace('#', ''))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (error) throw error
            router.replace('/dashboard')
            return
          }
        }

        // Handle Token Hash / PKCE code passed via token or token_hash query params
        if (tokenHash) {
          if (tokenHash.startsWith('pkce_')) {
            const { error } = await supabase.auth.exchangeCodeForSession(tokenHash)
            if (error) throw error
            router.replace('/dashboard')
            return
          } else {
            const { error } = await supabase.auth.verifyOtp({
              type: type || 'magiclink',
              token_hash: tokenHash,
            })
            if (error) throw error
            router.replace('/dashboard')
            return
          }
        }

        // Handle standard PKCE authorization code parameter
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          router.replace('/dashboard')
          return
        }

        // Fallback: Check if session already exists
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.replace('/dashboard')
          return
        }

        throw new Error('No authentication parameters found.')
      } catch (err: any) {
        console.error('Auth confirmation error:', err)
        router.replace('/login?error=' + encodeURIComponent(err.message || 'Unable to verify login link. Please request a new link.'))
      }
    }

    handleAuthConfirm()
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
      <div className="w-full max-w-md p-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-center space-y-4">
        <h1 className="text-xl font-bold text-cyan-400">RoadEcho Authentication</h1>
        <p className="text-sm text-slate-300">{status}</p>
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}
