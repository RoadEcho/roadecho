import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing session token.' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired session.' }, { status: 401 })
    }

    const { data: adminRecord, error: adminError } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single()

    if (adminError || !adminRecord) {
      return NextResponse.json({ error: 'Forbidden: Admin access restricted.' }, { status: 403 })
    }

    // Fetch records using exact existing column schemas per table
    const [
      messagesRes, 
      passesRes, 
      unlocksTableRes, 
      userPassesRes, 
      passVaultRes, 
      sharesRes, 
      referralsRes, 
      subsRes
    ] = await Promise.all([
      supabase.from('messages').select('plate_hash, license_plate, created_at'),
      supabase.from('passes').select('created_at'),
      supabase.from('unlocks').select('created_at'),
      supabase.from('user_passes').select('updated_at'),
      supabase.from('user_pass_vault').select('available_passes, pass_expires_at, updated_at'),
      supabase.from('shares').select('created_at'),
      supabase.from('referrals').select('created_at'),
      supabase.from('subscriptions').select('created_at', { count: 'exact', head: true }).eq('status', 'active')
    ])

    if (
      messagesRes.error || 
      passesRes.error || 
      unlocksTableRes.error || 
      userPassesRes.error || 
      passVaultRes.error || 
      sharesRes.error || 
      referralsRes.error || 
      subsRes.error
    ) {
      throw new Error(
        messagesRes.error?.message || 
        passesRes.error?.message || 
        unlocksTableRes.error?.message || 
        userPassesRes.error?.message || 
        passVaultRes.error?.message || 
        sharesRes.error?.message || 
        referralsRes.error?.message || 
        subsRes.error?.message
      )
    }

    const messages = messagesRes.data || []
    const shares = sharesRes.data || []
    const referrals = referralsRes.data || []
    const totalSubscribers = subsRes.count || 0

    const combinedUnlocks: { created_at: string }[] = [];
    const rawUnlocks = [
      ...(passesRes.data || []),
      ...(unlocksTableRes.data || []),
      ...(userPassesRes.data || []),
      ...(passVaultRes.data || [])
    ];

    for (const rawItem of rawUnlocks) {
      const item = rawItem as any;
      const ts = item.created_at || item.updated_at;
      if (ts) {
        combinedUnlocks.push({ created_at: ts });
      }
    }

    const uniquePlatesCount = new Set(messages.map(m => m.plate_hash || m.license_plate).filter(Boolean)).size

    const groupStats = (items: { created_at: string }[]) => {
      const stats = {
        daily: {} as Record<string, number>,
        weekly: {} as Record<string, number>,
        monthly: {} as Record<string, number>,
        yearly: {} as Record<string, number>
      }

      items.forEach(item => {
        const date = new Date(item.created_at)
        if (isNaN(date.getTime())) return

        const day = date.toISOString().split('T')[0]
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const year = String(date.getFullYear())
        
        const weekNum = Math.ceil(date.getDate() / 7)
        const week = `${month}-W${weekNum}`

        stats.daily[day] = (stats.daily[day] || 0) + 1
        stats.weekly[week] = (stats.weekly[week] || 0) + 1
        stats.monthly[month] = (stats.monthly[month] || 0) + 1
        stats.yearly[year] = (stats.yearly[year] || 0) + 1
      })

      return stats
    }

    return NextResponse.json({
      totalMessages: messages.length,
      uniquePlatesCount,
      totalUnlocks: combinedUnlocks.length,
      totalSubscribers,
      totalShares: shares.length,
      totalReferrals: referrals.length,
      messagesBreakdown: groupStats(messages),
      unlocksBreakdown: groupStats(combinedUnlocks),
      sharesBreakdown: groupStats(shares)
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
