import nodemailer from "nodemailer"

const getEnv = (key: string) => process.env[key] ?? ""

/**
 * SMTP ayarları .env üzerinden:
 * SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
 * E-posta gönderimini açmak için: ENABLE_EMAIL_SEND=true ve SMTP bilgilerini doldurun.
 */
function getTransporter() {
  const host = getEnv("SMTP_HOST")
  const port = parseInt(getEnv("SMTP_PORT") || "587", 10)
  const secure = getEnv("SMTP_SECURE") === "true"
  const user = getEnv("SMTP_USER")
  const pass = getEnv("SMTP_PASSWORD")

  if (!host || !user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port: Number.isNaN(port) ? 587 : port,
    secure,
    auth: { user, pass },
  })
}

export function isEmailSendEnabled(): boolean {
  return getEnv("ENABLE_EMAIL_SEND").toLowerCase() === "true" && !!getTransporter()
}

export interface SendReportEmailOptions {
  to: string[]
  subject: string
  html: string
  from?: string
}

/**
 * Rapor e-postası gönderir. SMTP yapılandırılmamışsa veya ENABLE_EMAIL_SEND=false ise
 * hiç göndermez ve { sent: false } döner.
 */
export async function sendReportEmail(options: SendReportEmailOptions): Promise<{ sent: boolean; error?: string }> {
  const transporter = getTransporter()
  if (!transporter || options.to.length === 0) {
    return { sent: false }
  }

  const from = options.from || getEnv("SMTP_FROM") || getEnv("SMTP_USER") || "rapor@localhost"

  try {
    await transporter.sendMail({
      from,
      to: options.to.join(", "),
      subject: options.subject,
      html: options.html,
    })
    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("Email send error:", message)
    return { sent: false, error: message }
  }
}
