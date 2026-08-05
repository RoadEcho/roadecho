import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Optional: Validate a secret header from Supabase to secure the webhook
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.SUPABASE_WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    
    // Supabase auth webhooks pass the record under payload.record
    const newUser = payload.record;
    if (!newUser || !newUser.email) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const userEmail = newUser.email;
    const userId = newUser.id;
    const createdAt = newUser.created_at;

    // TODO: Send the email to your admin using your preferred provider (e.g., Resend, SendGrid)
    // Example using Resend:
    /*
    await resend.emails.send({
      from: 'System <noreply@yourdomain.com>',
      to: 'admin@yourdomain.com',
      subject: 'New User Signup',
      html: `<p>A new user just signed up:</p><ul><li>Email: ${userEmail}</li><li>ID: ${userId}</li><li>Time: ${createdAt}</li></ul>`,
    });
    */

    console.log(`New user signup notification triggered for: ${userEmail}`);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing signup webhook:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
