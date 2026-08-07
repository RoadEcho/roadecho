import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server config error: Missing Supabase URL or Service Role Key.' },
        { status: 500 }
      )
    }

    // Initialize Supabase Service Role client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const cleanEmail = email.trim().toLowerCase()

    // 1. Verify if the email exists in the admin_users table
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (adminError || !adminCheck) {
      return NextResponse.json(
        { error: `Access denied: "${cleanEmail}" is not authorized as an administrator.` },
        { status: 403 }
      )
    }

    // 2. Authenticate credentials via Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (authError || !authData.session) {
      return NextResponse.json(
        { error: `Auth Error: ${authError?.message || 'Invalid login credentials'}` },
        { status: 401 }
      )
    }

    // 3. Set Supabase auth cookies so middleware and server components recognize the session
    const cookieStore = cookies()
    const supabaseProjectId = new URL(supabaseUrl).hostname.split('.')[0]
    const cookieName = `sb-${supabaseProjectId}-auth-token`

    const sessionValue = JSON.stringify([
      authData.session.access_token,
      authData.session.refresh_token,
      null,
      null,
      null
    ])

    cookieStore.set(cookieName, sessionValue, {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    // Record login activity
    await supabaseAdmin.from('user_logins').insert({
      user_id: authData.user.id,
      email: cleanEmail,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: `Fatal Error: ${err.message}` }, { status: 500 })
  }
}
