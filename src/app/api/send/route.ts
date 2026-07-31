import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const licensePlate = body.licensePlate || body.license_plate;
    const country = body.country;
    const stateRegion = body.stateRegion || body.state_region;
    const email = body.email || body.sender_email;
    const message = body.message;

    // 1. OpenAI Moderation Check
    const moderation = await openai.moderations.create({ input: message });
    if (moderation.results[0].flagged) {
      return NextResponse.json({ error: 'Message flagged by moderation.' }, { status: 400 });
    }

    // 2. Save Message to Supabase Database
    const { error: dbError } = await supabase.from('messages').insert([
      {
        license_plate: licensePlate,
        country: country,
        state_region: stateRegion,
        sender_email: email,
        message: message,
      }
    ]);

    if (dbError) {
      console.error('Supabase Error:', dbError);
      return NextResponse.json({ error: `Database Error: ${dbError.message}` }, { status: 500 });
    }

    // 3. Send Emails via Resend
    const adminEmail = process.env.ADMIN_EMAIL || 'roadecho.admin@gmail.com';

    await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `[RoadEcho Alert] New Message for ${country}:${stateRegion} - ${licensePlate}`,
      text: `New Message Queued\n\nPlate: ${licensePlate}\nLocation: ${stateRegion}, ${country}\nMessage: ${message}`
    });

    await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: [email],
      subject: `Your secure message to ${country}:${stateRegion} ${licensePlate} has been queued`,
      text: `Message Dispatched\n\nYour message to ${licensePlate} has been securely queued.`
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
