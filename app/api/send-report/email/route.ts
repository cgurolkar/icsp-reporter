/**
 * POST /api/send-report/email
 * E-posta gönderme — sadece email; rapor zaten kaydedilmiş olmalı.
 * Body: { reportId, formData }
 */
import { type NextRequest, NextResponse } from "next/server"
import { getMergedNotificationEmails, getSiteById, getOperatorEntriesBySiteAndDate, getCumulativeTotalProduction, getSuperAdminEmails } from "@/lib/database"
import { isEmailSendEnabled, sendReportEmail } from "@/lib/email"
import { generatePDFMainReport, generatePDFExpensesPage } from "@/lib/report-html"
import { getSessionFromRequest, canDoDataEntry } from "@/lib/auth"
import { buildReportNotificationEmail, buildOperatorReportEmail } from "@/lib/email-templates"
import { detectReportAnomalies } from "@/lib/anomaly-detection"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canDoDataEntry(session.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 })

  try {
    const body = await request.json()
    const reportId: number = Number(body.reportId)
    const raw = body.formData ?? {}
    if (!reportId || Number.isNaN(reportId)) {
      return NextResponse.json({ error: "Geçersiz rapor ID." }, { status: 400 })
    }

    const basicInfo = raw.basicInfo ?? {}
    const machineSelection = raw.machineSelection ?? {}
    const fuel = raw.fuel ?? {}
    const basicInfoMachines = Array.isArray(basicInfo.machines) ? basicInfo.machines : []
    const additionalMachines = Array.isArray(machineSelection.additionalMachines) ? machineSelection.additionalMachines : []
    const fuelMachines = Array.isArray(fuel.machines) ? fuel.machines : []
    const productionSummary = Array.isArray(raw.productionSummary) ? raw.productionSummary : []
    const currentIndex = typeof machineSelection.currentMachineIndex === "number" ? machineSelection.currentMachineIndex : 0
    const formData = {
      ...raw,
      basicInfo: { ...basicInfo, machines: basicInfoMachines },
      machineSelection: { ...machineSelection, additionalMachines },
      fuel: { ...fuel, machines: fuelMachines },
      productionSummary,
    }

    const rawSiteId = basicInfo.siteId
    const siteId = rawSiteId == null || rawSiteId === "" ? null : Number(rawSiteId)
    const siteIdForDb = siteId != null && !Number.isNaN(siteId) ? siteId : null

    let projectName = (basicInfo.project ?? "").trim()
    let site: Awaited<ReturnType<typeof getSiteById>> = null
    if (siteIdForDb) {
      site = await getSiteById(siteIdForDb)
      if (site?.name) projectName = site.name
    }

    const operatorEntries = siteIdForDb && basicInfo.date
      ? await getOperatorEntriesBySiteAndDate(siteIdForDb, basicInfo.date)
      : []

    const projectStartDate = site?.project_start_date ? String(site.project_start_date).slice(0, 10) : null
    const reportDateStr = (basicInfo.date ?? "").slice(0, 10)
    const daysElapsed = projectStartDate && reportDateStr
      ? Math.max(0, Math.floor((new Date(`${reportDateStr}T00:00:00Z`).getTime() - new Date(`${projectStartDate}T00:00:00Z`).getTime()) / 86400000) + 1)
      : null
    const cumulativeTotalProduction = siteIdForDb && reportDateStr
      ? await getCumulativeTotalProduction(siteIdForDb, reportDateStr)
      : null

    const currentMachine = basicInfoMachines[currentIndex]
    const currentProductionSummary = productionSummary[currentIndex]
    const concretePouredSum = productionSummary.reduce((s: number, m: { concretePoured?: string }) => s + (parseInt(m?.concretePoured ?? "", 10) || 0), 0)
    const dailyPileForDb = currentProductionSummary?.dailyPileCount?.trim() || (concretePouredSum ? String(concretePouredSum) : "")
    const totalPileForDb = currentProductionSummary?.totalPileCount?.trim() || dailyPileForDb

    const reportRecipients = await getMergedNotificationEmails({ siteId: siteIdForDb })

    if (reportRecipients.length === 0) {
      return NextResponse.json({ success: false, error: "E-posta alıcısı tanımlı değil." })
    }
    if (!isEmailSendEnabled()) {
      return NextResponse.json({ success: false, error: "E-posta gönderimi etkin değil (SMTP ayarları eksik)." })
    }

    const mainReportContent = generatePDFMainReport(formData, {
      computedRemainingPiles: currentProductionSummary?.remainingPiles ?? "",
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

    const expenseTotal = Array.isArray(formData.expenses)
      ? formData.expenses.reduce((s: number, e: { amount?: string | number }) => s + (parseFloat(String(e.amount ?? "0")) || 0), 0)
      : null

    const anomalies = detectReportAnomalies({
      machineHours: currentMachine?.machineHours,
      dailyPileCount: dailyPileForDb,
      personnelTotal: formData.personnel?.total,
      remainingPiles: currentProductionSummary?.remainingPiles,
      expenseTotal: expenseTotal || null,
    })

    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || ""
    const reportUrl = appUrl ? `${appUrl}/api/reports/${reportId}/preview` : undefined

    const { subject: emailSubject, html: emailHtml } = buildReportNotificationEmail({
      reportId,
      date: basicInfo.date,
      siteName: projectName || site?.name || "Şantiye",
      siteCode: site?.code,
      project: projectName,
      submittedBy: session.username || session.role,
      dailyPileCount: dailyPileForDb,
      totalPileCount: totalPileForDb,
      remainingPiles: currentProductionSummary?.remainingPiles,
      concretePoured: currentProductionSummary?.concretePoured,
      personnelTotal: formData.personnel?.total,
      engineerCount: formData.personnel?.engineer,
      machineHours: currentMachine?.machineHours,
      selectedMachineName: formData.machineSelection?.selectedMachine?.name,
      dailyFuelUsage: formData.fuel?.dailyUsage || ((formData.fuel?.machines || []).reduce((s: number, m: { used?: string }) => s + (parseFloat(m?.used ?? "") || 0), 0) || null),
      expenseTotal: expenseTotal || null,
      notes: formData.notes,
      dailyNotes: formData.dailyInfo?.notes,
      anomalies,
      reportUrl,
    })

    const result = await sendReportEmail({ to: reportRecipients, subject: emailSubject, html: emailHtml })

    // Operatör raporu ayrıca super admin'e
    if (operatorEntries.length > 0) {
      const superAdminEmails = await getSuperAdminEmails()
      if (superAdminEmails.length > 0) {
        const opMail = buildOperatorReportEmail({
          reportId, date: basicInfo.date,
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
