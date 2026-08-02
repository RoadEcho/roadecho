import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const { email, referrerId } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    if (referrerId) {
      // 1. Log the referral conversion
      await supabase.from('referrals').insert([
        {
          referrer_id: referrerId,
          referred_email: email,
          status: 'converted'
        }
      ])

      // 2. Count total converted referrals for this referrer
      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', referrerId)
        .eq('status', 'converted')

      // 3. Check if they hit a multiple of 5 referrals
      if (count && count % 5 === 0) {
        // Calculate 24 hours from now (or extend current active pass if they already have time)
        const { data: passRecord } = await supabase
          .from('user_passes')
          .select('unlock_expires_at')
          .eq('user_id', referrerId)
          .single()

        const now = new Date()
        const currentExpiry = passRecord?.unlock_expires_at ? new Date(passRecord.unlock_expires_at) : now
        const baseTime = currentExpiry > now ? currentExpiry : now
        
        const newExpiry = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString()

        // Update or insert the 24-hour pass expiration
        await supabase
          .from('user_passes')
          .upsert({ 
            user_id: referrerId, 
            unlock_expires_at: newExpiry, 
            updated_at: now.toISOString() 
          })

        // Log reward event for admin analytics
        await supabase.from('reward_events').insert([
          { user_id: referrerId, reward_type: 'referral_24h_pass' }
        ])
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
