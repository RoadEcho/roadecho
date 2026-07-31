import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getPlateHash } from '../../../lib/hash';

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
    const cleanCountry = country.trim().toUpperCase();

    // 1. OpenAI Moderation Check
    const moderation = await openai.moderations.create({ input: message });
    if (moderation.results[0].flagged) {
      return NextResponse.json({ error: 'Message flagged by moderation.' }, { status: 400 });
    }

    // 2. Generate Zero-Knowledge Cryptographic Hash (DPPA Shield)
    const plateHash = getPlateHash(cleanPlate, cleanState, cleanCountry);

    // 3. Save Hashed Message to Supabase Database
    const { error: dbError } = await supabase.from('messages').insert([
      {
        license_plate: plateHash,
        country: cleanCountry,
        state_region: cleanState,
        sender_email: email,
        message: message,
      }
    ]);

    if (dbError) {
      console.error('Supabase Error:', dbError);
      return NextResponse.json({ error: `Database Error: ${dbError.message}` }, { status: 500 });
    }

    // 4. Find if the plate is claimed to notify the actual vehicle owner using cryptographic hash
    let ownerEmail: string | null = null;
    const { data: plateOwnerData } = await supabase
      .from('user_plates')
      .select('user_id')
      .eq('plate_number', plateHash)
      .eq('state', cleanState)
      .maybeSingle();

    if (plateOwnerData?.user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(plateOwnerData.user_id);
      if (userData?.user?.email) {
        ownerEmail = userData.user.email;
      }
    }

    // 5. Send Emails via Resend with Styled Dark Theme and Logo
    const adminEmail = process.env.ADMIN_EMAIL || 'roadecho.admin@gmail.com';
    const dashboardUrl = 'https://roadecho.vercel.app/dashboard';
    const adminDashboardUrl = 'https://roadecho.vercel.app/admin';
    const logoUrl = 'https://roadecho.vercel.app/logo.PNG';

    // Admin audit notification
    await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `[RoadEcho Alert] New Message for ${cleanCountry}:${cleanState} - [Secured Hash]`,
      text: `New Message Queued\n\nPlate Hash: ${plateHash}\nLocation: ${cleanState}, ${cleanCountry}\nSender: ${email}\nMessage: ${message}\n\nView Admin Command Center: ${adminDashboardUrl}`,
      html: `
        <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
          </div>
          <h2 style="color: #06b6d4; margin-top: 0; font-size: 18px;">[Audit] New Message Queued</h2>
          <p style="margin: 6px 0;"><strong>Plate Hash:</strong> ${plateHash.substring(0, 12)}...</p>
          <p style="margin: 6px 0;"><strong>Location:</strong> ${cleanState}, ${cleanCountry}</p>
          <p style="margin: 6px 0;"><strong>Sender:</strong> ${email}</p>
          <p style="background: #1e293b; padding: 12px; border-radius: 8px; font-style: italic; margin: 16px 0;">"${message}"</p>
          <a href="${adminDashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 8px;">View Admin Command Center</a>
        </div>
      `
    });

    // Email to the claimed plate owner (if someone claimed it)
    if (ownerEmail) {
      await resend.emails.send({
        from: 'RoadEcho <onboarding@resend.dev>',
        to: [ownerEmail],
        subject: `[RoadEcho] New message received for your registered plate (${cleanState})`,
        text: `You have received a new secure message for your claimed plate in ${cleanState}. Log in to your RoadEcho vault dashboard to view and unlock it: ${dashboardUrl}`,
        html: `
          <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
            </div>
            <h2 style="color: #06b6d4; margin-top: 0; font-size: 18px;">New Message Received</h2>
            <p>You have received a new secure message for your claimed vehicle plate in <strong>${cleanState}</strong>.</p>
            <p>Log in to your RoadEcho vault dashboard to view and unlock it:</p>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">Open Plate Vault Dashboard</a>
          </div>
        `
      });
    }

    // Confirmation to the sender
    await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: [email],
      subject: `Your secure message to ${cleanCountry}:${cleanState} has been queued`,
      text: `Message Dispatched\n\nYour message has been securely queued via zero-knowledge hashing. Manage your own plates or view your vault dashboard: ${dashboardUrl}`,
      html: `
        <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
          </div>
          <h2 style="color: #06b6d4; margin-top: 0; font-size: 18px;">Message Dispatched</h2>
          <p>Your secure message to location <strong>${cleanState}, ${cleanCountry}</strong> has been successfully queued using zero-knowledge encryption.</p>
          <p>Want to claim your own plates or monitor incoming messages?</p>
          <a href="${dashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">Open Plate Vault Dashboard</a>
        </div>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: `Internal Server Error: ${error.message || error}` }, { status: 500 });
  }
}
