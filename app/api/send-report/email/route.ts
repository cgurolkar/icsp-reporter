/**
 * POST /api/send-report/email
 * Rapor zaten kayıtlı olmalı. Rapor içeriği veritabanından okunur (küçük istek gövdesi, görseller kayıplı olmaz).
 * Body: { reportId: number }
 */
import { type NextRequest, NextResponse } from "next/server"
import {
  getMergedNotificationEmails,
  getSiteById,
  getOperatorEntriesBySiteAndDate,
  getCumulativeTotalProduction,
  getSuperAdminEmails,
  getWorkReportById,
  initializeDatabase,
} from "@/lib/database"
import { fullReportHtmlAttachment, isEmailSendEnabled, sendReportEmail } from "@/lib/email"
import { generatePDFMainReport, generatePDFExpensesPage } from "@/lib/report-html"
import { canViewAllSites, canDoDataEntry, getSessionFromRequest } from "@/lib/auth"
import { buildReportNotificationEmail, buildOperatorReportEmail } from "@/lib/email-templates"
import { detectReportAnomalies } from "@/lib/anomaly-detection"
import { formDataFromDbReport } from "@/lib/report-db-formdata"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canDoDataEntry(session.role, session)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 })

  try {
    await initializeDatabase()
    const body = await request.json()
    const reportId: number = Number(body.reportId)
    if (!reportId || Number.isNaN(reportId)) {
      return NextResponse.json({ error: "Geçersiz rapor ID." }, { status: 400 })
    }

    const data = await getWorkReportById(reportId)
    if (!data?.report) {
      return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 })
    }

    const rawReport = data.report as Record<string, unknown>
    const siteId = rawReport.site_id != null ? Number(rawReport.site_id) : null
    const siteIdForDb = siteId != null && !Number.isNaN(siteId) ? siteId : null

    if (!canViewAllSites(session.role, session) && session.siteId !== siteIdForDb) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    }

    const formData = formDataFromDbReport({
      report: rawReport,
      machines: (data.machines || []) as Record<string, unknown>[],
      fuelRecords: (data.fuelRecords || []) as Record<string, unknown>[],
    })

    const basicInfoMachines = Array.isArray(formData.basicInfo.machines) ? formData.basicInfo.machines : []
    const productionSummary = Array.isArray(formData.productionSummary) ? formData.productionSummary : []
    const currentIndex = typeof formData.machineSelection?.currentMachineIndex === "number" ? formData.machineSelection.currentMachineIndex : 0
    const currentMachine = basicInfoMachines[currentIndex]
    const currentProductionSummary = productionSummary[currentIndex]

    let projectName = String(formData.basicInfo?.project ?? "").trim()
    let site: Awaited<ReturnType<typeof getSiteById>> = null
    if (siteIdForDb) {
      site = await getSiteById(siteIdForDb)
      if (site?.name) projectName = site.name
    }

    const reportDateStr =
      rawReport.date instanceof Date
        ? rawReport.date.toISOString().slice(0, 10)
        : typeof rawReport.date === "string"
          ? rawReport.date.slice(0, 10)
          : String(formData.basicInfo.date || "").slice(0, 10)

    const operatorEntries =
      siteIdForDb && reportDateStr ? await getOperatorEntriesBySiteAndDate(siteIdForDb, reportDateStr) : []

    const projectStartDate = site?.project_start_date ? String(site.project_start_date).slice(0, 10) : null
    const daysElapsed =
      projectStartDate && reportDateStr
        ? Math.max(
            0,
            Math.floor(
              (new Date(`${reportDateStr}T00:00:00Z`).getTime() - new Date(`${projectStartDate}T00:00:00Z`).getTime()) /
                86400000,
            ) + 1,
          )
        : null
    const cumulativeTotalProduction =
      siteIdForDb && reportDateStr ? await getCumulativeTotalProduction(siteIdForDb, reportDateStr) : null

    const prodRows = productionSummary as unknown as { concretePoured?: string; dailyDrilledPiles?: string; dailyPileCount?: string }[]
    const concretePoured = parseInt(String(rawReport.concrete_poured ?? ""), 10) || 0
    const concretePouredSumLegacy = prodRows.reduce((s, m) => s + (parseInt(String(m.concretePoured ?? "").trim(), 10) || 0), 0)
    const rawForm = formData as Record<string, unknown>
    const siteConcreteTrim = rawForm.siteConcretePouredPiles != null ? String(rawForm.siteConcretePouredPiles).trim() : ""
    const useSiteConcrete = siteConcreteTrim !== ""
    const concretePouredSum = useSiteConcrete ? (parseInt(siteConcreteTrim, 10) || 0) : (concretePouredSumLegacy || concretePoured)
    const dailyDrilledSum = prodRows.reduce((s, m) => s + (parseInt(String(m.dailyDrilledPiles ?? "").trim(), 10) || 0), 0)
    const drilledAllSet =
      prodRows.length > 0 &&
      prodRows.every((m) => {
        const t = String(m.dailyDrilledPiles ?? "").trim()
        return t !== "" && Number.isFinite(Number(t))
      })
    const curPs = currentProductionSummary as unknown as { dailyPileCount?: string; totalPileCount?: string; remainingPiles?: string } | undefined
    const dailyPileForDb = drilledAllSet
      ? String(dailyDrilledSum)
      : String(curPs?.dailyPileCount ?? "").trim() || (concretePouredSum ? String(concretePouredSum) : "") || (concretePoured ? String(concretePoured) : "")
    const totalPileForDb = String(curPs?.totalPileCount ?? "").trim() || dailyPileForDb

    const reportRecipients = await getMergedNotificationEmails({ siteId: siteIdForDb })

    if (reportRecipients.length === 0) {
      return NextResponse.json({ success: false, error: "E-posta alıcısı tanımlı değil." })
    }
    if (!isEmailSendEnabled()) {
      return NextResponse.json({ success: false, error: "E-posta gönderimi etkin değil (SMTP ayarları eksik)." })
    }

    const mainReportContent = generatePDFMainReport(formData, {
      computedRemainingPiles: String(curPs?.remainingPiles ?? ""),
      computedDailyPileCount: dailyPileForDb,
      concretePouredSum,
      projectStartDate,
      daysElapsed,
      showHakedis: session.role === "super_admin",
      contractUnitPrice: site?.contract_unit_price != null ? Number(site.contract_unit_price) : null,
      cumulativeTotalProduction,
      operatorEntries,
    })
    const expensesPageContent = generatePDFExpensesPage(formData)
    const fullHtml = mainReportContent + expensesPageContent

    const expenseTotal = Array.isArray(formData.expenses)
      ? formData.expenses.reduce((s: number, e: { amount?: string | number }) => s + (parseFloat(String(e.amount ?? "0")) || 0), 0)
      : null

    const fd = formData as Record<string, any>
    const fuelMachines = Array.isArray(fd.fuel?.machines) ? fd.fuel.machines : []
    const fuelUsedSum = fuelMachines.reduce((s: number, m: { used?: string }) => s + (parseFloat(String(m?.used ?? "")) || 0), 0)
    const dailyFuelUsageVal = fd.fuel?.dailyUsage || (fuelUsedSum > 0 ? fuelUsedSum : null)

    const anomalies = detectReportAnomalies({
      machineHours: String(currentMachine?.machineHours ?? ""),
      dailyPileCount: dailyPileForDb,
      personnelTotal: fd.personnel?.total,
      dailyFuelUsage: dailyFuelUsageVal,
      expenseTotal: expenseTotal || null,
      remainingPiles: curPs?.remainingPiles,
      notes: String(fd.notes ?? ""),
      dailyNotes: String(fd.dailyInfo?.notes ?? ""),
      selectedMachineName: String(fd.machineSelection?.selectedMachine?.name ?? ""),
    })

    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || ""
    const reportUrl = appUrl ? `${appUrl}/api/reports/${reportId}/preview` : undefined

    const { subject: emailSubject, html: emailHtml } = buildReportNotificationEmail({
      reportId,
      date: reportDateStr || String(fd.basicInfo?.date ?? ""),
      siteName: projectName || site?.name || "Şantiye",
      siteCode: site?.code,
      project: projectName,
      submittedBy: session.username || session.role,
      dailyPileCount: dailyPileForDb,
      totalPileCount: totalPileForDb,
      remainingPiles: curPs?.remainingPiles,
      concretePoured: String(concretePouredSum),
      personnelTotal: fd.personnel?.total,
      engineerCount: fd.personnel?.engineer,
      machineHours: String(currentMachine?.machineHours ?? ""),
      selectedMachineName: String(fd.machineSelection?.selectedMachine?.name ?? ""),
      dailyFuelUsage: dailyFuelUsageVal,
      expenseTotal: expenseTotal || null,
      notes: String(fd.notes ?? ""),
      dailyNotes: String(fd.dailyInfo?.notes ?? ""),
      anomalies,
      reportUrl,
      attachedFullReport: true,
    })

    const result = await sendReportEmail({
      to: reportRecipients,
      subject: emailSubject,
      html: emailHtml,
      attachments: [fullReportHtmlAttachment(reportId, reportDateStr || String(formData.basicInfo.date), fullHtml)],
    })

    if (operatorEntries.length > 0) {
      const superAdminEmails = await getSuperAdminEmails()
      if (superAdminEmails.length > 0) {
        const opMail = buildOperatorReportEmail({
          reportId,
          date: reportDateStr || formData.basicInfo.date,
          siteName: projectName || site?.name || "Şantiye",
          operatorEntries,
          reportUrl,
        })
        await sendReportEmail({ to: superAdminEmails, subject: opMail.subject, html: opMail.html })
      }
    }

    return NextResponse.json({
      success: result.sent,
      emailSent: result.sent,
      emailError: result.error,
      recipients: reportRecipients,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Error sending report email:", error)
    return NextResponse.json({ error: "E-posta gönderilemedi.", detail: message }, { status: 500 })
  }
}
