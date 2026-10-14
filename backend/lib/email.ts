// Transactional email through Resend's HTTP API (no SDK needed).

type Lang = 'es' | 'en'

const COPY: Record<Lang, { subject: (otp: string) => string; text: (otp: string) => string; html: (otp: string) => string }> = {
  es: {
    subject: (otp) => `${otp} es tu código de Blackjack with Friends`,
    text: (otp) => `Tu código para entrar en Blackjack with Friends es ${otp}.\n\nCaduca en 5 minutos. Si no lo has pedido tú, ignora este correo.`,
    html: (otp) => layout('Tu código para entrar', otp, 'Caduca en 5 minutos. Si no lo has pedido tú, ignora este correo.'),
  },
  en: {
    subject: (otp) => `${otp} is your Blackjack with Friends code`,
    text: (otp) => `Your Blackjack with Friends sign-in code is ${otp}.\n\nIt expires in 5 minutes. If you didn't ask for it, ignore this email.`,
    html: (otp) => layout('Your sign-in code', otp, "It expires in 5 minutes. If you didn't ask for it, ignore this email."),
  },
}

function layout(title: string, otp: string, note: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0a0c0f;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#f2f2f2">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table cellpadding="0" cellspacing="0" style="max-width:420px;width:100%;background:#15181d;border-radius:16px;padding:28px">
<tr><td style="font-size:15px;color:#a8adb5">Blackjack with Friends</td></tr>
<tr><td style="font-size:20px;font-weight:700;padding-top:8px">${title}</td></tr>
<tr><td style="font-size:36px;font-weight:800;letter-spacing:8px;color:#f2c14e;padding:20px 0">${otp}</td></tr>
<tr><td style="font-size:14px;color:#a8adb5">${note}</td></tr>
</table></td></tr></table></body></html>`
}

/** Picks es/en from the `x-lang` header the app sends, then Accept-Language. */
export function languageFrom(headers: Headers | undefined): Lang {
  const explicit = headers?.get('x-lang')
  if (explicit === 'es' || explicit === 'en') return explicit
  return headers?.get('accept-language')?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

export async function sendOtpEmail(to: string, otp: string, lang: Lang): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    if (process.env.VERCEL) throw new Error('Falta RESEND_API_KEY')
    // Local development without Resend: the code shows up in the API terminal.
    console.log(`\n  Código para ${to}: ${otp}\n`)
    return
  }

  const copy = COPY[lang]
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Blackjack with Friends <onboarding@resend.dev>',
      to: [to],
      subject: copy.subject(otp),
      text: copy.text(otp),
      html: copy.html(otp),
    }),
  })
  if (!response.ok) {
    throw new Error(`Resend respondió ${response.status}: ${await response.text()}`)
  }
}
