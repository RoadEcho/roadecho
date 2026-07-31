import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Resend } from 'resend';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

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
      subject: `New RoadEcho message for plate ${plate} (${state})`,
      html: `<div style="font-family: sans-serif; padding: 20px;">
        <h2>New Secure Message for Plate: ${plate} (${state})</h2>
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
