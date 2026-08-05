import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = (searchParams.get('type') || 'magiclink') as any

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = '/dashboard'
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')

  if (token_hash) {
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
            } catch {}
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // Fetch verified user details to trigger admin alert safely without blocking redirect
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          const adminEmail = 'roadecho.admin@gmail.com'
          console.log(`NEW USER VERIFIED SIGNUP: ${user.email} (ID: ${user.id}) -> Notifying ${adminEmail}`)

          // If you use an email provider like Resend, you can dispatch the notification here:
          if (process.env.RESEND_API_KEY) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
              },
              body: JSON.stringify({
                from: 'RoadEcho <noreply@roadecho.app>',
                to: [adminEmail],
                subject: `New User Registration Verified: ${user.email}`,
                html: `<p>A new user has successfully verified their account on RoadEcho:</p><ul><li><strong>Email:</strong> ${user.email}</li><li><strong>User ID:</strong> ${user.id}</li><li><strong>Time:</strong> ${new Date().toISOString()}</li></ul>`
              })
            }).catch(err => console.error('Email dispatch error:', err))
          }
        }
      } catch (alertErr) {
        console.error('Error handling signup notification:', alertErr)
      }

      return NextResponse.redirect(redirectTo)
    }
  }

  redirectTo.pathname = '/login'
  redirectTo.searchParams.set('error', 'Login link expired or invalid. Please request a new one.')
  return NextResponse.redirect(redirectTo)
}
