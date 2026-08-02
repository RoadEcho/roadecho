import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)

    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 })
    }

    // Fetch unlock records ordered by newest first
    const { data: unlocks, error } = await supabase
      .from('user_access')
      .select('id, user_id, license_plate, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // Fetch auth users to map user_id to email addresses easily
    const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
    const emailMap = new Map(authUsers.map(u => [u.id, u.email]))

    const formattedUnlocks = (unlocks || []).map(u => ({
      id: u.id,
      email: emailMap.get(u.user_id) || 'Unknown User',
      licensePlate: u.license_plate || 'N/A',
      createdAt: u.created_at
    }))

    return NextResponse.json({ unlocks: formattedUnlocks })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
