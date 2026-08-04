import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)

    if (authErr || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify requester is an admin in admin_users table
    const { data: adminRecord, error: adminErr } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single()

    if (adminErr || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Resolve params (handles both synchronous and Next.js Promise-based params)
    const params = await Promise.resolve(context.params)
    const rawId = params.id

    if (!rawId) {
      return NextResponse.json({ error: 'User ID or email is required' }, { status: 400 })
    }

    let authUserId = rawId
    let userEmail: string | null = null

    // Resolve whether rawId is an email or UUID
    if (rawId.includes('@')) {
      userEmail = rawId
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers()
      const found = listData?.users?.find(u => u.email?.toLowerCase() === rawId.toLowerCase())
      if (found) {
        authUserId = found.id
        userEmail = found.email || userEmail
      }
    } else {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(rawId)
      if (userData?.user) {
        userEmail = userData.user.email || null
      }
    }

    // 1. Delete user from Supabase Auth
    if (authUserId) {
      const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
      if (deleteAuthErr) {
        console.warn(`Auth deletion warning for user ${authUserId}:`, deleteAuthErr.message)
      }
    }

    // 2. Comprehensive cleanup across all public tables using both ID and email
    const tables = [
      'user_plates',
      'plate_vault',
      'passes',
      'subscriptions',
      'unlocks',
      'user_credits',
      'user_logins',
      'user_pass_vault',
      'user_passes',
      'user_milestone_claims',
      'reward_events',
      'shares'
    ]

    const idTargets = [authUserId, rawId].filter(Boolean)

    for (const targetId of idTargets) {
      for (const table of tables) {
        await supabaseAdmin.from(table).delete().eq('user_id', targetId)
      }
      await supabaseAdmin.from('user_access').delete().eq('id', targetId)
      await supabaseAdmin.from('users').delete().eq('id', targetId)
      await supabaseAdmin.from('admin_users').delete().eq('id', targetId)
    }

    if (userEmail) {
      await supabaseAdmin.from('admin_users').delete().eq('email', userEmail)
      await supabaseAdmin.from('users').delete().eq('email', userEmail)
      await supabaseAdmin.from('user_access').delete().eq('email', userEmail)
    }

    return NextResponse.json({ success: true, message: 'User completely purged from system' })
  } catch (err: any) {
    console.error('API Error deleting user:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete user' }, { status: 500 })
  }
}
