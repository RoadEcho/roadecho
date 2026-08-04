import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authErr } = await supabase.auth.getUser(token)

    if (authErr || !requestingUser || !requestingUser.email) {
      return NextResponse.json({ error: 'Access denied. Invalid session.' }, { status: 403 })
    }

    // Verify the requesting user is actually in the admin_users table
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', requestingUser.email.toLowerCase())
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Access denied. Only authorized administrators can add new admins.' }, { status: 403 })
    }

    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    // 1. Invite user via Supabase Auth (redirects to password setup page)
    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo: `${new URL(request.url).origin}/admin/update-password`
    })

    if (inviteError) throw inviteError

    // 2. Add them to the admin_users table so they appear in the directory list
    const { error: dbError } = await supabase
      .from('admin_users')
      .upsert([{ email: cleanEmail }], { onConflict: 'email' })

    if (dbError) throw dbError

    return NextResponse.json({ success: true, message: `Admin invitation sent to ${cleanEmail}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create admin.' }, { status: 500 })
  }
}
