import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as any,
})

const resend = new Resend(process.env.RESEND_API_KEY)

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://roadecho.vercel.app'
  const logoUrl = `${siteUrl}/logo.PNG`

  // 1. Handle Checkout Session Completed (Passes, Subscriptions, Unlocks & Referrals)
  if (event.type === 'checkout.session.completed') {
    const referrerId = session.metadata?.referrerId
    const subscriptionId = session.subscription as string
    const customerId = session.customer as string
    const customerEmail = session.customer_details?.email || session.customer_email
    
    // Robust User ID Resolution with email fallback
    let clientReferenceId = session.client_reference_id || session.metadata?.user_id || session.metadata?.userId
    if (!clientReferenceId && customerEmail) {
      const { data: profileMatch } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', customerEmail)
        .maybeSingle()
      if (profileMatch) {
        clientReferenceId = profileMatch.id
      }
    }

    const purchaseType = session.metadata?.type

    // Handle 24-Hour Pass Purchase -> Increment Stored Passes Vault
    if (purchaseType === 'pass' && clientReferenceId) {
      const { data: vault } = await supabase
        .from('user_pass_vault')
        .select('available_passes')
        .eq('user_id', clientReferenceId)
        .maybeSingle()

      const currentPasses = vault?.available_passes || 0

      await supabase
        .from('user_pass_vault')
        .upsert({
          user_id: clientReferenceId,
          available_passes: currentPasses + 1,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })
    }

    // Handle Unlocks / Analytics Tracking (Logs both message unlocks and subscriptions for admin dashboard)
    const messageId = session.metadata?.messageId
    const amountTotal = session.amount_total ? session.amount_total / 100 : 0
    if (clientReferenceId) {
      const isMessageUnlock = messageId && messageId.trim() !== ''
      const isSubscriptionCheckout = subscriptionId || purchaseType === 'subscription' || session.mode === 'subscription'

      if (isMessageUnlock || isSubscriptionCheckout) {
        await supabase.from('unlocks').insert({
          id: crypto.randomUUID(),
          user_id: clientReferenceId,
          message_id: isMessageUnlock ? messageId : null,
          amount: amountTotal,
          created_at: new Date().toISOString(),
        })
      }
    }

    // Track/Update Subscription for Admin Total Subscribers Metric & Profiles Table
    if (subscriptionId) {
      const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as any
      
      // Fallback user ID resolution from subscription metadata if clientReferenceId is still missing
      if (!clientReferenceId && (subscription.metadata?.userId || subscription.metadata?.user_id)) {
        clientReferenceId = subscription.metadata.userId || subscription.metadata.user_id
      }

      const cancelAtPeriodEnd = subscription.cancel_at_period_end
      let statusToSave = subscription.status
      if (['active', 'trialing'].includes(statusToSave)) {
        statusToSave = cancelAtPeriodEnd ? 'canceling' : 'active'
      }

      if (clientReferenceId) {
        // Check if subscription record already exists to safely insert or update
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle()

        if (existingSub) {
          await supabase.from('subscriptions').update({
            status: statusToSave,
            price_id: subscription.items.data[0].price.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('stripe_subscription_id', subscription.id)
        } else {
          await supabase.from('subscriptions').insert({
            id: crypto.randomUUID(),
            stripe_subscription_id: subscription.id,
            user_id: clientReferenceId,
            status: statusToSave,
            price_id: subscription.items.data[0].price.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }

        // CRITICAL: Synchronize profile data so dashboard Pro status and cancellation banner render correctly
        await supabase
          .from('profiles')
          .update({
            stripe_customer_id: customerId || subscription.customer,
            stripe_subscription_id: subscription.id,
            subscription_status: statusToSave,
            subscription_tier: 'pro',
            subscription_started_at: new Date().toISOString(),
          })
          .eq('id', clientReferenceId)
      }
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

    // Send Purchase Confirmation & Receipt Email
    if (customerEmail) {
      try {
        await resend.emails.send({
          from: 'RoadEcho <onboarding@resend.dev>',
          to: [customerEmail],
          subject: '[RoadEcho] Purchase Confirmation & Receipt',
          text: `Thank you for your purchase with RoadEcho. Your payment has been successfully processed. View your dashboard: ${siteUrl}/dashboard`,
          html: `
            <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
              </div>
              <h2 style="color: #06b6d4; margin-top: 0; font-size: 18px;">Purchase Successful!</h2>
              <p>Thank you for choosing RoadEcho. Your payment has been successfully processed and your vault passes or subscription have been updated.</p>
              <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">Open Dashboard</a>
            </div>
          `
        })
      } catch (emailErr) {
        console.error('Failed to send purchase confirmation email:', emailErr)
      }
    }
  }

  // 2. Handle Subscription Updates (Renewals/Changes/Cancellations period end)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as any
    const cancelAtPeriodEnd = subscription.cancel_at_period_end
    let statusToSave = subscription.status

    if (['active', 'trialing'].includes(statusToSave)) {
      statusToSave = cancelAtPeriodEnd ? 'canceling' : 'active'
    }

    let userId = subscription.metadata?.userId || subscription.metadata?.user_id

    // Check if subscription record exists
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, user_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle()

    if (existingSub) {
      userId = userId || existingSub.user_id
      await supabase.from('subscriptions').update({
        status: statusToSave,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('stripe_subscription_id', subscription.id)
    } else {
      // Fallback lookup profile by stripe_customer_id
      const { data: profileMatch } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', subscription.customer as string)
        .maybeSingle()

      if (profileMatch) {
        userId = profileMatch.id
        await supabase.from('subscriptions').insert({
          id: crypto.randomUUID(),
          stripe_subscription_id: subscription.id,
          user_id: userId,
          status: statusToSave,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    }

    // Update profile subscription status & tier reliably by user ID or customer ID
    if (userId) {
      await supabase
        .from('profiles')
        .update({
          subscription_status: statusToSave,
          subscription_tier: 'pro',
          stripe_subscription_id: subscription.id,
        })
        .eq('id', userId)
    } else {
      await supabase
        .from('profiles')
        .update({
          subscription_status: statusToSave,
          subscription_tier: 'pro',
          stripe_subscription_id: subscription.id,
        })
        .eq('stripe_customer_id', subscription.customer as string)
    }
  }

  // 3. Handle Subscription Cancellations & Expirations
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as any

    await supabase.from('subscriptions').update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    }).eq('stripe_subscription_id', subscription.id)

    // Update profile status to inactive/free
    await supabase
      .from('profiles')
      .update({
        subscription_status: 'canceled',
        subscription_tier: 'free',
        stripe_subscription_id: null,
      })
      .eq('stripe_customer_id', subscription.customer as string)

    // Send Subscription Expired Email
    try {
      const customerId = subscription.customer as string
      const customer = (await stripe.customers.retrieve(customerId)) as any
      if (customer && !customer.deleted && customer.email) {
        await resend.emails.send({
          from: 'RoadEcho <onboarding@resend.dev>',
          to: [customer.email],
          subject: '[RoadEcho] Your Subscription Has Expired',
          text: `Your RoadEcho subscription has expired. Renew anytime from your dashboard: ${siteUrl}/dashboard`,
          html: `
            <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
              </div>
              <h2 style="color: #f43f5e; margin-top: 0; font-size: 18px;">Subscription Expired</h2>
              <p>Your RoadEcho subscription has expired. You can renew your subscription anytime from your dashboard to keep your active passes and features running smoothly.</p>
              <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">Renew Subscription</a>
            </div>
          `
        })
      }
    } catch (emailErr) {
      console.error('Failed to send subscription expiration email:', emailErr)
    }
  }

  return NextResponse.json({ received: true })
}
