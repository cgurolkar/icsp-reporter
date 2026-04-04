/**
 * E-posta yapılandırmasını test eder.
 * POST /api/admin/test-email
 * Body: { to?: string }  — isteğe bağlı ek alıcı
 * Alıcılar: SMTP_USER + global_admin_settings (Postgres) (+ body.to), tekilleştirilmiş.
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canManageIdariCentral } from "@/lib/auth"
import { getMergedNotificationEmails } from "@/lib/database"
import { isEmailSendEnabled, sendReportEmail, verifySmtpConnection } from "@/lib/email"
import { buildTestEmail } from "@/lib/email-templates"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  if (!isEmailSendEnabled()) {
    return NextResponse.json({
      ok: false,
      error: "E-posta gönderimi etkin değil. .env dosyasında ENABLE_EMAIL_SEND=true ve SMTP_* değerlerini ayarlayın.",
    }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const extra = body.to?.trim()
  const recipients = await getMergedNotificationEmails({
    siteId: null,
    extraRecipients: extra ? [extra] : [],
  })

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Alıcı yok: SMTP_USER tanımlayın veya admin panelinde en az bir e-posta ekleyin.",
      },
      { status: 400 },
    )
  }

  const verify = await verifySmtpConnection()
  if (!verify.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SMTP bağlantı / TLS doğrulaması başarısız. Natro/kurumsaleposta: SMTP_TLS_SERVERNAME=natrohost.com; Docker kullanıyorsanız compose içinde bu değişkeni geçirin. 587 + SMTP_SECURE=false veya 465 + SMTP_SECURE=true deneyin.",
        detail: verify.error,
      },
      { status: 500 },
    )
  }

  const { subject, html } = buildTestEmail()
  const result = await sendReportEmail({ to: recipients, subject, html })

  if (result.sent) {
    return NextResponse.json({
      ok: true,
      message: `Test e-postası gönderildi: ${recipients.join(", ")}`,
      recipients,
    })
  } else {
    return NextResponse.json(
      { ok: false, error: "Test e-postası gönderilemedi.", detail: result.error || undefined },
      { status: 500 },
    )
  }
}
