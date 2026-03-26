/**
 * Günlük özet e-postası gönderme endpoint'i.
 * POST /api/admin/daily-summary
 * Body: { date?: string }  — yoksa bugün kullanılır
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getWorkReportsFiltered, getAllSites } from "@/lib/database"
import { isEmailSendEnabled, sendReportEmail } from "@/lib/email"
import { buildDailySummaryEmail } from "@/lib/email-templates"
import { detectDailyAnomalies } from "@/lib/anomaly-detection"
import type { DailySummaryData } from "@/lib/email-templates"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()

    const body = await request.json().catch(() => ({}))
    const date: string = body.date || new Date().toISOString().slice(0, 10)
    const recipients: string[] = body.recipients?.length ? body.recipients : []

    // O güne ait tüm raporları çek
    const reports = await getWorkReportsFiltered({ startDate: date, endDate: date })
    const allSites = await getAllSites()

    // Şantiye bazında grupla
    const siteMap = new Map<number | null, typeof reports>()
    for (const r of reports) {
      const key = r.site_id ?? null
      if (!siteMap.has(key)) siteMap.set(key, [])
      siteMap.get(key)!.push(r)
    }

    const reportedSiteIds = new Set(reports.map((r: any) => r.site_id).filter(Boolean))
    const missingReportSites = allSites
      .filter((s: any) => !reportedSiteIds.has(s.id))
      .map((s: any) => ({ siteName: s.name, siteCode: s.code }))

    const summaryData: DailySummaryData = {
      date,
      totalReports: reports.length,
      sites: [],
      missingReportSites,
    }

    for (const [siteId, siteReports] of siteMap.entries()) {
      const siteInfo = siteId != null ? allSites.find((s: any) => s.id === siteId) : null
      const siteName = siteInfo?.name ?? (siteReports[0]?.project ?? "Bilinmeyen Şantiye")
      const siteCode = siteInfo?.code ?? null

      const totalPiles = siteReports.reduce((s: number, r: any) => s + (parseInt(r.daily_pile_count ?? "", 10) || 0), 0)
      const totalPersonnel = siteReports.reduce((s: number, r: any) => s + (parseInt(r.personnel_total ?? "", 10) || 0), 0)
      const totalExpenses = siteReports.reduce((s: number, r: any) => {
        if (!Array.isArray(r.expenses)) return s
        return s + r.expenses.reduce((es: number, e: { amount?: string | number }) =>
          es + (parseFloat(String(e.amount ?? "0")) || 0), 0)
      }, 0)

      const anomalyInputs = siteReports.map((r: any) => ({
        machineHours: r.machine_hours,
        dailyPileCount: r.daily_pile_count,
        personnelTotal: r.personnel_total,
        dailyFuelUsage: r.daily_fuel_usage,
        expenseTotal: totalExpenses / siteReports.length,
        remainingPiles: r.remaining_piles,
      }))
      const anomalies = detectDailyAnomalies(anomalyInputs)

      summaryData.sites.push({
        siteName,
        siteCode,
        reportCount: siteReports.length,
        totalPiles,
        totalPersonnel,
        totalExpenses,
        anomalies,
      })
    }

    const { subject, html } = buildDailySummaryEmail(summaryData)

    // Alıcılar: istekten gelen > varsayılan admin listesi
    const to = recipients.length > 0 ? recipients : ["admin@company.com"]

    let emailSent = false
    let emailError: string | undefined

    if (isEmailSendEnabled()) {
      const result = await sendReportEmail({ to, subject, html })
      emailSent = result.sent
      emailError = result.error
    } else {
      emailError = "SMTP yapılandırılmamış veya ENABLE_EMAIL_SEND=true değil."
    }

    return NextResponse.json({
      ok: true,
      date,
      totalReports: reports.length,
      emailSent,
      emailError,
      recipients: to,
      preview: html,  // Admin önizleme için
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Daily summary error:", error)
    return NextResponse.json({ error: "Günlük özet oluşturulamadı.", detail: message }, { status: 500 })
  }
}
