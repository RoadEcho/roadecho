import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase environment variables.' },
        { status: 500 }
      )
    }

    // 1. Verify admin user existence in admin_users using service role (bypasses RLS securely)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

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

    // 2. Set up SSR cookies
    const cookieStore = cookies()
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    })

    // 3. Authenticate credentials via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (authError || !authData.session) {
      return NextResponse.json(
        { error: authError?.message || 'Invalid login credentials.' },
        { status: 401 }
      )
    }

    // 4. Record login activity in user_logins
    try {
      await supabaseAdmin.from('user_logins').insert({
        user_id: authData.user.id,
        email: cleanEmail,
      })
    } catch {
      // Non-blocking log failure
    }

    // Return success and session so client-side storage can sync
    const res = NextResponse.json({ success: true, session: authData.session })
    
    cookieStore.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value)
    })

    return res
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
