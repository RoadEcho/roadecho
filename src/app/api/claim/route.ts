import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPlateHash } from '../../../lib/hash';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized: Missing token.' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Invalid session.' }, { status: 401 });
    }

    const body = await request.json();
    const { plateNumber, state, country } = body;

    if (!plateNumber || !state) {
      return NextResponse.json({ error: 'Plate number and state are required.' }, { status: 400 });
    }

    const cleanPlate = plateNumber.trim().toUpperCase();
    const cleanState = state.trim().toUpperCase();
    const cleanCountry = country ? country.trim().toUpperCase() : 'USA';

    // 1. Generate Zero-Knowledge Cryptographic Hash (DPPA Shield)
    const plateHash = getPlateHash(cleanPlate, cleanState, cleanCountry);

    // 2. Check limit (max 3 plates per user)
    const { count, error: countError } = await supabase
      .from('user_plates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count || 0) >= 3) {
      return NextResponse.json({ error: 'Maximum limit of 3 claimed plates reached.' }, { status: 400 });
    }

    // 3. Insert hashed plate into Supabase database
    const { error: insertError } = await supabase.from('user_plates').insert([
      {
        user_id: user.id,
        plate_number: plateHash,
        state: cleanState,
      }
    ]);

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'This plate is already claimed.' }, { status: 400 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 4. Send Confirmation and Audit Emails via Resend
    const dashboardUrl = 'https://roadecho.vercel.app/dashboard';
    const adminDashboardUrl = 'https://roadecho.vercel.app/admin';
    const logoUrl = 'https://roadecho.vercel.app/logo.PNG';
    const adminEmail = process.env.ADMIN_EMAIL || 'roadecho.admin@gmail.com';

    if (user.email) {
      await resend.emails.send({
        from: 'RoadEcho <onboarding@resend.dev>',
        to: [user.email],
        subject: `Plate Claimed Successfully: ${cleanPlate} (${cleanState})`,
        text: `You have successfully claimed plate ${cleanPlate} (${cleanState}) on RoadEcho using zero-knowledge encryption. Manage your plates here: ${dashboardUrl}`,
        html: `
          <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
            </div>
            <h2 style="color: #06b6d4; margin-top: 0; font-size: 18px;">Plate Successfully Claimed</h2>
            <p>You have successfully claimed <strong>${cleanPlate} (${cleanState})</strong> to your RoadEcho vault using zero-knowledge encryption.</p>
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">Open Plate Vault Dashboard</a>
          </div>
        `
      });
    }

    await resend.emails.send({
      from: 'RoadEcho System <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `[Audit] New Plate Claimed (${cleanState}) - [Secured Hash]`,
      text: `User (${user.email || 'Unknown'}) successfully claimed a plate in ${cleanState}. Access dashboard: ${adminDashboardUrl}`,
      html: `
        <div style="font-family: sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${logoUrl}" alt="RoadEcho Logo" style="height: 48px; object-fit: contain;" />
          </div>
          <h2 style="color: #06b6d4; margin-top: 0; font-size: 18px;">[Audit] New Plate Claimed</h2>
          <p>User (<strong>${user.email || 'Unknown'}</strong>) successfully claimed a plate hash in <strong>${cleanState}</strong>.</p>
          <a href="${adminDashboardUrl}" style="display: inline-block; background-color: #06b6d4; color: #0f172a; padding: 10px 20px; border-radius: 8px; font-weight: bold; text-decoration: none; margin-top: 12px;">View Admin Command Center</a>
        </div>
      `
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || error }, { status: 500 });
  }
}
