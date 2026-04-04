import tls from "node:tls"
import nodemailer from "nodemailer"
import type SMTPTransport from "nodemailer/lib/smtp-transport"

const getEnv = (key: string) => process.env[key]?.trim() ?? ""

function envBool(key: string): boolean {
  const v = getEnv(key).toLowerCase()
  return v === "true" || v === "1" || v === "yes"
}

/**
 * SMTP ayarları .env üzerinden:
 * SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
 * E-posta gönderimini açmak için: ENABLE_EMAIL_SEND=true ve SMTP bilgilerini doldurun.
 *
 * Port 465: SMTP_SECURE=true (SSL). Port 587: SMTP_SECURE=false (STARTTLS).
 * Şifrede @, # veya boşluk varsa değeri çift tırnak içinde yazın: SMTP_PASSWORD="...."
 * SMTP_DEBUG=true ile sunucu konsolunda SMTP diyaloğu loglanır (geçici teşhis).
 * Sertifika alan adı SMTP_HOST ile uyuşmuyorsa (ör. cert: *.natrohost.com):
 *   SMTP_TLS_SERVERNAME=natrohost.com — SNI ve TLS doğrulama ismi (Natro: cert *.natrohost.com, host mail.kurumsaleposta.com).
 * Son çare: SMTP_TLS_INSECURE=true (sertifika doğrulamasını kapatır, MITM riski).
 */
export function getMailTransporter(): nodemailer.Transporter | null {
  const host = getEnv("SMTP_HOST")
  const port = parseInt(getEnv("SMTP_PORT") || "587", 10)
  const secure = envBool("SMTP_SECURE")
  const user = getEnv("SMTP_USER")
  const pass = getEnv("SMTP_PASSWORD")

  if (!host || !user || !pass) {
    return null
  }

  const p = Number.isNaN(port) ? 587 : port
  const tlsReject = !envBool("SMTP_TLS_INSECURE")
  const tlsServername = getEnv("SMTP_TLS_SERVERNAME")

  const opts: SMTPTransport.Options = {
    host,
    port: p,
    secure,
    auth: { user, pass },
    connectionTimeout: parseInt(getEnv("SMTP_CONNECTION_TIMEOUT_MS") || "60000", 10) || 60000,
    greetingTimeout: parseInt(getEnv("SMTP_GREETING_TIMEOUT_MS") || "30000", 10) || 30000,
    tls: {
      rejectUnauthorized: tlsReject,
      minVersion: "TLSv1.2",
      ...(tlsServername
        ? {
            servername: tlsServername,
            // Nodemailer tls.connect(opts) önce host: SMTP_HOST koyuyor; Node sertifikayı bu isimle doğrular.
            host: tlsServername,
            checkServerIdentity(_hostname: string, cert: tls.PeerCertificate) {
              return tls.checkServerIdentity(tlsServername, cert)
            },
          }
        : {}),
    },
  }

  if (envBool("SMTP_DEBUG")) {
    opts.debug = true
    opts.logger = true
  }

  return nodemailer.createTransport(opts)
}

function getTransporter() {
  return getMailTransporter()
}

export function isEmailSendEnabled(): boolean {
  return envBool("ENABLE_EMAIL_SEND") && !!getTransporter()
}

/** Bağlantı / kimlik doğrulama testi; hata mesajı genelde sendMail’den daha açıklayıcıdır. */
export async function verifySmtpConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = getMailTransporter()
  if (!t) {
    return { ok: false, error: "SMTP_HOST, SMTP_USER veya SMTP_PASSWORD eksik." }
  }
  try {
    await t.verify()
    return { ok: true }
  } catch (err) {
    const e = err as { message?: string; code?: string; response?: string; responseCode?: number }
    const parts = [e.message, e.code, e.responseCode != null ? String(e.responseCode) : "", e.response].filter(Boolean)
    return { ok: false, error: parts.join(" — ") || String(err) }
  }
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
    const e = err as { message?: string; code?: string; response?: string; responseCode?: number }
    const message =
      e.response != null
        ? [e.message, e.responseCode != null ? `(${e.responseCode})` : "", e.response].filter(Boolean).join(" ")
        : err instanceof Error
          ? err.message
          : String(err)
    console.error("Email send error:", message)
    return { sent: false, error: message }
  }
}
