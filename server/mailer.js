// Outbound email. With RESEND_API_KEY + MAIL_FROM set, sends via Resend's HTTP API;
// otherwise logs the message so password resets still work in development.
export async function sendPasswordReset(user, link) {
  const subject = 'Reset your Stxck password'
  const text = `Hi ${user.name},\n\nUse this link to reset your Stxck password. It expires in 1 hour.\n\n${link}\n\nIf you didn't request this, you can ignore this email.`
  const key = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM
  if (!key || !from) {
    console.log(`[mail] (not sent: no RESEND_API_KEY/MAIL_FROM) to=${user.email} subject="${subject}"\n${link}`)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: user.email, subject, text }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) console.error('[mail] send failed', res.status, await res.text())
  } catch (err) {
    console.error('[mail] send failed', err.message)
  }
}
