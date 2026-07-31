import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as any,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId || session.client_reference_id;
    const passType = session.metadata?.type;

    if (userId) {
      if (passType === 'subscription') {
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          status: 'active',
          stripe_customer_id: session.customer as string,
          updated_at: new Date().toISOString(),
        });
      } else {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('passes').insert({
          user_id: userId,
          expires_at: expiresAt,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
