/** Rapor HTML içeriği üretimi — hem send-report hem preview (eski raporlar) tarafından kullanılır. */

export function generatePDFMainReport(
  formData: any,
  opts?: {
    computedRemainingPiles?: string
    computedDailyPileCount?: string
    concretePouredSum?: number
    /** Operatör girişleri (şantiye + tarih bazlı); rapora bu bölüm eklenir */
    operatorEntries?: Array<{
      machine_name?: string; machine_hours?: string; used_fuel?: string; work_done?: string; note?: string; username?: string;
      daily_pile_count?: string; total_production?: string; empty_borehole?: string; pre_borehole?: string; concrete_poured?: string;
      start_time?: string; end_time?: string; pile_depths?: Array<{ depth?: string | number; onForaj?: boolean; bosForaj?: boolean }>;
      elmas_miktar?: string; elmas_degisim_yok?: boolean; bentonit_miktar?: string;
      image1?: string | null; image2?: string | null; notes?: string;
    }>
  }
) {
  const operatorEntries = opts?.operatorEntries ?? []
  const machines = formData.basicInfo?.machines ?? []
  const additionalMachines = formData.machineSelection?.additionalMachines ?? []
  const fuelMachines = formData.fuel?.machines ?? []
  const pileDetailsList = formData.pileDetails ?? []
  const idx = typeof formData.machineSelection?.currentMachineIndex === "number" ? formData.machineSelection.currentMachineIndex : 0
  const currentMachine = machines[idx]
  const currentProductionSummary = Array.isArray(formData.productionSummary) ? formData.productionSummary[idx] : null

  const isArray = Array.isArray(formData.productionSummary)
  const totalProduction = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseFloat(m.totalProduction) || 0), 0)
    : formData.productionSummary.totalProduction
  const concreteSum = opts?.concretePouredSum ?? (isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.concretePoured) || 0), 0)
    : parseInt(formData.productionSummary?.concretePoured ?? "", 10) || 0)
  const totalPileCountFromForm = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.totalPileCount) || 0), 0)
    : parseInt(formData.productionSummary?.totalPileCount ?? "", 10) || 0
  const totalPileCount = totalPileCountFromForm > 0 ? totalPileCountFromForm : concreteSum
  const dailyPileCountFromForm = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.dailyPileCount) || 0), 0)
    : parseInt(formData.productionSummary?.dailyPileCount ?? "", 10) || 0
  const dailyPileCount = opts?.computedDailyPileCount?.trim()
    ? opts.computedDailyPileCount
    : (dailyPileCountFromForm > 0 ? String(dailyPileCountFromForm) : (concreteSum > 0 ? String(concreteSum) : ""))
  const totalCompletedPiles = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.totalCompletedPiles) || 0), 0)
    : formData.productionSummary.totalCompletedPiles
  const remainingPiles = (opts?.computedRemainingPiles != null && opts.computedRemainingPiles !== "")
    ? opts.computedRemainingPiles
    : (isArray
        ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.remainingPiles) || 0), 0)
        : formData.productionSummary.remainingPiles)
  const steelLoweredPiles = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.steelLoweredPiles) || 0), 0)
    : formData.productionSummary.steelLoweredPiles
  const concretePoured = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.concretePoured) || 0), 0)
    : formData.productionSummary.concretePoured
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Günlük Çalışma Raporu - ${formData.basicInfo.date}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 12px; line-height: 1.2; }
          .page { width: 100%; min-height: 100vh; page-break-after: always; background: white; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 2px solid #000; padding: 6px; text-align: left; vertical-align: middle; }
          th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          .header { background-color: #f0f0f0; padding: 15px; text-align: center; border: 2px solid #000; margin-bottom: 15px; }
          .section-title { font-size: 14px; font-weight: bold; padding: 8px; background-color: #f0f0f0; border: 1px solid #000; margin: 15px 0 5px 0; }
          .info-box { border: 1px solid #000; padding: 8px; text-align: center; min-height: 35px; display: flex; flex-direction: column; justify-content: center; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 15px; }
          @media print { body { -webkit-print-color-adjust: exact; } .page { page-break-after: always; } }
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
            <thead><tr><th>MAKİNE TÜRÜ</th><th>MAKİNE ADI</th></tr></thead>
            <tbody>
              <tr><td style="text-align: center; font-weight: bold;">Ana Makine</td><td style="text-align: center; font-weight: bold;">${formData.machineSelection?.selectedMachine?.name || "Seçilmedi"}</td></tr>
              ${(additionalMachines || []).map((machine: any) => `<tr><td style="text-align: center; font-weight: bold;">Ek Makine</td><td style="text-align: center; font-weight: bold;">${machine.name}</td></tr>`).join("")}
            </tbody>
          </table>
          <div class="section-title">MAKİNE İSTATİSTİKLERİ</div>
          <table>
            <thead><tr><th>MAKİNE</th><th>MAKİNE SAAT</th><th>TOPLAM İMALAT</th><th>KAZIK ADEDİ</th><th>DELİNEN</th><th>BETON</th></tr></thead>
            <tbody>
              ${(machines || []).map((machine: any) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${machine.machineName ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.machineHours ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.totalProduction ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.pileCount ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.drilledPile ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.concretePile ?? ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          ${operatorEntries.length > 0 ? `
          <div class="section-title">OPERATÖR MAKİNE GİRİŞLERİ</div>
          <table>
            <thead><tr><th>MAKİNE</th><th>BİNİŞ</th><th>İNİŞ</th><th>MAZOT (L)</th><th>KAZIK (Ad.)</th><th>İMALAT (m)</th><th>ELMAS</th><th>BENTONİT</th><th>YAPILAN İMALAT</th><th>NOT</th></tr></thead>
            <tbody>
              ${operatorEntries.map((oe: any) => {
                const pd = oe.pile_depths
                const pileDepths = Array.isArray(pd) ? pd : (typeof pd === "string" ? (() => { try { return JSON.parse(pd); } catch { return []; } })() : [])
                const elmasText = oe.elmas_degisim_yok ? "yok" : (oe.elmas_miktar ?? "")
                return `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${oe.machine_name ?? ""}</td>
                  <td style="text-align: center;">${oe.start_time ?? ""}</td>
                  <td style="text-align: center;">${oe.end_time ?? ""}</td>
                  <td style="text-align: center;">${oe.used_fuel ?? ""}</td>
                  <td style="text-align: center;">${oe.daily_pile_count ?? oe.concrete_poured ?? ""}</td>
                  <td style="text-align: center;">${oe.total_production ?? ""}</td>
                  <td style="text-align: center;">${elmasText}</td>
                  <td style="text-align: center;">${oe.bentonit_miktar ?? ""}</td>
                  <td style="text-align: left;">${oe.work_done ?? ""}</td>
                  <td style="text-align: left;">${oe.note ?? ""}</td>
                </tr>
                ${pileDepths.length > 0 ? `
                <tr><td colspan="10" style="padding: 0; border: none; vertical-align: top;">
                  <table style="margin: 0 0 4px 8px; width: auto; min-width: 280px;">
                    <thead><tr><th>No</th><th>Derinlik (m)</th><th>Ön foraj</th><th>Boş foraj</th></tr></thead>
                    <tbody>
                      ${pileDepths.map((r: any, i: number) => `<tr><td>${i + 1}</td><td>${r.depth ?? ""}</td><td>${r.onForaj ? "Evet" : "Hayır"}</td><td>${r.bosForaj ? "Evet" : "Hayır"}</td></tr>`).join("")}
                    </tbody>
                  </table>
                </td></tr>
                ` : ""}
              `}).join("")}
            </tbody>
          </table>
          ${operatorEntries.some((oe: any) => (oe.notes && String(oe.notes).trim()) || (oe.image1 || oe.image2)) ? `
          <div class="section-title">OPERATÖR FOTOĞRAF VE NOTLAR</div>
          ${operatorEntries.map((oe: any) => {
            const hasContent = (oe.notes && String(oe.notes).trim()) || oe.image1 || oe.image2
            if (!hasContent) return ""
            return `<div style="margin-bottom: 12px; border: 1px solid #ccc; padding: 8px;">
              <strong>${oe.machine_name ?? ""}</strong>
              ${oe.notes && String(oe.notes).trim() ? `<div style="white-space: pre-wrap; margin: 8px 0;">${oe.notes}</div>` : ""}
              ${(oe.image1 || oe.image2) ? `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">${oe.image1 ? `<img src="${oe.image1}" alt="Op 1" style="max-width: 200px; max-height: 150px; object-fit: contain; border: 1px solid #000;" />` : ""}${oe.image2 ? `<img src="${oe.image2}" alt="Op 2" style="max-width: 200px; max-height: 150px; object-fit: contain; border: 1px solid #000;" />` : ""}</div>` : ""}
            </div>`
          }).join("")}
          ` : ""}
          ` : ""}
          <div class="section-title">TEMEL BİLGİLER</div>
          <div class="info-grid">
            <div class="info-box"><div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">MAKİNE SAAT</div><div style="font-size: 14px; font-weight: bold;">${currentMachine?.machineHours ?? ""}</div></div>
            <div class="info-box"><div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">TOPLAM İMALAT (M)</div><div style="font-size: 14px; font-weight: bold;">${totalProduction}</div></div>
            <div class="info-box"><div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">YAPILAN KAZIK ADEDİ</div><div style="font-size: 14px; font-weight: bold;">${totalPileCount}</div></div>
            <div class="info-box"><div style="font-size: 10px; font-weight: bold; margin-bottom: 2px;">KAZIK DELİNEN</div><div style="font-size: 14px; font-weight: bold;">${currentMachine?.drilledPile ?? currentProductionSummary?.totalPileCount ?? ""}</div></div>
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
            <thead><tr><th>MÜH</th><th>FORMEN</th><th>OPERATOR</th><th>YAĞCI</th><th>KAYNAKÇI</th><th>DİĞER</th><th>TOPLAM</th></tr></thead>
            <tbody>
              <tr>
                <td style="text-align: center; font-weight: bold;">${formData.personnel?.engineer ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel?.foreman ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel?.operator ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel?.oiler ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel?.welder ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.personnel?.other ?? ""}</td>
                <td style="text-align: center; font-weight: bold; background-color: #f0f0f0;">${formData.personnel?.total ?? ""}</td>
              </tr>
            </tbody>
          </table>
          <div class="section-title">ARAÇ - GEREÇ</div>
          <table>
            <thead><tr><th>VİNÇ</th><th>LOADER</th><th>KAMYON</th><th>PICK UP</th><th>BİNEK</th><th>SERVİS</th><th>TOPLAM</th></tr></thead>
            <tbody>
              <tr>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles?.crane ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles?.loader ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles?.truck ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles?.pickup ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles?.car ?? ""}</td>
                <td style="text-align: center; font-weight: bold;">${formData.vehicles?.service ?? ""}</td>
                <td style="text-align: center; font-weight: bold; background-color: #f0f0f0;">${formData.vehicles?.total ?? ""}</td>
              </tr>
            </tbody>
          </table>
          <div class="section-title">MAKİNE VE ARAÇLAR İÇİN KULLANILAN MAZOT</div>
          <table>
            <thead><tr><th>MAKİNE</th><th>DEVİR</th><th>GELEN</th><th>KALAN</th><th>KULLANILAN</th></tr></thead>
            <tbody>
              ${(fuelMachines || []).map((machine: any) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${machine.name ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.shift ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.incoming ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.remaining ?? ""}</td>
                  <td style="text-align: center; font-weight: bold;">${machine.used ?? ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="section-title">KAZIK DETAYLARI</div>
          <table>
            <thead><tr><th>KAZIK</th><th>DELİNEN</th><th>NOTLAR</th><th>BETON</th></tr></thead>
            <tbody>
              ${(pileDetailsList || []).filter((pile: any) => pile.drilled || pile.notes).map((pile: any) => `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${pile.pileNumber}</td>
                  <td style="text-align: center;">${pile.drilled}</td>
                  <td>${pile.notes}</td>
                  <td style="text-align: center;">${pile.concretePoured ? "Evet" : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          ${(formData.dailyInfo?.notes || formData.dailyInfo?.image1 || formData.dailyInfo?.image2 || (formData.dailyInfo?.nextDayPlannedWork && String(formData.dailyInfo.nextDayPlannedWork).trim())) ? `
          <div class="section-title">GÜNLÜK BİLGİLER</div>
          ${formData.dailyInfo?.notes ? `<div style="border: 1px solid #000; min-height: 40px; padding: 8px; background: white; white-space: pre-wrap; margin-bottom: 10px;">${formData.dailyInfo.notes}</div>` : ""}
          ${(formData.dailyInfo?.nextDayPlannedWork && String(formData.dailyInfo.nextDayPlannedWork).trim()) ? `<div style="margin-top: 10px;"><strong>Bir sonraki gün için planlanan imalat ve yapılacak işler:</strong><ul style="margin: 8px 0 0 20px; padding: 0;">${String(formData.dailyInfo.nextDayPlannedWork).split(/\r?\n/).filter((line) => line.trim()).map((line) => `<li style="margin-bottom: 4px;">${line.trim()}</li>`).join("")}</ul></div>` : ""}
          ${(formData.dailyInfo?.image1 || formData.dailyInfo?.image2) ? `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
            ${formData.dailyInfo?.image1 ? `<img src="${formData.dailyInfo.image1}" alt="Günlük 1" style="max-width: 280px; max-height: 180px; object-fit: contain; border: 1px solid #000;" />` : ""}
            ${formData.dailyInfo?.image2 ? `<img src="${formData.dailyInfo.image2}" alt="Günlük 2" style="max-width: 280px; max-height: 180px; object-fit: contain; border: 1px solid #000;" />` : ""}
          </div>` : ""}
          ` : ""}
          ${formData.notes ? `<div class="section-title">BAKIM / MALZEME / NOTLAR</div><div style="border: 1px solid #000; min-height: 60px; padding: 8px; background: white; white-space: pre-wrap;">${formData.notes}</div>` : ""}
        </div>
      </body>
    </html>
  `
}

const expenseCategoryLabel: Record<string, string> = {
  santiye: "Şantiye",
  makine: "Makine (Kullanılan kazık makinesi)",
  personel: "Personel",
  yakit: "Yakıt",
  diger: "Diğer",
}

export function generatePDFExpensesPage(formData: any) {
  const expenses = formData.expenses ?? []
  const basicInfo = formData.basicInfo ?? {}
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Harcamalar - ${basicInfo.date ?? ""}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; font-size: 12px; line-height: 1.2; }
          table { border-collapse: collapse; width: 100%; margin: 10px 0; }
          th, td { border: 2px solid #000; padding: 6px; text-align: left; vertical-align: middle; }
          th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          .header { background-color: #f0f0f0; padding: 15px; text-align: center; border: 2px solid #000; margin-bottom: 15px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
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
            <tr><th style="width: 8%;">#</th><th style="width: 22%;">HARCAMA TÜRÜ</th><th style="width: 45%;">AÇIKLAMA</th><th style="width: 25%;">TUTAR (IQD)</th></tr>
          </thead>
          <tbody>
            ${Array.from({ length: Math.max(15, expenses.length) }, (_, index) => {
              const expense = expenses[index]
              const cat = expense?.category && expenseCategoryLabel[expense.category] ? expenseCategoryLabel[expense.category] : expenseCategoryLabel.diger
              return `<tr><td style="text-align: center; font-weight: bold;">${index + 1}.</td><td>${cat}</td><td>${expense?.description ?? ""}</td><td style="text-align: right; font-weight: bold;">${expense?.amount ? expense.amount.toLocaleString() : ""}</td></tr>`
            }).join("")}
            <tr style="background-color: #f0f0f0;">
              <td colspan="3" style="text-align: center; font-weight: bold;">TOPLAM:</td>
              <td style="text-align: right; font-weight: bold;">${expenses.reduce((sum: number, exp: any) => sum + (exp?.amount ?? 0), 0).toLocaleString()} IQD</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `
}
