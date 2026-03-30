import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { saveWorkReport, initializeDatabase, getSiteReportEmails, getSiteById, getLastReportRemainingBySite, getOperatorEntriesBySiteAndDate, syncExpensesToIslemler } from "@/lib/database"
import { isEmailSendEnabled, sendReportEmail } from "@/lib/email"
import { generatePDFMainReport, generatePDFExpensesPage } from "@/lib/report-html"
import { getSessionFromRequest, canDoDataEntry } from "@/lib/auth"
import { buildReportNotificationEmail } from "@/lib/email-templates"
import { detectReportAnomalies } from "@/lib/anomaly-detection"
import { publishNotification } from "@/lib/notification-bus"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  if (!canDoDataEntry(session.role)) {
    return NextResponse.json({ error: "Bilgi girişi yetkiniz yok." }, { status: 403 })
  }
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
    if (session.role === "user" || session.role === "personel") {
      if (session.siteId == null) {
        return NextResponse.json({ error: "Size atanmış şantiye yok. Bilgi girişi yapamazsınız." }, { status: 403 })
      }
      if (siteIdForDb !== session.siteId) {
        return NextResponse.json({ error: "Sadece görevli olduğunuz şantiye için rapor gönderebilirsiniz." }, { status: 403 })
      }
    }
    let projectName = (formData.basicInfo?.project ?? "").trim()
    let site: Awaited<ReturnType<typeof getSiteById>> = null
    if (siteIdForDb) {
      site = await getSiteById(siteIdForDb)
      if (site?.name) projectName = site.name
    }
    const operatorEntries = siteIdForDb && formData.basicInfo?.date
      ? await getOperatorEntriesBySiteAndDate(siteIdForDb, formData.basicInfo.date)
      : []
    const firstOperatorHours = operatorEntries.length > 0 && operatorEntries[0]?.machine_hours
      ? String(operatorEntries[0].machine_hours).trim()
      : ""
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
      machineHours: firstOperatorHours || currentMachine?.machineHours || "",
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
      nextDayPlanned: (formData.dailyInfo?.nextDayPlannedWork && String(formData.dailyInfo.nextDayPlannedWork).trim()) ? String(formData.dailyInfo.nextDayPlannedWork).trim() : null,
      selectedMachine: formData.machineSelection.selectedMachine,
      additionalMachines: formData.machineSelection.additionalMachines,
      fuelMachines: formData.fuel.machines,
    })

    // Harcamaları islemler tablosuna senkronize et (idari modülle senkron)
    if (siteIdForDb && Array.isArray(formData.expenses) && formData.expenses.length > 0) {
      try {
        await syncExpensesToIslemler(
          reportId,
          siteIdForDb,
          formData.basicInfo.date,
          session.id,
          formData.expenses
        )
      } catch (syncErr) {
        console.warn(`Report ${reportId}: expense sync to islemler failed:`, syncErr)
      }
    }

    // Puantaj senkronizasyonu: formdan gelen puantaj verilerini idari puantaj tablosuna kaydet
    if (siteIdForDb && Array.isArray(formData.puantaj) && formData.puantaj.length > 0) {
      try {
        const dbPool = (await import("@/lib/database")).default
        const pc = await dbPool.connect()
        try {
          for (const entry of formData.puantaj as Array<{
            personel_id: number; carpan: number; durum_kod: string; mesai_saat: number; notlar: string
          }>) {
            await pc.query(
              `INSERT INTO puantaj (personel_id, site_id, tarih, carpan, durum_kod, mesai_saat, notlar, durum, olusturan_id)
               VALUES ($1,$2,$3,$4,$5,$6,$7,'taslak',$8)
               ON CONFLICT (personel_id, site_id, tarih)
               DO UPDATE SET carpan=$4, durum_kod=$5, mesai_saat=$6, notlar=$7, updated_at=NOW()
               WHERE puantaj.durum <> 'onaylandi'`,
              [entry.personel_id, siteIdForDb, formData.basicInfo.date,
               entry.carpan, entry.durum_kod, entry.mesai_saat,
               entry.notlar || null, session.id]
            )
          }
        } finally {
          pc.release()
        }
      } catch (puantajErr) {
        console.warn(`Report ${reportId}: puantaj sync failed:`, puantajErr)
      }
    }

    // SSE: admin dashboard'a anlık bildirim gönder (fire-and-forget)
    try {
      const expTotalForNotif = Array.isArray(formData.expenses)
        ? formData.expenses.reduce((s: number, e: { amount?: string | number }) => s + (parseFloat(String(e.amount ?? "0")) || 0), 0)
        : 0
      const anomaliesForNotif = detectReportAnomalies({
        machineHours: firstOperatorHours || currentMachine?.machineHours,
        dailyPileCount: dailyPileForDb,
        personnelTotal: formData.personnel?.total,
        remainingPiles: remainingPilesForDb,
        expenseTotal: expTotalForNotif || null,
      })
      publishNotification({
        type: anomaliesForNotif.length > 0 ? "anomaly" : "new_report",
        title: `Yeni Rapor: ${projectName || "Şantiye"}`,
        message: `${formData.basicInfo.date} tarihli rapor gönderildi.${dailyPileForDb ? ` Kazık: ${dailyPileForDb}` : ""}`,
        siteName: projectName || site?.name || "Şantiye",
        siteCode: site?.code,
        reportId,
        date: formData.basicInfo.date,
        anomalyCount: anomaliesForNotif.length,
      })
    } catch (notifErr) {
      console.warn("Notification publish failed:", notifErr)
    }

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
      operatorEntries,
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
      // Harcama toplamını hesapla
      const expenseTotal = Array.isArray(formData.expenses)
        ? formData.expenses.reduce((s: number, e: { amount?: string | number }) => s + (parseFloat(String(e.amount ?? "0")) || 0), 0)
        : null

      // Anomali tespiti
      const anomalies = detectReportAnomalies({
        machineHours: firstOperatorHours || currentMachine?.machineHours,
        dailyPileCount: dailyPileForDb,
        personnelTotal: formData.personnel?.total,
        dailyFuelUsage: formData.fuel?.dailyUsage || (formData.fuel?.machines || []).reduce((s: number, m: { used?: string }) => s + (parseFloat(m?.used ?? "") || 0), 0) || null,
        expenseTotal: expenseTotal || null,
        remainingPiles: remainingPilesForDb,
        notes: formData.notes,
        dailyNotes: formData.dailyInfo?.notes,
        selectedMachineName: formData.machineSelection?.selectedMachine?.name,
      })

      // Temiz özet e-posta — tam HTML rapor yerine
      const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || ""
      const reportUrl = appUrl ? `${appUrl}/api/reports/${reportId}/preview` : undefined

      const { subject: emailSubject, html: emailHtml } = buildReportNotificationEmail({
        reportId,
        date: formData.basicInfo.date,
        siteName: projectName || site?.name || "Şantiye",
        siteCode: site?.code,
        project: projectName,
        submittedBy: session.username || session.role,
        dailyPileCount: dailyPileForDb,
        totalPileCount: totalPileForDb,
        remainingPiles: remainingPilesForDb,
        concretePoured: currentProductionSummary?.concretePoured,
        personnelTotal: formData.personnel?.total,
        engineerCount: formData.personnel?.engineer,
        machineHours: firstOperatorHours || currentMachine?.machineHours,
        selectedMachineName: formData.machineSelection?.selectedMachine?.name,
        dailyFuelUsage: formData.fuel?.dailyUsage || ((formData.fuel?.machines || []).reduce((s: number, m: { used?: string }) => s + (parseFloat(m?.used ?? "") || 0), 0) || null),
        expenseTotal: expenseTotal || null,
        notes: formData.notes,
        dailyNotes: formData.dailyInfo?.notes,
        anomalies,
        reportUrl,
      })

      const result = await sendReportEmail({
        to: settings.emails,
        subject: emailSubject,
        html: emailHtml,
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

