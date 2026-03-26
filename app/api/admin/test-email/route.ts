/**
 * E-posta yapılandırmasını test eder.
 * POST /api/admin/test-email
 * Body: { to?: string }  — boşsa SMTP_USER'a gönderir
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canManageIdariCentral } from "@/lib/auth"
import { isEmailSendEnabled, sendReportEmail } from "@/lib/email"
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
  const smtpUser = process.env.SMTP_USER || ""
  const to = body.to?.trim() || smtpUser

  if (!to) {
    return NextResponse.json({ ok: false, error: "Alıcı e-posta adresi belirtilmedi ve SMTP_USER tanımlı değil." }, { status: 400 })
  }

  const { subject, html } = buildTestEmail()
  const result = await sendReportEmail({ to: [to], subject, html })

  if (result.sent) {
    return NextResponse.json({ ok: true, message: `Test e-postası ${to} adresine gönderildi.` })
  } else {
    return NextResponse.json({ ok: false, error: result.error || "Gönderme başarısız." }, { status: 500 })
  }
}
