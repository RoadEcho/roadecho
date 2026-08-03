import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getPlateHash } from '../../../lib/hash';

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agreedToTerms } = body;
    
    // 1. Enforce strict server-side terms validation
    if (!agreedToTerms) {
      return NextResponse.json({ error: 'You must agree to the terms and digital delivery policy before sending.' }, { status: 400 });
    }
    
    // Automatically find license plate
    let licensePlate = body.licensePlate || body.license_plate || body.plate || body.licencePlate || body.license;
    if (!licensePlate) {
      const keys = Object.keys(body);
      for (const key of keys) {
        const val = body[key];
        if (typeof val === 'string' && val.trim().length > 0 && !['email', 'country', 'stateRegion', 'state', 'state_region', 'message', 'text', 'sender_email', 'agreedToTerms', 'latitude', 'longitude'].includes(key)) {
          licensePlate = val;
          break;
        }
      }
    }

    const country = body.country || body.nation || body.countryInput || 'USA';
    const stateRegion = body.stateRegion || body.state_region || body.state || body.stateInput || body.province || body.region;
    const email = body.email || body.sender_email || body.userEmail || body.mail || body.senderEmail;
    const message = body.message || body.text || body.msg;

    // Extract location coordinates if provided
    const latitude = body.latitude || body.lat || null;
    const longitude = body.longitude || body.lng || body.lon || null;

    // 2. Strict input validation
    if (!licensePlate) {
      return NextResponse.json({ error: 'Database Error: license_plate is missing.' }, { status: 400 });
    }

    if (!stateRegion) {
      return NextResponse.json({ error: 'State / region is required.' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Sender email is required.' }, { status: 400 });
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message content cannot be empty.' }, { status: 400 });
    }

    const cleanPlate = licensePlate.trim().toUpperCase();
    const cleanState = stateRegion.trim().toUpperCase();
    const cleanCountry = country.trim().toUpperCase();

    // 3. OpenAI Moderation Check
    const moderation = await openai.moderations.create({ input: message });
    if (moderation.results[0].flagged) {
      return NextResponse.json({ error: 'Message flagged by moderation.' }, { status: 400 });
    }

    // 4. Generate Zero-Knowledge Cryptographic Hash
    const plateHash = getPlateHash(cleanPlate, cleanState, cleanCountry);

    // 5. Save Hashed Message to Supabase Database with Coordinates
    const { error: dbError } = await supabase.from('messages').insert([
      {
        license_plate: plateHash,
        country: cleanCountry,
        state_region: cleanState,
        sender_email: email,
        message: message,
        terms_agreed: true,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      }
    ]);

    if (dbError) {
      console.error('Supabase Error:', dbError);
      return NextResponse.json({ error: `Database Error: ${dbError.message}` }, { status: 500 });
    }

    // 6. Find if the plate is claimed to notify the owner
    let ownerEmail: string | null = null;
    const { data: plateOwnerData } = await supabase
      .from('user_plates')
      .select('user_id')
      .eq('plate_number', plateHash)
      .maybeSingle();

    if (plateOwnerData?.user_id) {
      const { data: userData } = await supabase.auth.admin.getUserById(plateOwnerData.user_id);
      if (userData?.user?.email) {
        ownerEmail = userData.user.email;
      }
    }

    // 7. Generate a secure server-authenticated auto-login link using hashed_token (bypasses PKCE)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://roadecho.vercel.app';
    let senderDashboardUrl = `${siteUrl}/dashboard`;

    try {
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: `${siteUrl}/dashboard`,
        },
      });

      if (!linkErr && linkData?.properties?.hashed_token) {
        senderDashboardUrl = `${siteUrl}/api/auth/token?token_hash=${linkData.properties.hashed_token}&type=magiclink`;
      }
    } catch (authErr) {
      console.error('Failed to generate auto-login link:', authErr);
    }

    // 8. Send Emails via Resend (Admin, Plate Owner, and Sender Confirmation)
    const adminEmail = process.env.ADMIN_EMAIL || 'roadecho.admin@gmail.com';
    const dashboardUrl = `${siteUrl}/dashboard`;
    const adminDashboardUrl = `${siteUrl}/admin`;
    const logoUrl = `${siteUrl}/logo.PNG`;

    await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `[RoadEcho Alert] New Message for ${cleanCountry}:${cleanState}`,
      text: `New Message Queued\n\nPlate Hash: ${plateHash}\nLocation: ${cleanState}, ${cleanCountry}\nSender: ${email}\nMessage: ${message}`,
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

    if (ownerEmail) {
      await resend.emails.send({
        from: 'RoadEcho <onboarding@resend.dev>',
        to: [ownerEmail],
        subject: `[RoadEcho] New message received for your registered plate (${cleanState})`,
        text: `You have received a new secure message for your claimed plate in ${cleanState}. Log in to view it: ${dashboardUrl}`,
        html: `
          <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
            </div>
            <h2 style="color: #06b6d4; margin-top: 0; font-size: 18px;">New Message Received</h2>
            <p>You have received a new secure message for your claimed vehicle plate in <strong>${cleanState}</strong>.</p>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">Open Plate Vault Dashboard</a>
          </div>
        `
      });
    }

    await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: [email],
      subject: `Your secure message to ${cleanCountry}:${cleanState} has been queued`,
      text: `Message Dispatched\n\nYour message has been securely queued. View dashboard: ${senderDashboardUrl}`,
      html: `
        <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
          </div>
          <h2 style="color: #06b6d4; margin-top: 0; font-size: 18px;">Message Dispatched</h2>
          <p>Your secure message to location <strong>${cleanState}, ${cleanCountry}</strong> has been successfully queued.</p>
          <a href="${senderDashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">Open Plate Vault Dashboard</a>
        </div>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: `Internal Server Error: ${error.message || error}` }, { status: 500 });
  }
}
