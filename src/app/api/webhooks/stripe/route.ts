import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as any,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const referrerId = session.metadata?.referrerId

    if (referrerId) {
      // 1. Fetch current pass expiration for the referrer
      const { data: passRecord } = await supabase
        .from('user_passes')
        .select('unlock_expires_at')
        .eq('user_id', referrerId)
        .single()

      const now = new Date()
      const currentExpiry = passRecord?.unlock_expires_at ? new Date(passRecord.unlock_expires_at) : now
      const baseTime = currentExpiry > now ? currentExpiry : now
      const newExpiry = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString()

      // 2. Extend 24-hour pass for bringing in a subscriber
      await supabase
        .from('user_passes')
        .upsert({ 
          user_id: referrerId, 
          unlock_expires_at: newExpiry, 
          updated_at: now.toISOString() 
        })

      // 3. Log reward event for admin analytics
      await supabase.from('reward_events').insert([
        { user_id: referrerId, reward_type: 'subscription_bonus' }
      ])
    }
  }

  return NextResponse.json({ received: true })
}
