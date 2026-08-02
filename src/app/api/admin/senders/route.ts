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

    // Fetch messages to aggregate sender data
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fetch auth users to map user IDs to email addresses
    const { data: authData } = await supabase.auth.admin.listUsers()
    const authUsers = authData?.users || []
    
    const emailMap = new Map<string, string>(
      authUsers.map((u): [string, string] => [u.id, u.email || 'Unknown'])
    )

    // Aggregate sender statistics
    const senderMap = new Map<string, { email: string; messageCount: number; lastMessageAt: string }>()

    for (const msg of (messages || [])) {
      const userId = msg.user_id || msg.sender_id || msg.sender_uuid
      const rawEmail = msg.email || (userId ? emailMap.get(userId) : null) || 'Anonymous'

      if (!senderMap.has(rawEmail)) {
        senderMap.set(rawEmail, {
          email: rawEmail,
          messageCount: 0,
          lastMessageAt: msg.created_at || msg.timestamp || new Date().toISOString()
        })
      }

      const entry = senderMap.get(rawEmail)!
      entry.messageCount += 1

      const msgTime = new Date(msg.created_at || msg.timestamp || 0).getTime()
      const existingTime = new Date(entry.lastMessageAt).getTime()
      if (msgTime > existingTime) {
        entry.lastMessageAt = msg.created_at || msg.timestamp
      }
    }

    const senders = Array.from(senderMap.values()).sort((a, b) => 
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    )

    return NextResponse.json({ senders })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
