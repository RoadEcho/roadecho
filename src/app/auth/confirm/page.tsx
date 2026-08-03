'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { EmailOtpType } from '@supabase/supabase-js'

function AuthConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function handleAuthConfirm() {
      try {
        const token_hash = searchParams.get('token_hash')
        const type = searchParams.get('type') as EmailOtpType | null
        const next = searchParams.get('next') ?? '/dashboard'

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type,
          })

          if (error) throw error

          router.push(next)
          return
        }

        const code = searchParams.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          router.push(next)
          return
        }

        throw new Error('Invalid authentication link or missing parameters.')
      } catch (err: any) {
        console.error('Auth confirmation error:', err)
        setErrorMsg(err.message || 'Authentication failed. Please request a new magic link.')
        setLoading(false)
      }
    }

    handleAuthConfirm()
  }, [router, searchParams])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
        <div className="text-center space-y-4">
          <div className="text-xl font-bold text-cyan-400">Verifying your secure link...</div>
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl text-center space-y-4">
        <h1 className="text-xl font-bold text-red-400">Authentication Error</h1>
        <p className="text-sm text-slate-300">{errorMsg}</p>
        <div className="pt-4">
          <a
            href="/login"
            className="inline-block px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition text-xs"
          >
            Return to Login
          </a>
        </div>
      </div>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
        <div className="text-center space-y-4">
          <div className="text-xl font-bold text-cyan-400">Loading...</div>
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    }>
      <AuthConfirmContent />
    </Suspense>
  )
}
