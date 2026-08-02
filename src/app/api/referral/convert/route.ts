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
        { referrer_id: referrerId, referred_email: email, status: 'converted' }
      ])

      // 2. Count total converted referrals
      const { count } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', referrerId)
        .eq('status', 'converted')

      // 3. Check if they hit 5 referrals and haven't claimed this milestone cap yet
      if (count && count >= 5) {
        const { data: existingClaim } = await supabase
          .from('user_milestone_claims')
          .select('id')
          .eq('user_id', referrerId)
          .eq('milestone_type', '5_referrals')
          .single()

        if (!existingClaim) {
          // Lock the milestone claim to prevent duplicate rewards and enforce the cap
          await supabase.from('user_milestone_claims').insert([
            { user_id: referrerId, milestone_type: '5_referrals' }
          ])

          // Fetch current vault or initialize
          const { data: vault } = await supabase
            .from('user_pass_vault')
            .select('available_passes')
            .eq('user_id', referrerId)
            .single()

          const currentAvailable = vault?.available_passes || 0

          // Add 1 stored pass to their vault for later activation
          await supabase.from('user_pass_vault').upsert({
            user_id: referrerId,
            available_passes: currentAvailable + 1,
            updated_at: new Date().toISOString()
          })

          // Log reward event for admin analytics
          await supabase.from('reward_events').insert([
            { user_id: referrerId, reward_type: 'referral_milestone_stored' }
          ])
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
