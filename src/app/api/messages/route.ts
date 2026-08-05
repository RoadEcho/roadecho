import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { plate, state, message } = await request.json();

    if (!plate || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const moderation = await openai.moderations.create({ input: message });
    const results = moderation.results[0];

    if (results.flagged) {
      return NextResponse.json(
        { error: 'Message blocked by AI pre-moderation filters for policy violations.' },
        { status: 400 }
      );
    }

    const emailResponse = await resend.emails.send({
      from: 'RoadEcho <onboarding@resend.dev>',
      to: 'delivered@resend.dev',
      subject: `[RoadEcho] New message for plate ${plate} (${state || 'N/A'})`,
      html: `<div style="font-family: sans-serif; padding: 20px;">
        <h2>New Secure Message for Plate: ${plate} (${state || 'N/A'})</h2>
        <p style="background: #f4f4f5; padding: 15px; border-radius: 8px;">"${message}"</p>
        <p style="font-size: 12px; color: #71717a;">Sent securely via RoadEcho Platform.</p>
      </div>`,
    });

    return NextResponse.json({ success: true, emailResponse });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH Handler for manual message unlocking and audit logging
export async function PATCH(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const { data: messageRecord, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (msgErr || !messageRecord) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Update message status to unlocked
    const { error: updateErr } = await supabase
      .from('messages')
      .update({ is_unlocked: true, unlocked_at: new Date().toISOString() })
      .eq('id', messageId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update message status' }, { status: 500 });
    }

    // Explicitly log the unlock event for Admin Analytics
    const { error: unlockLogErr } = await supabase.from('unlocks').insert({
      user_id: userId,
      plate_hash: messageRecord.license_plate,
      message_id: messageRecord.id,
      source: 'manual_message_unlock',
    });

    if (unlockLogErr) {
      console.error('Failed to log unlock event for analytics:', unlockLogErr);
    }

    return NextResponse.json({ success: true, message: 'Message unlocked successfully' });
  } catch (err: any) {
    console.error('Error in messages PATCH API:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
