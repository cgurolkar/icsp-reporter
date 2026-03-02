import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { saveWorkReport, initializeDatabase, getSiteReportEmails, getSiteById, getLastReportRemainingBySite } from "@/lib/database"
import { isEmailSendEnabled, sendReportEmail } from "@/lib/email"
import { generatePDFMainReport, generatePDFExpensesPage } from "@/lib/report-html"

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    // Normalize to avoid undefined access and "Failed to generate report"
    const basicInfo = raw.basicInfo ?? {}
    const machineSelection = raw.machineSelection ?? {}
    const fuel = raw.fuel ?? {}
    const basicInfoMachines = Array.isArray(basicInfo.machines) ? basicInfo.machines : []
    const additionalMachines = Array.isArray(machineSelection.additionalMachines) ? machineSelection.additionalMachines : []
    const fuelMachines = Array.isArray(fuel.machines) ? fuel.machines : []
    const productionSummary = Array.isArray(raw.productionSummary) ? raw.productionSummary : []
    const pileDetails = Array.isArray(raw.pileDetails) ? raw.pileDetails : []
    const currentIndex = typeof machineSelection.currentMachineIndex === "number" ? machineSelection.currentMachineIndex : 0

    const formData = {
      ...raw,
      basicInfo: { ...basicInfo, machines: basicInfoMachines },
      machineSelection: { ...machineSelection, additionalMachines },
      fuel: { ...fuel, machines: fuelMachines },
      productionSummary,
      pileDetails,
    }

    // Initialize database tables
    await initializeDatabase()

    // Save report to PostgreSQL
    const currentMachine = basicInfoMachines[currentIndex]
    const currentProductionSummary = productionSummary[currentIndex]
    // Yapılan kazık sayısı: Beton Dökülen (concretePoured) = o gün yapılan; tüm makineler toplamı (kümülatif mantık)
    const concretePouredSum = productionSummary.reduce((s: number, m: { concretePoured?: string }) => s + (parseInt(m?.concretePoured ?? "", 10) || 0), 0)
    const dailyPileForDb = currentProductionSummary?.dailyPileCount?.trim() || (concretePouredSum ? String(concretePouredSum) : "")
    const totalPileForDb = currentProductionSummary?.totalPileCount?.trim() || dailyPileForDb

    const rawSiteId = formData.basicInfo?.siteId
    const siteId = rawSiteId == null || rawSiteId === "" ? null : Number(rawSiteId)
    const siteIdForDb = siteId != null && !Number.isNaN(siteId) ? siteId : null
    let projectName = (formData.basicInfo?.project ?? "").trim()
    let site: Awaited<ReturnType<typeof getSiteById>> = null
    if (siteIdForDb) {
      site = await getSiteById(siteIdForDb)
      if (site?.name) projectName = site.name
    }
    // Kalan kazık: Yeni proje = 0 başlangıç; Devam eden = rapor başlangıcında girilen yapılan düşülür. Kümülatif = önceki yapılan + bugün
    let remainingPilesForDb = currentProductionSummary?.remainingPiles ?? ""
    if (siteIdForDb && site) {
      const totalPiles = site.total_piles != null ? Number(site.total_piles) : null
      const last = await getLastReportRemainingBySite(siteIdForDb)
      let cumulativeDoneBeforeToday = 0
      if (last?.remainingPiles != null && totalPiles != null) {
        cumulativeDoneBeforeToday = totalPiles - (parseInt(String(last.remainingPiles), 10) || 0)
      } else if (site.is_ongoing && site.initial_piles_done != null) {
        cumulativeDoneBeforeToday = Number(site.initial_piles_done)
      }
      const todayPiles = concretePouredSum || 0
      if (totalPiles != null) {
        remainingPilesForDb = String(Math.max(0, totalPiles - cumulativeDoneBeforeToday - todayPiles))
      }
    }
    const reportId = await saveWorkReport({
      date: formData.basicInfo.date,
      project: projectName || (formData.basicInfo?.project ?? ""),
      siteId: siteIdForDb,
      selectedMachineId: formData.machineSelection.selectedMachine?.id,
      selectedMachineName: formData.machineSelection.selectedMachine?.name,
      machineHours: currentMachine?.machineHours || "",
      totalProduction: currentMachine?.totalProduction || "",
      pileCount: currentMachine?.pileCount || "",
      drilledPile: currentMachine?.drilledPile || "",
      concretePile: currentMachine?.concretePile || "",
      totalProductionSummary: currentProductionSummary?.totalProduction || "",
      totalPileCount: totalPileForDb || currentProductionSummary?.totalPileCount || "",
      dailyPileCount: dailyPileForDb || currentProductionSummary?.dailyPileCount || "",
      totalCompletedPiles: currentProductionSummary?.totalCompletedPiles || "",
      remainingPiles: remainingPilesForDb,
      steelLoweredPiles: currentProductionSummary?.steelLoweredPiles || "",
      concretePoured: currentProductionSummary?.concretePoured || "",
      engineerCount: formData.personnel.engineer,
      foremanCount: formData.personnel.foreman,
      operatorCount: formData.personnel.operator,
      oilerCount: formData.personnel.oiler,
      welderCount: formData.personnel.welder,
      otherCount: formData.personnel.other,
      personnelTotal: formData.personnel.total,
      craneCount: formData.vehicles.crane,
      loaderCount: formData.vehicles.loader,
      truckCount: formData.vehicles.truck,
      pickupCount: formData.vehicles.pickup,
      carCount: formData.vehicles.car,
      serviceCount: formData.vehicles.service,
      vehiclesTotal: formData.vehicles.total,
      dailyFuelUsage: (() => {
        const note = formData.fuel.dailyUsage?.trim()
        const machinesSum = (formData.fuel.machines || []).reduce((s: number, m: { used?: string }) => s + (parseFloat(m?.used ?? "") || 0), 0)
        if (note) return note
        if (machinesSum > 0) return String(machinesSum)
        return ""
      })(),
      expenses: formData.expenses,
      pileDetails: formData.pileDetails,
      notes: formData.notes,
      dailyNotes: formData.dailyInfo?.notes ?? null,
      dailyImage1: (formData.dailyInfo?.image1 && String(formData.dailyInfo.image1).startsWith("data:")) ? formData.dailyInfo.image1 : null,
      dailyImage2: (formData.dailyInfo?.image2 && String(formData.dailyInfo.image2).startsWith("data:")) ? formData.dailyInfo.image2 : null,
      selectedMachine: formData.machineSelection.selectedMachine,
      additionalMachines: formData.machineSelection.additionalMachines,
      fuelMachines: formData.fuel.machines,
    })

    // E-posta listesi: önce şantiye bazlı, yoksa varsayılan
    const siteEmails = await getSiteReportEmails(siteIdForDb)
    const settings = siteEmails.length > 0
      ? { emails: siteEmails, users: [], customFields: [] }
      : await getDefaultEmailSettings()

    // Rapor HTML içeriği (e-posta gövdesi / yazdırma için) — hesaplanan kalan/günlük kazık kullanılsın
    const mainReportContent = generatePDFMainReport(formData, {
      computedRemainingPiles: remainingPilesForDb,
      computedDailyPileCount: dailyPileForDb,
      concretePouredSum,
    })
    const expensesPageContent = generatePDFExpensesPage(formData)
    const fullHtml = mainReportContent + expensesPageContent
    const subject = `Günlük Çalışma Raporu - ${formData.basicInfo.date} - ${formData.basicInfo.project}`

    // Şantiye proje koduyla klasöre PDF/HTML kaydet (public/reports/{siteCode}/report-{date}-{id}.html)
    try {
      const siteCode = (site?.code && String(site.code).trim()) || "genel"
      const safeCode = siteCode.replace(/[^a-zA-Z0-9_-]/g, "_")
      const dateStr = (formData.basicInfo.date || "").slice(0, 10).replace(/-/g, "-")
      const dir = path.join(process.cwd(), "public", "reports", safeCode)
      fs.mkdirSync(dir, { recursive: true })
      const filename = `report-${dateStr}-${reportId}.html`
      const filePath = path.join(dir, filename)
      fs.writeFileSync(filePath, fullHtml, "utf-8")
    } catch (saveErr) {
      console.warn("Report HTML save to disk failed:", saveErr)
    }

    let emailSent = false
    let emailError: string | undefined

    if (settings.emails.length > 0 && isEmailSendEnabled()) {
      const result = await sendReportEmail({
        to: settings.emails,
        subject,
        html: fullHtml,
      })
      emailSent = result.sent
      emailError = result.error
      if (result.sent) {
        console.log(`Report ${reportId}: email sent to ${settings.emails.join(", ")}`)
      } else if (result.error) {
        console.warn(`Report ${reportId}: email failed -`, result.error)
      }
    } else {
      if (settings.emails.length === 0) {
        console.log(`Report ${reportId}: no recipients configured, email skipped`)
      } else {
        console.log(`Report ${reportId}: SMTP not configured (ENABLE_EMAIL_SEND / SMTP_*), email skipped. Recipients would be: ${settings.emails.join(", ")}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Report generated and saved successfully",
      reportId: reportId,
      recipients: settings.emails,
      emailSent,
      emailError: emailError ?? undefined,
      emailContent: fullHtml,
      expensesContent: expensesPageContent,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("Error generating report:", error)
    return NextResponse.json(
      { error: "Failed to generate report", detail: message },
      { status: 500 }
    )
  }
}

async function getDefaultEmailSettings() {
  return {
    emails: ["admin@company.com", "manager@company.com"],
    users: ["admin"],
    customFields: [],
  }
}

