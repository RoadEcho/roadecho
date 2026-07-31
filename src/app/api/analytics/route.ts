import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET() {
  try {
    // Fetch raw records to compute breakdown client-side or via Postgres RPC
    const { data: messages, error: msgError } = await supabase.from('messages').select('created_at')
    const { data: unlocks, error: unlockError } = await supabase.from('unlocks').select('created_at, amount')

    if (msgError || unlockError) {
      throw new Error(msgError?.message || unlockError?.message)
    }

    // Helper to group by timeframe
    const groupStats = (items: { created_at: string }[]) => {
      const stats = {
        daily: {} as Record<string, number>,
        weekly: {} as Record<string, number>,
        monthly: {} as Record<string, number>,
        yearly: {} as Record<string, number>
      }

      items.forEach(item => {
        const date = new Date(item.created_at)
        const day = date.toISOString().split('T')[0]
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const year = String(date.getFullYear())
        
        // Simple ISO week key approximation
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
      totalUnlocks: unlocks.length,
      messagesBreakdown: groupStats(messages),
      unlocksBreakdown: groupStats(unlocks)
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
