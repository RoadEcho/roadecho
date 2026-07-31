import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email, plateNumber, state } = await request.json()

    // Send confirmation email to the user
    if (email) {
      await resend.emails.send({
        from: 'RoadEcho <onboarding@resend.dev>',
        to: [email],
        subject: `Plate Claimed Successfully: ${plateNumber} (${state})`,
        text: `You have successfully claimed plate ${plateNumber} (${state}) on RoadEcho. You will now monitor and receive alerts for incoming messages.`
      })
    }

    // Send notification email to the admin audit log
    const adminEmail = process.env.ADMIN_EMAIL || 'onboarding@resend.dev'
    await resend.emails.send({
      from: 'RoadEcho System <onboarding@resend.dev>',
      to: [adminEmail],
      subject: `[Audit] New Plate Claimed: ${plateNumber} (${state})`,
      text: `User (${email || 'Unknown'}) successfully claimed plate ${plateNumber} (${state}).`
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
