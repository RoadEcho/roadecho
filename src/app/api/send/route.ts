import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { Resend } from 'resend';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { plate, country, region, message, senderEmail } = await req.json();

    if (!plate || !country || !region || !message) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // 1. OpenAI Pre-Moderation
    const moderation = await openai.moderations.create({
      input: message,
    });

    if (moderation.results[0].flagged) {
      return NextResponse.json(
        { error: 'Message blocked by AI safety guidelines.' },
        { status: 400 }
      );
    }

    // 2. Send Admin Notification Email
    const adminEmail = process.env.ADMIN_EMAIL || senderEmail; 
    await resend.emails.send({
      from: 'RoadEcho Security <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `[RoadEcho Alert] New Message for ${country}:${region} - ${plate}`,
      html: `
        <h2>New Message Queued</h2>
        <p><strong>Plate:</strong> ${plate.toUpperCase()}</p>
        <p><strong>Location:</strong> ${region.toUpperCase()}, ${country.toUpperCase()}</p>
        <p><strong>Message:</strong> ${message}</p>
      `,
    });

    // 3. Send Confirmation to Sender
    if (senderEmail) {
      await resend.emails.send({
        from: 'RoadEcho <onboarding@resend.dev>',
        to: [senderEmail],
        subject: `Your secure message to ${country}:${region} ${plate} has been queued`,
        html: `
          <h2>Message Dispatched</h2>
          <p>Your message to <strong>${plate.toUpperCase()}</strong> has been securely queued.</p>
        `,
      });
    }

    return NextResponse.json({ success: true, message: 'Secure message sent successfully!' });
  } catch (error: any) {
    console.error('API Send Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
