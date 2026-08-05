import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
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

    const { data: adminRecord, error: adminErr } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single()

    if (adminErr || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    if (cleanEmail === user.email.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot remove yourself as an admin.' }, { status: 400 })
    }

    const { error: dbError } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('email', cleanEmail)

    if (dbError) throw dbError

    const { data: listUsersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (!listErr && listUsersData?.users) {
      const usersArray = listUsersData.users as any[]
      const targetUser = usersArray.find(u => u.email?.toLowerCase() === cleanEmail)
      if (targetUser) {
        await supabaseAdmin.auth.admin.deleteUser(targetUser.id)
      }
    }

    return NextResponse.json({ success: true, message: 'Admin removed successfully' })
  } catch (err: any) {
    console.error('API Error removing admin:', err)
    return NextResponse.json({ error: err.message || 'Failed to remove admin' }, { status: 500 })
  }
}
