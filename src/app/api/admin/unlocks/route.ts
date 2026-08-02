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

    // Try querying 'user_access' first
    let { data: unlocks, error } = await supabase
      .from('user_access')
      .select('id, user_id, license_plate, created_at')
      .order('created_at', { ascending: false })
      .limit(50)

    // Fallback to 'unlocks' table if user_access is empty or errors out
    if (error || !unlocks || unlocks.length === 0) {
      const altQuery = await supabase
        .from('unlocks')
        .select('id, user_id, license_plate, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!altQuery.error) {
        unlocks = altQuery.data
      }
    }

    // Fetch auth users safely
    const { data: authData } = await supabase.auth.admin.listUsers()
    const authUsers = authData?.users || []
    
    // Explicitly type the mapped tuple array for the Map constructor
    const emailMap = new Map<string, string>(
      authUsers.map((u): [string, string] => [u.id, u.email || 'Unknown'])
    )

    const formattedUnlocks = (unlocks || []).map(u => ({
      id: u.id,
      email: emailMap.get(u.user_id) || 'Unknown User',
      licensePlate: u.license_plate || u.plate || 'N/A',
      createdAt: u.created_at || u.timestamp
    }))

    return NextResponse.json({ unlocks: formattedUnlocks })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
