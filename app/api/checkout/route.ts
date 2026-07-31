import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-28.acacia',
});

export async function POST(request: Request) {
  try {
    const { type } = await request.json(); // Expects 'pass' or 'subscription'

    // Select the correct Price ID based on the user's choice
    const priceId =
      type === 'subscription'
        ? process.env.STRIPE_SUB_PRICE_ID
        : process.env.STRIPE_PASS_PRICE_ID;

    // Use 'subscription' mode for recurring, 'payment' mode for one-time pass
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
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
