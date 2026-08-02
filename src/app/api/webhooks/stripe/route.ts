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

  const session = event.data.object as Stripe.Checkout.Session

  // 1. Handle Checkout Session Completed (Subscriptions & Referrals)
  if (event.type === 'checkout.session.completed') {
    const referrerId = session.metadata?.referrerId
    const subscriptionId = session.subscription as string
    const customerId = session.customer as string
    const clientReferenceId = session.client_reference_id || session.metadata?.user_id

    // Track/Update Subscription for Admin Total Subscribers Metric
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      
      await supabase.from('subscriptions').upsert({
        stripe_subscription_id: subscription.id,
        user_id: clientReferenceId || customerId,
        status: subscription.status,
        price_id: subscription.items.data[0].price.id,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_subscription_id'
      })
    }

    // Handle Referral Bonus Logic
    if (referrerId) {
      const { data: passRecord } = await supabase
        .from('user_passes')
        .select('unlock_expires_at')
        .eq('user_id', referrerId)
        .single()

      const now = new Date()
      const currentExpiry = passRecord?.unlock_expires_at ? new Date(passRecord.unlock_expires_at) : now
      const baseTime = currentExpiry > now ? currentExpiry : now
      const newExpiry = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000).toISOString()

      await supabase
        .from('user_passes')
        .upsert({ 
          user_id: referrerId, 
          unlock_expires_at: newExpiry, 
          updated_at: now.toISOString() 
        })

      await supabase.from('reward_events').insert([
        { user_id: referrerId, reward_type: 'subscription_bonus' }
      ])
    }
  }

  // 2. Handle Subscription Updates (Renewals/Changes)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription

    await supabase.from('subscriptions').upsert({
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_subscription_id'
    })
  }

  // 3. Handle Subscription Cancellations
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription

    await supabase.from('subscriptions').update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', subscription.id)
  }

  return NextResponse.json({ received: true })
}
