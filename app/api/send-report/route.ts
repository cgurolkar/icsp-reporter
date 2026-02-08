import { type NextRequest, NextResponse } from "next/server"
import { saveWorkReport, initializeDatabase, getSiteReportEmails, getSiteById } from "@/lib/database"
import { isEmailSendEnabled, sendReportEmail } from "@/lib/email"

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
    
    const rawSiteId = formData.basicInfo?.siteId
    const siteId = rawSiteId == null || rawSiteId === "" ? null : Number(rawSiteId)
    const siteIdForDb = siteId != null && !Number.isNaN(siteId) ? siteId : null
    // Proje adı: şantiye seçiliyse veritabanındaki şantiye adını kullan (tutarlı görünsün)
    let projectName = (formData.basicInfo?.project ?? "").trim()
    if (siteIdForDb) {
      const site = await getSiteById(siteIdForDb)
      if (site?.name) projectName = site.name
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
      totalPileCount: currentProductionSummary?.totalPileCount || "",
      dailyPileCount: currentProductionSummary?.dailyPileCount || "",
      totalCompletedPiles: currentProductionSummary?.totalCompletedPiles || "",
      remainingPiles: currentProductionSummary?.remainingPiles || "",
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
      dailyFuelUsage: formData.fuel.dailyUsage,
      expenses: formData.expenses,
      pileDetails: formData.pileDetails,
      notes: formData.notes,
      selectedMachine: formData.machineSelection.selectedMachine,
      additionalMachines: formData.machineSelection.additionalMachines,
      fuelMachines: formData.fuel.machines,
    })

    // E-posta listesi: önce şantiye bazlı, yoksa varsayılan
    const siteEmails = await getSiteReportEmails(siteIdForDb)
    const settings = siteEmails.length > 0
      ? { emails: siteEmails, users: [], customFields: [] }
      : await getDefaultEmailSettings()

    // Rapor HTML içeriği (e-posta gövdesi / yazdırma için)
    const mainReportContent = generatePDFMainReport(formData)
    const expensesPageContent = generatePDFExpensesPage(formData)
    const fullHtml = mainReportContent + expensesPageContent
    const subject = `Günlük Çalışma Raporu - ${formData.basicInfo.date} - ${formData.basicInfo.project}`

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

