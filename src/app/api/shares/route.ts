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

    // Query the 'shares' table
    const { data: shares, error } = await supabase
      .from('shares')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    // Fetch auth users safely for email mapping
    const { data: authData } = await supabase.auth.admin.listUsers()
    const authUsers = authData?.users || []
    
    const emailMap = new Map<string, string>(
      authUsers.map((u): [string, string] => [u.id, u.email || 'Unknown'])
    )

    const formattedShares = (shares || []).map((s: any) => {
      const createdAt = new Date(s.created_at || s.timestamp || Date.now())

      return {
        id: s.id,
        email: emailMap.get(s.user_id) || s.email || 'Anonymous User',
        licensePlate: s.license_plate || s.plate || 'N/A',
        platform: s.platform || 'Web App',
        createdAt: createdAt.toISOString(),
      }
    })

    return NextResponse.json({ shares: formattedShares })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { user_id, plate, license_plate, platform } = body

    const { error } = await supabase
      .from('shares')
      .insert([{ 
        user_id: user_id || null, 
        plate: plate || license_plate || null,
        platform: platform || 'web',
        created_at: new Date().toISOString() 
      }])

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
