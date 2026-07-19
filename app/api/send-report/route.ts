import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import { saveWorkReport, initializeDatabase, getMergedNotificationEmails, getSiteById, getLastReportRemainingBySite, getOperatorEntriesBySiteAndDate, syncExpensesToIslemler, getSuperAdminEmails, getCumulativeTotalProduction, getCumulativePileCounts } from "@/lib/database"
import { formatMeters, sumConcretePouredDrilledMeters } from "@/lib/concrete-meters"
import { fullReportHtmlAttachment, isEmailSendEnabled, sendReportEmail } from "@/lib/email"
import { generatePDFMainReport, generatePDFExpensesPage } from "@/lib/report-html"
import { getSessionFromRequest, canDoDataEntry, canAccessSite, getAllowedSiteIds } from "@/lib/auth"
import { buildReportNotificationEmail, buildOperatorReportEmail } from "@/lib/email-templates"
import { detectReportAnomalies } from "@/lib/anomaly-detection"
import { publishNotification } from "@/lib/notification-bus"

export const maxDuration = 120

export async function POST(request: NextRequest) {
  const ref = randomUUID()
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız.", ref }, { status: 401 })
  }
  if (!canDoDataEntry(session.role, session)) {
    return NextResponse.json({ error: "Bilgi girişi yetkiniz yok.", ref }, { status: 403 })
  }
  try {
    let raw: any
    try {
      raw = await request.json()
    } catch (parseErr) {
      const detail = parseErr instanceof Error ? parseErr.message : String(parseErr)
      console.error(`[send-report ${ref}] request.json failed:`, detail)
      return NextResponse.json(
        {
          error:
            "Rapor verisi sunucuya ulaşamadı veya çok büyük. Fotoğraf sayısını azaltın, interneti kontrol edin ve tekrar deneyin.",
          detail,
          ref,
        },
        { status: 400 }
      )
    }
    // skipEmail: true → save but don't send email (two-step flow)
    const skipEmail = raw.skipEmail === true
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
    const siteConcreteTrim = raw.siteConcretePouredPiles != null ? String(raw.siteConcretePouredPiles).trim() : ""
    const useSiteConcrete = siteConcreteTrim !== ""
    const concretePouredSumLegacy = productionSummary.reduce((s: number, m: { concretePoured?: string }) => s + (parseInt(m?.concretePoured ?? "", 10) || 0), 0)
    const concretePouredSum = useSiteConcrete ? (parseInt(siteConcreteTrim, 10) || 0) : concretePouredSumLegacy
    const dailyDrilledSum = productionSummary.reduce((s: number, m: { dailyDrilledPiles?: string }) => s + (parseInt(String(m?.dailyDrilledPiles ?? "").trim(), 10) || 0), 0)
    const drilledAllSet =
      productionSummary.length > 0 &&
      productionSummary.every((m: { dailyDrilledPiles?: string }) => {
        const t = String(m?.dailyDrilledPiles ?? "").trim()
        return t !== "" && Number.isFinite(Number(t))
      })
    const dailyPileForDb = drilledAllSet
      ? String(dailyDrilledSum)
      : currentProductionSummary?.dailyPileCount?.trim() || (concretePouredSum ? String(concretePouredSum) : "")
    const totalPileForDb = currentProductionSummary?.totalPileCount?.trim() || dailyPileForDb

    const rawSiteId = formData.basicInfo?.siteId
    const siteId = rawSiteId == null || rawSiteId === "" ? null : Number(rawSiteId)
    let siteIdForDb = siteId != null && !Number.isNaN(siteId) ? siteId : null
    if (session.role === "user" || session.role === "personel" || session.role === "engineer") {
      const allowed = getAllowedSiteIds(session)
      if (allowed == null || allowed.length === 0) {
        return NextResponse.json({ error: "Size atanmış şantiye yok. Bilgi girişi yapamazsınız.", ref }, { status: 403 })
      }
      // İstemci siteId göndermeyebilir (eski taslak / yükleme yarışı); birincil şantiye ile tamamla
      if (siteIdForDb == null) {
        siteIdForDb = allowed[0]
      }
      if (!canAccessSite(session, Number(siteIdForDb))) {
        return NextResponse.json({ error: "Sadece görevli olduğunuz şantiye için rapor gönderebilirsiniz.", ref }, { status: 403 })
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
    const projectStartDate = site?.project_start_date ? String(site.project_start_date).slice(0, 10) : null
    const reportDateStr = (formData.basicInfo?.date ?? "").slice(0, 10)
    const daysElapsed = projectStartDate && reportDateStr
      ? Math.max(0, Math.floor((new Date(`${reportDateStr}T00:00:00Z`).getTime() - new Date(`${projectStartDate}T00:00:00Z`).getTime()) / 86400000) + 1)
      : null
    const cumulativeTotalProduction = siteIdForDb && reportDateStr
      ? await getCumulativeTotalProduction(siteIdForDb, reportDateStr)
      : null
    // Kalan kazık: Yeni proje = 0 başlangıç; Devam eden = rapor başlangıcında girilen yapılan düşülür. Kümülatif = önceki yapılan + bugün
    let remainingPilesForDb = currentProductionSummary?.remainingPiles ?? ""
    let cumulativeConcreteAfterToday = 0
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
      cumulativeConcreteAfterToday = cumulativeDoneBeforeToday + todayPiles
      if (totalPiles != null) {
        remainingPilesForDb = String(Math.max(0, totalPiles - cumulativeConcreteAfterToday))
      }
    }
    const totalProductionAllMachines = productionSummary.reduce(
      (s: number, m: { totalProduction?: string }) =>
        s + (parseFloat(String(m?.totalProduction ?? "").replace(",", ".")) || 0),
      0,
    )
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
      totalProductionSummary:
        totalProductionAllMachines > 0
          ? String(totalProductionAllMachines)
          : (currentProductionSummary?.totalProduction || ""),
      totalPileCount: totalPileForDb || currentProductionSummary?.totalPileCount || "",
      dailyPileCount: dailyPileForDb || currentProductionSummary?.dailyPileCount || "",
      totalCompletedPiles:
        cumulativeConcreteAfterToday > 0
          ? String(cumulativeConcreteAfterToday)
          : (currentProductionSummary?.totalCompletedPiles || ""),
      remainingPiles: remainingPilesForDb,
      steelLoweredPiles: currentProductionSummary?.steelLoweredPiles || "",
      concretePoured: String(concretePouredSum),
      concreteTotalLength: (() => {
        const fromForm = String(raw.siteConcreteTotalLength ?? "").trim()
        if (fromForm !== "") return fromForm
        const fromPiles = sumConcretePouredDrilledMeters(pileDetails)
        return fromPiles > 0 ? formatMeters(fromPiles) : ""
      })(),
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
      ...((): { dailyImage1: string | null; dailyImage2: string | null; dailyImages: string[] } => {
        // Support both new images[] array and legacy image1/image2 fields
        const imgs: string[] = Array.isArray(formData.dailyInfo?.images)
          ? formData.dailyInfo.images.filter((s: unknown) => typeof s === "string" && s.startsWith("data:"))
          : [formData.dailyInfo?.image1, formData.dailyInfo?.image2]
              .filter((s): s is string => typeof s === "string" && s.startsWith("data:"))
        return {
          dailyImage1: imgs[0] ?? null,
          dailyImage2: imgs[1] ?? null,
          dailyImages: imgs,
        }
      })(),
      nextDayPlanned: (formData.dailyInfo?.nextDayPlannedWork && String(formData.dailyInfo.nextDayPlannedWork).trim()) ? String(formData.dailyInfo.nextDayPlannedWork).trim() : null,
      selectedMachine: formData.machineSelection.selectedMachine,
      additionalMachines: formData.machineSelection.additionalMachines,
      fuelMachines: formData.fuel.machines,
      productionSummary: formData.productionSummary,
      submittedByUserId: session.id,
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
          const toSave = (formData.puantaj as Array<{
            personel_id: number; carpan: number; durum_kod: string; mesai_saat: number; notlar: string
          }>).filter((e) => (Number(e.carpan) || 0) > 0)
          for (const entry of toSave) {
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
        machineHours: currentMachine?.machineHours,
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

    // E-posta: SMTP_USER + global admin listesi (Postgres) + şantiye email_list
    const reportRecipients = await getMergedNotificationEmails({ siteId: siteIdForDb })

    // Kayıt sonrası kümülatifler (bugünkü rapor dahil)
    const cumulativeAfterSave =
      siteIdForDb && reportDateStr ? await getCumulativeTotalProduction(siteIdForDb, reportDateStr) : cumulativeTotalProduction
    const pileCountsAfterSave =
      siteIdForDb && reportDateStr ? await getCumulativePileCounts(siteIdForDb, reportDateStr) : null

    // Rapor HTML içeriği (e-posta gövdesi / yazdırma için) — hesaplanan kalan/günlük kazık kullanılsın
    const mainReportContent = generatePDFMainReport(formData, {
      computedRemainingPiles: remainingPilesForDb,
      computedDailyPileCount: dailyPileForDb,
      concretePouredSum,
      projectStartDate,
      daysElapsed,
      showHakedis: session.role === "super_admin",
      contractUnitPrice: site?.contract_unit_price != null ? Number(site.contract_unit_price) : null,
      cumulativeTotalProduction: cumulativeAfterSave,
      cumulativeDrilledPiles: pileCountsAfterSave?.drilled ?? null,
      cumulativeConcretePiles: pileCountsAfterSave?.concrete ?? null,
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

    // If skipEmail flag is set, return early without sending email
    if (skipEmail) {
      return NextResponse.json({
        success: true,
        message: "Rapor kaydedildi.",
        reportId,
        recipients: reportRecipients,
        emailSent: false,
        skipped: true,
      })
    }

    let emailSent = false
    let emailError: string | undefined

    if (reportRecipients.length > 0 && isEmailSendEnabled()) {
      // Harcama toplamını hesapla
      const expenseTotal = Array.isArray(formData.expenses)
        ? formData.expenses.reduce((s: number, e: { amount?: string | number }) => s + (parseFloat(String(e.amount ?? "0")) || 0), 0)
        : null

      // Anomali tespiti
      const anomalies = detectReportAnomalies({
        machineHours: currentMachine?.machineHours,
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
        machineHours: currentMachine?.machineHours,
        selectedMachineName: formData.machineSelection?.selectedMachine?.name,
        dailyFuelUsage: formData.fuel?.dailyUsage || ((formData.fuel?.machines || []).reduce((s: number, m: { used?: string }) => s + (parseFloat(m?.used ?? "") || 0), 0) || null),
        expenseTotal: expenseTotal || null,
        notes: formData.notes,
        dailyNotes: formData.dailyInfo?.notes,
        anomalies,
        reportUrl,
        attachedFullReport: true,
      })

      const result = await sendReportEmail({
        to: reportRecipients,
        subject: emailSubject,
        html: emailHtml,
        attachments: [fullReportHtmlAttachment(reportId, formData.basicInfo.date, fullHtml)],
      })
      emailSent = result.sent
      emailError = result.error
      if (result.sent) {
        console.log(`Report ${reportId}: email sent to ${reportRecipients.join(", ")}`)
      } else if (result.error) {
        console.warn(`Report ${reportId}: email failed -`, result.error)
      }
    } else {
      if (reportRecipients.length === 0) {
        console.log(`Report ${reportId}: no recipients configured, email skipped`)
      } else {
        console.log(`Report ${reportId}: SMTP not configured (ENABLE_EMAIL_SEND / SMTP_*), email skipped. Recipients would be: ${reportRecipients.join(", ")}`)
      }
    }

    // Operatör raporu ayrı e-posta: sadece super admin alıcıları
    let operatorEmailSent = false
    let operatorEmailError: string | undefined
    if (operatorEntries.length > 0 && isEmailSendEnabled()) {
      const superAdminEmails = await getSuperAdminEmails()
      if (superAdminEmails.length > 0) {
        const opMail = buildOperatorReportEmail({
          reportId,
          date: formData.basicInfo.date,
          siteName: projectName || site?.name || "Şantiye",
          operatorEntries,
          reportUrl: (process.env.NEXTAUTH_URL || process.env.APP_URL)
            ? `${process.env.NEXTAUTH_URL || process.env.APP_URL}/api/reports/${reportId}/preview`
            : undefined,
        })
        const opResult = await sendReportEmail({
          to: superAdminEmails,
          subject: opMail.subject,
          html: opMail.html,
        })
        operatorEmailSent = opResult.sent
        operatorEmailError = opResult.error
      }
    }

    return NextResponse.json({
      success: true,
      message: "Report generated and saved successfully",
      reportId: reportId,
      recipients: reportRecipients,
      emailSent,
      emailError: emailError ?? undefined,
      operatorEmailSent,
      operatorEmailError: operatorEmailError ?? undefined,
      emailContent: fullHtml,
      expensesContent: expensesPageContent,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[send-report ${ref}] Error generating report:`, error)
    return NextResponse.json(
      { error: "Rapor kaydedilirken sunucu hatası oluştu.", detail: message, ref },
      { status: 500 }
    )
  }
}

