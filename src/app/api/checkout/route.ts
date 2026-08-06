import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { type, userId, plateHash, messageId } = await request.json();

    // Handle Stripe Customer Portal for managing/canceling active subscriptions
    if (type === 'portal') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

      if (!profile?.stripe_customer_id) {
        return NextResponse.json({ error: 'No active billing profile found.' }, { status: 400 });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${request.headers.get('origin')}/dashboard`,
      });

      return NextResponse.json({ url: portalSession.url });
    }

    const priceId =
      type === 'subscription'
        ? process.env.STRIPE_SUB_PRICE_ID
        : process.env.STRIPE_PASS_PRICE_ID;

    const mode = type === 'subscription' ? 'subscription' : 'payment';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode,
      success_url: `${request.headers.get('origin')}/dashboard?success=true`,
      cancel_url: `${request.headers.get('origin')}/dashboard?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        type: type,
        plateHash: plateHash || '',
        messageId: messageId || '',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
