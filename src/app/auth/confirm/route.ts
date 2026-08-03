import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('code')
  redirectTo.searchParams.delete('next')

  if (token_hash || code) {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    )

    let error = null

    // 1. Verify via token_hash if present (Cross-browser / mobile app resilient)
    if (token_hash && type) {
      const res = await supabase.auth.verifyOtp({
        type,
        token_hash,
      })
      error = res.error
    } 
    // 2. Fallback to exchanging PKCE code if present
    else if (code) {
      const res = await supabase.auth.exchangeCodeForSession(code)
      error = res.error
    }

    if (!error) {
      return NextResponse.redirect(redirectTo)
    }
  }

  // If verification fails, redirect back to login with a clean error message
  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'Unable to verify login link. Please request a new link.')
  return NextResponse.redirect(redirectTo)
}
