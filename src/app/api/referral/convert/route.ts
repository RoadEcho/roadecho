import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const { email, referrerId } = await request.json()

    if (!email || !referrerId) {
      return NextResponse.json({ error: 'Email and referrer ID required' }, { status: 400 })
    }

    // 1. Prevent self-referral if email matches referrer's account
    // (Optional check depending on how emails map to profiles)

    // 2. Check if this specific email was already converted to prevent duplicate spam
    const { data: existingConversion } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_email', email)
      .maybeSingle()

    if (existingConversion) {
      return NextResponse.json({ error: 'Referral already recorded for this email' }, { status: 400 })
    }

    // 3. Log the referral conversion atomically
    const { error: insertError } = await supabase.from('referrals').insert([
      { referrer_id: referrerId, referred_email: email, status: 'converted' }
    ])

    if (insertError) {
      return NextResponse.json({ error: 'Failed to log referral' }, { status: 500 })
    }

    // 4. Count total converted referrals securely
    const { count } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', referrerId)
      .eq('status', 'converted')

    // 5. Check if they hit 5 referrals and haven't claimed this milestone cap yet
    if (count && count >= 5) {
      const { data: existingClaim } = await supabase
        .from('user_milestone_claims')
        .select('id')
        .eq('user_id', referrerId)
        .eq('milestone_type', '5_referrals')
        .maybeSingle()

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
          .maybeSingle()

        const currentAvailable = vault?.available_passes || 0

        // Add 1 stored pass to their vault for later activation
        await supabase.from('user_pass_vault').upsert({
          user_id: referrerId,
          available_passes: currentAvailable + 1,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

        // Log reward event for admin analytics
        await supabase.from('reward_events').insert([
          { user_id: referrerId, reward_type: 'referral_milestone_stored' }
        ])
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
