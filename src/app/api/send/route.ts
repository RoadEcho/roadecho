import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use service role key if available to bypass RLS for server-side lookups
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Automatically find license plate
    let licensePlate = body.licensePlate || body.license_plate || body.plate || body.licencePlate || body.license;
    if (!licensePlate) {
      const keys = Object.keys(body);
      for (const key of keys) {
        const val = body[key];
        if (typeof val === 'string' && val.trim().length > 0 && !['email', 'country', 'stateRegion', 'message', 'sender_email'].includes(key)) {
          licensePlate = val;
          break;
        }
      }
    }

    const country = body.country || 'USA';
    const stateRegion = body.stateRegion || body.state_region || body.state || 'DE';
    
    const email = body.email || body.sender_email || body.userEmail || body.mail || 'roadecho.admin@gmail.com';
    const message = body.message || body.text || '';

    if (!licensePlate) {
      return NextResponse.json({ error: 'Database Error: license_plate is missing.' }, { status: 400 });
    }

    const cleanPlate = licensePlate.trim().toUpperCase();
    const cleanState = stateRegion.trim().toUpperCase();

    // 1. OpenAI Moderation Check
    const moderation = await openai.moderations.create({ input: message });
    if (moderation.results[0].flagged) {
      return NextResponse.json({ error: 'Message flagged by moderation.' }, { status: 400 });
    }

    // 2. Save Message to Supabase Database
    const { error: dbError } = await supabase.from('messages').insert([
      {
        license_plate: cleanPlate,
        country: country,
        state_region: cleanState,
        sender_email: email,
        message: message,
      }
    ]);

    if (dbError) {
      console.error('Supabase Error:', dbError);
      return NextResponse.json({ error: `Database Error: ${dbError.message}` }, { status: 500 });
    }

    // 3. Find if the plate is claimed to notify the actual vehicle owner
    let ownerEmail: string | null = null;
    const { data: plateOwnerData } = await supabase
      .from('user_plates')
      .select('user_id')
      .eq('plate_number', cleanPlate)
      .eq('state', cleanState)
      .maybeSingle();

    if (plateOwnerData?.user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(plateOwnerData.user_id);
      if (userData?.user?.email) {
        ownerEmail = userData.user.email;
      }
    }

    // 4. Send Emails via Resend
    const adminEmail = process.env.ADMIN_EMAIL || 'roadecho.admin@gmail.com';

    // Admin audit notification
    await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `[RoadEcho Alert] New Message for ${country}:${cleanState} - ${cleanPlate}`,
      text: `New Message Queued\n\nPlate: ${cleanPlate}\nLocation: ${cleanState}, ${country}\nSender: ${email}\nMessage: ${message}`
    });

    // Email to the claimed plate owner (if someone claimed it)
    if (ownerEmail) {
      await resend.emails.send({
        from: 'RoadEcho <onboarding@resend.dev>',
        to: [ownerEmail],
        subject: `[RoadEcho] New message received for your plate ${cleanPlate} (${cleanState})`,
        text: `You have received a new secure message for your claimed plate ${cleanPlate}. Log in to your RoadEcho dashboard to view it.`
      });
    }

    // Confirmation to the sender
    await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: [email],
      subject: `Your secure message to ${country}:${cleanState} ${cleanPlate} has been queued`,
      text: `Message Dispatched\n\nYour message to ${cleanPlate} has been securely queued.`
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: `Internal Server Error: ${error.message || error}` }, { status: 500 });
  }
}