function generatePDFMainReport(formData: any) {
  const machines = formData.basicInfo?.machines ?? []
  const additionalMachines = formData.machineSelection?.additionalMachines ?? []
  const fuelMachines = formData.fuel?.machines ?? []
  const pileDetailsList = formData.pileDetails ?? []
  const idx = typeof formData.machineSelection?.currentMachineIndex === "number" ? formData.machineSelection.currentMachineIndex : 0
  const currentMachine = machines[idx]
  const currentProductionSummary = Array.isArray(formData.productionSummary) ? formData.productionSummary[idx] : null

  // Toplamlar için dizi kontrolü ve toplama
  const isArray = Array.isArray(formData.productionSummary);
  const totalProduction = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseFloat(m.totalProduction) || 0), 0)
    : formData.productionSummary.totalProduction;
  const totalPileCount = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.concretePoured) || 0), 0)
    : formData.productionSummary.totalPileCount;
  const dailyPileCount = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.dailyPileCount) || 0), 0)
    : formData.productionSummary.dailyPileCount;
  const totalCompletedPiles = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.totalCompletedPiles) || 0), 0)
    : formData.productionSummary.totalCompletedPiles;
  const remainingPiles = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.remainingPiles) || 0), 0)
    : formData.productionSummary.remainingPiles;
  const steelLoweredPiles = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.steelLoweredPiles) || 0), 0)
    : formData.productionSummary.steelLoweredPiles;
  const concretePoured = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.concretePoured) || 0), 0)
    : formData.productionSummary.concretePoured;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Günlük Çalışma Raporu - ${formData.basicInfo.date}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.2;
          }
          
          .page {
            width: 100%;
            min-height: 100vh;
            page-break-after: always;
            background: white;
          }
          
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 10px 0;
          }
          
          th, td {
            border: 2px solid #000;
            padding: 6px;
            text-align: left;
            vertical-align: middle;
          }
          
          th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: center;
          }
          
          .header {
            background-color: #f0f0f0;
            padding: 15px;
            text-align: center;
            border: 2px solid #000;
            margin-bottom: 15px;
          }
          
          .section-title {
            font-size: 14px;
            font-weight: bold;
            padding: 8px;
            background-color: #f0f0f0;
            border: 1px solid #000;
            margin: 15px 0 5px 0;
          }
          
          .info-box {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            min-height: 35px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            margin-bottom: 15px;
          }
          
          @media print {
            body { -webkit-print-color-adjust: exact; }
            .page { page-break-after: always; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <h1 style="margin: 0; font-size: 18px;">GÜNLÜK ÇALIŞMA RAPORU</h1>
            <div style="display: flex; justify-content: space-between; margin-top: 10px;">
              <span style="font-weight: bold;">TARİH: ${formData.basicInfo.date}</span>
              <span style="font-weight: bold;">${formData.basicInfo.project}</span>
            </div>
          </div>

          <div class="section-title">MAKİNE BİLGİLERİ</div>
          <table>
            <thead>
              <tr><th>MAKİNE TÜRÜ</th><th>MAKİNE ADI</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center; font-weight: bold;">Ana Makine</td>
                <td style="text-align: center; font-weight: bold;">${formData.machineSelection.selectedMachine?.name || "Seçilmedi"}</td>
              </tr>
              ${additionalMachines.map((machine: any) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">Ek Makine</td>
                  <td style="text-align: center; font-weight: bold;">${machine.name}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="section-title">MAKİNE İSTATİSTİKLERİ</div>
          <table>
            <thead>
              <tr><th>MAKİNE</th><th>MAKİNE SAAT</th><th>TOPLAM İMALAT</th><th>KAZIK ADEDİ</th><th>DELİNEN</th><th>BETON</th></tr>
            </thead>
            <tbody>
              ${machines.map((machine: any) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${machine.machineName}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.machineHours}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.totalProduction}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.pileCount}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.drilledPile}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.concretePile}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="section-title">TEMEL BİLGİLER</div>
          <div class="info-grid">
            <div class="info-box">
              <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">MAKİNE SAAT</div>
              <div style="font-size: 14px; font-weight: bold;">${currentMachine?.machineHours ?? ""}</div>
            </div>
            <div class="info-box">
              <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">TOPLAM İMALAT (M)</div>
              <div style="font-size: 14px; font-weight: bold;">${totalProduction}</div>
            </div>
            <div class="info-box">
              <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">YAPILAN KAZIK ADEDİ</div>
              <div style="font-size: 14px; font-weight: bold;">${totalPileCount}</div>
            </div>
            <div class="info-box">
              <div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">KAZIK DELİNEN</div>
              <div style="font-size: 14px; font-weight: bold;">${currentMachine?.drilledPile ?? currentProductionSummary?.totalPileCount ?? ""}</div>
            </div>
          </div>

          <div class="section-title">ÜRETİM ÖZETİ</div>
          <table>
            <tbody>
              <tr><td style="font-weight: bold; background-color: #f0f0f0;">TOPLAM İMALAT (M)</td><td style="text-align: center; font-weight: bold;">${totalProduction}</td></tr>
              <tr><td style="font-weight: bold; background-color: #f0f0f0;">TOPLAM KAZIK SAYISI</td><td style="text-align: center; font-weight: bold;">${totalPileCount}</td></tr>
              <tr><td style="font-weight: bold; background-color: #f0f0f0;">GÜNLÜK YAPILAN KAZIK</td><td style="text-align: center; font-weight: bold;">${dailyPileCount}</td></tr>
              <tr><td style="font-weight: bold; background-color: #f0f0f0;">TOPLAM YAPILAN KAZIK SAYISI</td><td style="text-align: center; font-weight: bold;">${totalCompletedPiles}</td></tr>
              <tr><td style="font-weight: bold; background-color: #f0f0f0;">KALAN KAZIK SAYISI</td><td style="text-align: center; font-weight: bold;">${remainingPiles}</td></tr>
              <tr><td style="font-weight: bold; background-color: #f0f0f0;">DEMİR İNDİRİLEN KAZIK</td><td style="text-align: center; font-weight: bold;">${steelLoweredPiles}</td></tr>
              <tr><td style="font-weight: bold; background-color: #f0f0f0;">BETON DÖKÜLEN KAZIK</td><td style="text-align: center; font-weight: bold;">${concretePoured}</td></tr>
            </tbody>
          </table>

          <div class="section-title">PERSONEL</div>
          <table>
            <thead>
              <tr><th>MÜH</th><th>FORMEN</th><th>OPERATOR</th><th>YAĞCI</th><th>KAYNAKÇI</th><th>DİĞER</th><th>TOPLAM</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center; font-weight: bold;">${formData.personnel.engineer}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel.foreman}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel.operator}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel.oiler}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel.welder}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel.other}</td>
                <td style="text-align: center; font-weight: bold; background-color: #f0f0f0;">${formData.personnel.total}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">ARAÇ - GEREÇ</div>
          <table>
            <thead>
              <tr><th>VİNÇ</th><th>LOADER</th><th>KAMYON</th><th>PICK UP</th><th>BİNEK</th><th>SERVİS</th><th>TOPLAM</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles.crane}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles.loader}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles.truck}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles.pickup}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles.car}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles.service}</td>
                <td style="text-align: center; font-weight: bold; background-color: #f0f0f0;">${formData.vehicles.total}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">MAKİNE VE ARAÇLAR İÇİN KULLANILAN MAZOT</div>
          <table>
            <thead>
              <tr><th>MAKİNE</th><th>DEVİR</th><th>GELEN</th><th>KALAN</th><th>KULLANILAN</th></tr>
            </thead>
            <tbody>
              ${fuelMachines
                .map(
                  (machine: any) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${machine.name || ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.shift || ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.incoming || ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.remaining || ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.used || ""}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          <div class="section-title">KAZIK DETAYLARI</div>
          <table>
            <thead>
              <tr><th>KAZIK</th><th>DELİNEN</th><th>NOTLAR</th></tr>
            </thead>
            <tbody>
              ${pileDetailsList
                .filter((pile: any) => pile.drilled || pile.notes)
                .map(
                  (pile: any) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${pile.pileNumber}</td>
                  <td style="text-align: center;">${pile.drilled}</td>
                  <td>${pile.notes}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          ${
            formData.notes
              ? `
            <div class="section-title">BAKIM / MALZEME / NOTLAR</div>
            <div style="border: 1px solid #000; min-height: 60px; padding: 8px; background: white; white-space: pre-wrap;">${formData.notes}</div>
          `
              : ""
          }
        </div>
      </body>
    </html>
  `
}

function generatePDFExpensesPage(formData: any) {
  const expenses = formData.expenses ?? []
  const basicInfo = formData.basicInfo ?? {}
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Harcamalar - ${basicInfo.date ?? ""}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.2;
          }
          
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 10px 0;
          }
          
          th, td {
            border: 2px solid #000;
            padding: 6px;
            text-align: left;
            vertical-align: middle;
          }
          
          th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-align: center;
          }
          
          .header {
            background-color: #f0f0f0;
            padding: 15px;
            text-align: center;
            border: 2px solid #000;
            margin-bottom: 15px;
          }
          
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 18px;">HARCAMALAR</h1>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <span style="font-weight: bold;">TARİH: ${basicInfo.date ?? ""}</span>
            <span style="font-weight: bold;">${basicInfo.project ?? ""}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 10%;">#</th>
              <th style="width: 60%;">AÇIKLAMA</th>
              <th style="width: 30%;">TUTAR (IQD)</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: Math.max(15, expenses.length) }, (_, index) => {
              const expense = expenses[index]
              return `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${index + 1}.</td>
                  <td>${expense?.description || ""}</td>
                  <td style="text-align: right; font-weight: bold;">${expense?.amount ? expense.amount.toLocaleString() : ""}</td>
                </tr>
              `
            }).join("")}
            <tr style="background-color: #f0f0f0;">
              <td colspan="2" style="text-align: center; font-weight: bold;">TOPLAM:</td>
              <td style="text-align: right; font-weight: bold;">${expenses.reduce((sum: number, exp: any) => sum + (exp?.amount ?? 0), 0).toLocaleString()} IQD</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `
}
