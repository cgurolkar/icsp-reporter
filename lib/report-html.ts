/** Rapor HTML içeriği üretimi — hem send-report hem preview (eski raporlar) tarafından kullanılır. */

export function generatePDFMainReport(
  formData: any,
  opts?: {
    computedRemainingPiles?: string
    computedDailyPileCount?: string
    concretePouredSum?: number
    projectStartDate?: string | null
    daysElapsed?: number | null
    showHakedis?: boolean
    contractUnitPrice?: number | null
    cumulativeTotalProduction?: number | null
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
    : formData.productionSummary?.totalProduction
  const siteConcreteTrim = String(formData.siteConcretePouredPiles ?? "").trim()
  const siteBetonExplicit = siteConcreteTrim !== "" ? parseInt(siteConcreteTrim, 10) || 0 : null
  const concreteSum =
    opts?.concretePouredSum ??
    (siteBetonExplicit !== null
      ? siteBetonExplicit
      : isArray
        ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.concretePoured) || 0), 0)
        : parseInt(formData.productionSummary?.concretePoured ?? "", 10) || 0)
  const totalPileCountFromForm = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.totalPileCount) || 0), 0)
    : parseInt(formData.productionSummary?.totalPileCount ?? "", 10) || 0
  const totalPileCount = totalPileCountFromForm > 0 ? totalPileCountFromForm : concreteSum
  const dailyDrilledSum = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(String(m.dailyDrilledPiles ?? "").trim(), 10) || 0), 0)
    : 0
  const dailyPileCountFromForm =
    dailyDrilledSum > 0
      ? dailyDrilledSum
      : (isArray
          ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.dailyPileCount) || 0), 0)
          : parseInt(formData.productionSummary?.dailyPileCount ?? "", 10) || 0)
  const dailyPileCount = opts?.computedDailyPileCount?.trim()
    ? opts.computedDailyPileCount
    : (dailyPileCountFromForm > 0 ? String(dailyPileCountFromForm) : (concreteSum > 0 ? String(concreteSum) : "—"))
  const totalCompletedPiles = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.totalCompletedPiles) || 0), 0)
    : (formData.productionSummary?.totalCompletedPiles || 0)
  const remainingPiles = (opts?.computedRemainingPiles != null && opts.computedRemainingPiles !== "")
    ? opts.computedRemainingPiles
    : (isArray
        ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.remainingPiles) || 0), 0)
        : formData.productionSummary?.remainingPiles)
  const steelLoweredPiles = isArray
    ? formData.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.steelLoweredPiles) || 0), 0)
    : (formData.productionSummary?.steelLoweredPiles || 0)
  const concretePoured = concreteSum

  // Kazık ilerleme yüzdesi
  const remainingNum = parseInt(String(remainingPiles), 10) || 0
  const completedNum = parseInt(String(totalCompletedPiles), 10) || 0
  const totalProjectPiles = completedNum + remainingNum
  const progressPct = totalProjectPiles > 0 ? Math.min(100, Math.round((completedNum / totalProjectPiles) * 100)) : 0

  // Tarih formatlama
  const dateStr = formData.basicInfo?.date ?? ""
  let formattedDate = dateStr
  try {
    const d = new Date(dateStr + "T12:00:00Z")
    formattedDate = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" })
  } catch {}

  const v = (val: any, fallback = "—") => (val != null && val !== "" && val !== 0 && val !== "0" ? String(val) : fallback)
  const projectStartDate = opts?.projectStartDate ? String(opts.projectStartDate).slice(0, 10) : ""
  const elapsedDays = opts?.daysElapsed != null ? Number(opts.daysElapsed) : null
  const showHakedis = opts?.showHakedis === true
  const contractUnitPrice = opts?.contractUnitPrice != null ? Number(opts.contractUnitPrice) : null
  const cumulativeTotalProduction = opts?.cumulativeTotalProduction != null ? Number(opts.cumulativeTotalProduction) : null
  const hakedisAmount = showHakedis && contractUnitPrice != null && cumulativeTotalProduction != null
    ? contractUnitPrice * cumulativeTotalProduction
    : null

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Günlük Çalışma Raporu — ${dateStr}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; line-height: 1.4; }

    /* HEADER */
    .header { background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: #fff; padding: 14px 18px; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .header-left .title { font-size: 17px; font-weight: 700; letter-spacing: 0.5px; }
    .header-left .subtitle { font-size: 11px; opacity: 0.8; margin-top: 2px; }
    .header-right { text-align: right; }
    .header-right .date { font-size: 13px; font-weight: 600; }
    .header-right .project { font-size: 11px; opacity: 0.85; margin-top: 3px; }

    /* SECTION */
    .section { margin-bottom: 10px; }
    .section-header { display: flex; align-items: center; gap: 6px; background: #1a237e; color: #fff; padding: 5px 10px; border-radius: 4px 4px 0 0; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }
    .section-body { border: 1px solid #c7d2e8; border-top: none; border-radius: 0 0 4px 4px; background: #fff; padding: 8px; }

    /* STAT CARDS */
    .stat-grid { display: grid; gap: 6px; }
    .stat-grid-4 { grid-template-columns: repeat(4, 1fr); }
    .stat-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .stat-grid-2 { grid-template-columns: repeat(2, 1fr); }
    .stat-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center; background: #f8fafc; }
    .stat-card.highlight { border-color: #1a237e; background: #eef2ff; }
    .stat-card.green { border-color: #16a34a; background: #f0fdf4; }
    .stat-card.orange { border-color: #d97706; background: #fffbeb; }
    .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 3px; }
    .stat-value { font-size: 18px; font-weight: 800; color: #1a237e; line-height: 1; }
    .stat-card.green .stat-value { color: #16a34a; }
    .stat-card.orange .stat-value { color: #d97706; }
    .stat-unit { font-size: 9px; color: #94a3b8; margin-top: 2px; }

    /* TABLES */
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { background: #e8eaf6; color: #1a237e; font-weight: 700; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; padding: 5px 7px; text-align: center; border: 1px solid #c7d2e8; }
    td { padding: 5px 7px; border: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    .td-center { text-align: center; font-weight: 600; }
    .td-total { background: #e8eaf6 !important; font-weight: 700; text-align: center; color: #1a237e; }

    /* PROGRESS BAR */
    .progress-wrap { margin: 6px 0 0; }
    .progress-label { display: flex; justify-content: space-between; font-size: 9px; color: #64748b; margin-bottom: 3px; }
    .progress-bar { height: 8px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #16a34a, #22c55e); border-radius: 99px; transition: width 0.3s; }

    /* TWO COLUMN */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    /* NOTES */
    .notes-box { border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; min-height: 36px; background: #fafbff; white-space: pre-wrap; color: #334155; font-size: 10.5px; line-height: 1.5; }
    .notes-box.orange { border-color: #fde68a; background: #fffbeb; }

    /* IMAGES */
    .img-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .img-row img { max-width: 240px; max-height: 160px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 4px; }

    /* MACHINE TAG */
    .machine-tag { display: inline-block; background: #1a237e; color: #fff; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; letter-spacing: 0.3px; }
    .machine-tag.secondary { background: #475569; }

    /* FOOTER */
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #94a3b8; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    <div class="header-left">
      <div class="title">GÜNLÜK ÇALIŞMA RAPORU</div>
      <div class="subtitle">Daily Work Report</div>
    </div>
    <div class="header-right">
      <div class="date">${formattedDate}</div>
      <div class="project">${formData.basicInfo?.project ?? ""}</div>
    </div>
  </div>

  <!-- MAKİNE + ÜRETİM ÖZET STATS -->
  <div style="margin-bottom:8px;padding:6px 10px;border:1px solid #c7d2e8;border-radius:6px;background:#f8fafc;display:flex;gap:12px;flex-wrap:wrap;">
    <div style="font-size:10px;color:#475569;"><strong>İşe başlama tarihi:</strong> ${projectStartDate || "—"}</div>
    <div style="font-size:10px;color:#475569;"><strong>Geçen gün:</strong> ${elapsedDays != null && elapsedDays >= 0 ? elapsedDays : "—"}</div>
    ${showHakedis ? `<div style="font-size:10px;color:#1a237e;"><strong>Birim fiyat:</strong> ${contractUnitPrice != null ? `${contractUnitPrice.toLocaleString("tr-TR")} /m` : "—"}</div>` : ""}
    ${showHakedis ? `<div style="font-size:10px;color:#1a237e;"><strong>Kümülatif metraj:</strong> ${cumulativeTotalProduction != null ? cumulativeTotalProduction.toLocaleString("tr-TR") : "—"} m</div>` : ""}
    ${showHakedis ? `<div style="font-size:10px;color:#166534;"><strong>Hak edilen:</strong> ${hakedisAmount != null ? `${hakedisAmount.toLocaleString("tr-TR")} IQD` : "—"}</div>` : ""}
  </div>
  <div class="stat-grid stat-grid-4" style="margin-bottom:10px;">
    <div class="stat-card highlight">
      <div class="stat-label">Günlük Kazık</div>
      <div class="stat-value">${v(dailyPileCount)}</div>
      <div class="stat-unit">adet</div>
    </div>
    <div class="stat-card highlight">
      <div class="stat-label">Toplam İmalat</div>
      <div class="stat-value">${v(totalProduction)}</div>
      <div class="stat-unit">metre</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Tamamlanan</div>
      <div class="stat-value">${v(totalCompletedPiles)}</div>
      <div class="stat-unit">kazık</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-label">Kalan Kazık</div>
      <div class="stat-value">${v(remainingPiles)}</div>
      <div class="stat-unit">adet</div>
    </div>
  </div>

  ${totalProjectPiles > 0 ? `
  <!-- PROJE İLERLEME ÇUBUĞU -->
  <div class="section" style="margin-bottom:10px;">
    <div class="progress-wrap" style="padding:8px 10px;border:1px solid #c7d2e8;border-radius:4px;background:#f8fafc;">
      <div class="progress-label">
        <span style="font-weight:600;color:#1a237e;">Proje İlerlemesi</span>
        <span style="font-weight:700;color:#16a34a;">${progressPct}% tamamlandı</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${progressPct}%;"></div>
      </div>
      <div class="progress-label" style="margin-top:3px;">
        <span>${completedNum} kazık tamamlandı</span>
        <span>${remainingNum} kazık kaldı / ${totalProjectPiles} toplam</span>
      </div>
    </div>
  </div>
  ` : ""}

  <div class="two-col">
    <!-- SOL KOLON -->
    <div>
      <!-- MAKİNE BİLGİLERİ -->
      <div class="section">
        <div class="section-header">🔧 Makine Bilgileri</div>
        <div class="section-body">
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;">
            <span class="machine-tag">${formData.machineSelection?.selectedMachine?.name ?? "Seçilmedi"}</span>
            ${(additionalMachines || []).map((m: any) => `<span class="machine-tag secondary">${m.name}</span>`).join("")}
          </div>
          ${(() => {
            // Prefer operator entries for machine data (always accurate, works for old + new reports)
            if (operatorEntries.length > 0) {
              return `<table>
                <thead><tr><th>Makine</th><th>Motor (Biniş→İniş)</th><th>İmalat (m)</th><th>Kazık (Ad.)</th><th>Beton</th></tr></thead>
                <tbody>
                  ${operatorEntries.map((oe: any) => `
                  <tr>
                    <td style="font-weight:600;">${oe.machine_name ?? ""}</td>
                    <td class="td-center">${oe.motor_saat_binis ? `${oe.motor_saat_binis}→${oe.motor_saat_inis ?? "—"}` : (oe.machine_hours ? oe.machine_hours : "—")}</td>
                    <td class="td-center" style="font-weight:700;color:#1a237e;">${v(oe.total_production)}</td>
                    <td class="td-center" style="color:#16a34a;font-weight:700;">${v(oe.daily_pile_count ?? oe.concrete_poured)}</td>
                    <td class="td-center">${v(oe.concrete_poured)}</td>
                  </tr>`).join("")}
                  ${operatorEntries.length > 1 ? `<tr style="background:#e8eaf6;">
                    <td style="font-weight:700;">TOPLAM</td>
                    <td>—</td>
                    <td class="td-total">${operatorEntries.reduce((s: number, oe: any) => s + (parseFloat(oe.total_production ?? "") || 0), 0).toFixed(2)} m</td>
                    <td class="td-total">${operatorEntries.reduce((s: number, oe: any) => s + (parseInt(oe.daily_pile_count ?? oe.concrete_poured ?? "0") || 0), 0)} Ad.</td>
                    <td class="td-total">${operatorEntries.reduce((s: number, oe: any) => s + (parseInt(oe.concrete_poured ?? "0") || 0), 0)} Ad.</td>
                  </tr>` : ""}
                </tbody>
              </table>`
            }
            // Fallback: use productionSummary data
            const ps = Array.isArray(formData.productionSummary) ? formData.productionSummary : []
            if (ps.length > 0) {
              return `<table>
                <thead><tr><th>Makine</th><th>İmalat (m)</th><th>Boş Foraj</th><th>Ön Foraj</th><th>Beton</th></tr></thead>
                <tbody>
                  ${ps.map((m: any) => `<tr>
                    <td style="font-weight:600;">${m.machineName ?? ""}</td>
                    <td class="td-center" style="font-weight:700;color:#1a237e;">${v(m.totalProduction)}</td>
                    <td class="td-center">${v(m.emptyBorehole, "0")}</td>
                    <td class="td-center">${v(m.preBorehole, "0")}</td>
                    <td class="td-center">${v(m.concretePoured)}</td>
                  </tr>`).join("")}
                  ${ps.length > 1 ? `<tr style="background:#e8eaf6;">
                    <td style="font-weight:700;">TOPLAM</td>
                    <td class="td-total">${ps.reduce((s: number, m: any) => s + (parseFloat(m.totalProduction) || 0), 0).toFixed(2)} m</td>
                    <td class="td-total">${ps.reduce((s: number, m: any) => s + (parseInt(m.emptyBorehole) || 0), 0)} Ad.</td>
                    <td class="td-total">${ps.reduce((s: number, m: any) => s + (parseInt(m.preBorehole) || 0), 0)} Ad.</td>
                    <td class="td-total">${ps.reduce((s: number, m: any) => s + (parseInt(m.concretePoured) || 0), 0)} Ad.</td>
                  </tr>` : ""}
                </tbody>
              </table>`
            }
            return "<p style='color:#94a3b8;font-size:10px;'>Makine bilgisi operatör tarafından girilmedi.</p>"
          })()}
        </div>
      </div>

      <!-- ÜRETİM ÖZETİ -->
      <div class="section">
        <div class="section-header">📊 Üretim Özeti</div>
        <div class="section-body">
          <table>
            <tbody>
              <tr><td style="color:#475569;font-weight:600;">Toplam İmalat</td><td class="td-center" style="color:#1a237e;font-weight:700;">${v(totalProduction)} m</td></tr>
              <tr><td style="color:#475569;font-weight:600;">Toplam Kazık</td><td class="td-center" style="font-weight:700;">${v(totalPileCount)} adet</td></tr>
              <tr><td style="color:#475569;font-weight:600;">Günlük Yapılan</td><td class="td-center" style="color:#16a34a;font-weight:700;">${v(dailyPileCount)} adet</td></tr>
              <tr><td style="color:#475569;font-weight:600;">Tamamlanan (Kümülatif)</td><td class="td-center" style="font-weight:700;">${v(totalCompletedPiles)} adet</td></tr>
              <tr><td style="color:#475569;font-weight:600;">Kalan Kazık</td><td class="td-center" style="color:#d97706;font-weight:700;">${v(remainingPiles)} adet</td></tr>
              <tr><td style="color:#475569;font-weight:600;">Demir İndirilen</td><td class="td-center" style="font-weight:700;">${v(steelLoweredPiles)} adet</td></tr>
              <tr><td style="color:#475569;font-weight:600;">Beton Dökülen</td><td class="td-center" style="font-weight:700;">${v(concretePoured)} adet</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- SAĞ KOLON -->
    <div>
      <!-- PERSONEL -->
      <div class="section">
        <div class="section-header">👷 Personel</div>
        <div class="section-body">
          <div class="stat-grid stat-grid-4" style="margin-bottom:6px;">
            <div class="stat-card"><div class="stat-label">Müh.</div><div class="stat-value" style="font-size:16px;">${v(formData.personnel?.engineer, "0")}</div></div>
            <div class="stat-card"><div class="stat-label">Formen</div><div class="stat-value" style="font-size:16px;">${v(formData.personnel?.foreman, "0")}</div></div>
            <div class="stat-card"><div class="stat-label">Operatör</div><div class="stat-value" style="font-size:16px;">${v(formData.personnel?.operator, "0")}</div></div>
            <div class="stat-card highlight"><div class="stat-label">Toplam</div><div class="stat-value" style="font-size:16px;">${v(formData.personnel?.total, "0")}</div></div>
          </div>
          <div class="stat-grid stat-grid-3">
            <div class="stat-card"><div class="stat-label">Yağcı</div><div class="stat-value" style="font-size:14px;">${v(formData.personnel?.oiler, "0")}</div></div>
            <div class="stat-card"><div class="stat-label">Kaynakçı</div><div class="stat-value" style="font-size:14px;">${v(formData.personnel?.welder, "0")}</div></div>
            <div class="stat-card"><div class="stat-label">Diğer</div><div class="stat-value" style="font-size:14px;">${v(formData.personnel?.other, "0")}</div></div>
          </div>
        </div>
      </div>

      <!-- ARAÇ GEREÇ -->
      <div class="section">
        <div class="section-header">🚛 Araç — Gereç</div>
        <div class="section-body">
          <table>
            <thead><tr><th>Vinç</th><th>Loader</th><th>Kamyon</th><th>Pick-up</th><th>Binek</th><th>Servis</th><th>Toplam</th></tr></thead>
            <tbody>
              <tr>
                <td class="td-center">${v(formData.vehicles?.crane, "0")}</td>
                <td class="td-center">${v(formData.vehicles?.loader, "0")}</td>
                <td class="td-center">${v(formData.vehicles?.truck, "0")}</td>
                <td class="td-center">${v(formData.vehicles?.pickup, "0")}</td>
                <td class="td-center">${v(formData.vehicles?.car, "0")}</td>
                <td class="td-center">${v(formData.vehicles?.service, "0")}</td>
                <td class="td-total">${v(formData.vehicles?.total, "0")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- YAKIT -->
      ${fuelMachines.length > 0 ? `
      <div class="section">
        <div class="section-header">⛽ Yakıt</div>
        <div class="section-body">
          <table>
            <thead><tr><th>Makine</th><th>Devir</th><th>Gelen</th><th>Kalan</th><th>Kullanılan</th></tr></thead>
            <tbody>
              ${fuelMachines.map((m: any) => `
              <tr>
                <td style="font-weight:600;">${m.name ?? ""}</td>
                <td class="td-center">${v(m.shift)}</td>
                <td class="td-center">${v(m.incoming)}</td>
                <td class="td-center">${v(m.remaining)}</td>
                <td class="td-center" style="font-weight:700;color:#1a237e;">${v(m.used)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>
      ` : ""}
    </div>
  </div>

  <!-- OPERATÖR GİRİŞLERİ -->
  ${operatorEntries.length > 0 ? `
  <div class="section">
    <div class="section-header">👤 Operatör Makine Girişleri</div>
    <div class="section-body">
      <table>
        <thead><tr><th>Makine</th><th>Biniş</th><th>İniş</th><th>Kazık (Ad.)</th><th>İmalat (m)</th><th>Boş Foraj</th><th>Ön Foraj</th><th>Beton</th><th>Not</th></tr></thead>
        <tbody>
          ${operatorEntries.map((oe: any) => {
            const pd = oe.pile_depths
            const pileDepths = Array.isArray(pd) ? pd : (typeof pd === "string" ? (() => { try { return JSON.parse(pd) } catch { return [] } })() : [])
            return `
            <tr>
              <td style="font-weight:600;">${oe.machine_name ?? ""}</td>
              <td class="td-center">${oe.start_time ?? "—"}</td>
              <td class="td-center">${oe.end_time ?? "—"}</td>
              <td class="td-center" style="color:#16a34a;font-weight:700;">${v(oe.daily_pile_count ?? oe.concrete_poured)}</td>
              <td class="td-center">${v(oe.total_production)}</td>
              <td class="td-center">${v(oe.empty_borehole, "0")}</td>
              <td class="td-center">${v(oe.pre_borehole, "0")}</td>
              <td class="td-center">${v(oe.concrete_poured)}</td>
              <td>${oe.note ?? ""}</td>
            </tr>
            ${pileDepths.length > 0 ? `
            <tr><td colspan="9" style="padding:4px 6px;background:#f8fafc;">
              <table style="width:auto;min-width:300px;">
                <thead><tr><th>No</th><th>Derinlik (m)</th><th>Ön Foraj</th><th>Boş Foraj</th></tr></thead>
                <tbody>
                  ${pileDepths.map((r: any, i: number) => `<tr><td class="td-center">${i + 1}</td><td class="td-center">${r.depth ?? ""}</td><td class="td-center">${r.onForaj ? "✓" : "—"}</td><td class="td-center">${r.bosForaj ? "✓" : "—"}</td></tr>`).join("")}
                </tbody>
              </table>
            </td></tr>
            ` : ""}
          `}).join("")}
        </tbody>
      </table>
      ${operatorEntries.some((oe: any) => oe.image1 || oe.image2 || (oe.notes && String(oe.notes).trim())) ? `
      <div style="margin-top:8px;">
        ${operatorEntries.map((oe: any) => {
          const hasContent = (oe.notes && String(oe.notes).trim()) || oe.image1 || oe.image2
          if (!hasContent) return ""
          return `<div style="margin-bottom:8px;">
            <div style="font-weight:700;color:#1a237e;margin-bottom:4px;">${oe.machine_name ?? ""}</div>
            ${oe.notes && String(oe.notes).trim() ? `<div class="notes-box" style="margin-bottom:6px;">${oe.notes}</div>` : ""}
            ${oe.image1 || oe.image2 ? `<div class="img-row">
              ${oe.image1 ? `<img src="${oe.image1}" alt="Op 1" />` : ""}
              ${oe.image2 ? `<img src="${oe.image2}" alt="Op 2" />` : ""}
            </div>` : ""}
          </div>`
        }).join("")}
      </div>
      ` : ""}
    </div>
  </div>
  ` : ""}

  <!-- KAZIK DETAYLARI -->
  ${(pileDetailsList || []).filter((p: any) => p.drilled || p.notes).length > 0 ? `
  <div class="section">
    <div class="section-header">🪝 Kazık Detayları</div>
    <div class="section-body">
      <table>
        <thead><tr><th>Kazık No</th><th>Delinen (m)</th><th>Beton</th><th>Notlar</th></tr></thead>
        <tbody>
          ${(pileDetailsList || []).filter((p: any) => p.drilled || p.notes).map((p: any) => `
          <tr>
            <td class="td-center" style="font-weight:700;">${p.pileNumber}</td>
            <td class="td-center">${p.drilled}</td>
            <td class="td-center">${p.concretePoured ? `<span style="color:#16a34a;font-weight:700;">✓ Evet</span>` : "—"}</td>
            <td>${p.notes}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>
  ` : ""}

  <!-- GÜNLÜK BİLGİLER -->
  ${(() => {
    const dailyImgs: string[] = Array.isArray(formData.dailyInfo?.images) && formData.dailyInfo.images.length > 0
      ? formData.dailyInfo.images.filter((s: unknown) => s && typeof s === "string")
      : [formData.dailyInfo?.image1, formData.dailyInfo?.image2].filter((s): s is string => !!s && typeof s === "string")
    const hasContent = formData.dailyInfo?.notes || dailyImgs.length > 0 || (formData.dailyInfo?.nextDayPlannedWork && String(formData.dailyInfo.nextDayPlannedWork).trim())
    if (!hasContent) return ""
    return `
  <div class="section">
    <div class="section-header">📝 Günlük Bilgiler</div>
    <div class="section-body">
      ${formData.dailyInfo?.notes ? `
      <div style="margin-bottom:8px;">
        <div style="font-size:9.5px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px;">Günlük Notlar</div>
        <div class="notes-box">${formData.dailyInfo.notes}</div>
      </div>` : ""}
      ${(formData.dailyInfo?.nextDayPlannedWork && String(formData.dailyInfo.nextDayPlannedWork).trim()) ? `
      <div style="margin-bottom:8px;">
        <div style="font-size:9.5px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:4px;">Yarın Planlanıyor</div>
        <div class="notes-box orange">
          <ul style="padding-left:14px;margin:0;">
            ${String(formData.dailyInfo.nextDayPlannedWork).split(/\r?\n/).filter((l: string) => l.trim()).map((l: string) => `<li style="margin-bottom:2px;">${l.trim()}</li>`).join("")}
          </ul>
        </div>
      </div>` : ""}
      ${dailyImgs.length > 0 ? `
      <div class="img-row">
        ${dailyImgs.map((src: string, i: number) => `<img src="${src}" alt="Sahadan ${i + 1}" />`).join("")}
      </div>` : ""}
    </div>
  </div>`
  })()}

  <!-- BAKIM / NOTLAR -->
  ${formData.notes ? `
  <div class="section">
    <div class="section-header">🔩 Bakım / Malzeme / Notlar</div>
    <div class="section-body">
      <div class="notes-box">${formData.notes}</div>
    </div>
  </div>
  ` : ""}

  <!-- FOOTER -->
  <div class="footer">
    <span>ICSP Reporter — Günlük Çalışma Raporu</span>
    <span>${dateStr} · ${formData.basicInfo?.project ?? ""}</span>
  </div>

</div>
</body>
</html>`
}

const expenseCategoryLabel: Record<string, string> = {
  santiye: "Şantiye",
  makine: "Makine",
  personel: "Personel",
  yakit: "Yakıt",
  diger: "Diğer",
}

export function generatePDFExpensesPage(formData: any) {
  const expenses = (formData.expenses ?? []).filter((e: any) => e?.description || e?.amount)
  const basicInfo = formData.basicInfo ?? {}
  const total = expenses.reduce((s: number, e: any) => s + (e?.amount ?? 0), 0)

  // Kategori bazında toplamlar
  const catTotals: Record<string, number> = {}
  expenses.forEach((e: any) => {
    const cat = e?.category ?? "diger"
    catTotals[cat] = (catTotals[cat] || 0) + (e?.amount ?? 0)
  })

  const dateStr = basicInfo.date ?? ""
  let formattedDate = dateStr
  try {
    const d = new Date(dateStr + "T12:00:00Z")
    formattedDate = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
  } catch {}

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Harcamalar — ${dateStr}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: #fff; line-height: 1.4; }
    .header { background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: #fff; padding: 14px 18px; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
    .header-left .title { font-size: 17px; font-weight: 700; }
    .header-left .subtitle { font-size: 11px; opacity: 0.8; margin-top: 2px; }
    .header-right { text-align: right; font-size: 12px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { background: #e8eaf6; color: #1a237e; font-weight: 700; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.4px; padding: 6px 8px; text-align: center; border: 1px solid #c7d2e8; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    .total-row td { background: #e8eaf6 !important; font-weight: 700; font-size: 12px; color: #1a237e; }
    .amount { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
    .cat-badge { display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 9px; font-weight: 700; }
    .cat-santiye { background: #dbeafe; color: #1d4ed8; }
    .cat-makine { background: #fce7f3; color: #9d174d; }
    .cat-personel { background: #d1fae5; color: #065f46; }
    .cat-yakit { background: #fef3c7; color: #92400e; }
    .cat-diger { background: #f1f5f9; color: #475569; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 6px; margin-bottom: 10px; }
    .summary-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 9px; text-align: center; background: #f8fafc; }
    .summary-label { font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 2px; }
    .summary-value { font-size: 13px; font-weight: 700; color: #1a237e; }
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>

  <div class="header">
    <div class="header-left">
      <div class="title">HARCAMALAR</div>
      <div class="subtitle">Expenses</div>
    </div>
    <div class="header-right">
      <div>${formattedDate}</div>
      <div style="opacity:0.85;font-weight:400;margin-top:2px;">${basicInfo.project ?? ""}</div>
    </div>
  </div>

  ${Object.keys(catTotals).length > 0 ? `
  <div class="summary-grid">
    ${Object.entries(catTotals).map(([cat, amt]) => `
    <div class="summary-card">
      <div class="summary-label">${expenseCategoryLabel[cat] ?? cat}</div>
      <div class="summary-value">${(amt as number).toLocaleString("tr-TR")}</div>
    </div>`).join("")}
    <div class="summary-card" style="border-color:#1a237e;background:#eef2ff;">
      <div class="summary-label">Toplam</div>
      <div class="summary-value">${total.toLocaleString("tr-TR")}</div>
    </div>
  </div>
  ` : ""}

  <table>
    <thead>
      <tr><th style="width:6%;">#</th><th style="width:16%;">Kategori</th><th>Açıklama</th><th style="width:22%;text-align:right;">Tutar (IQD)</th></tr>
    </thead>
    <tbody>
      ${expenses.length > 0 ? expenses.map((e: any, i: number) => {
        const cat = e?.category ?? "diger"
        const label = expenseCategoryLabel[cat] ?? "Diğer"
        const badgeClass = `cat-${cat}`
        return `<tr>
          <td style="text-align:center;color:#94a3b8;font-weight:600;">${i + 1}</td>
          <td><span class="cat-badge ${badgeClass}">${label}</span></td>
          <td>${e?.description ?? ""}</td>
          <td class="amount">${e?.amount ? Number(e.amount).toLocaleString("tr-TR") : "—"}</td>
        </tr>`
      }).join("") : `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px;">Harcama kaydedilmemiş</td></tr>`}
      ${expenses.length > 0 ? `
      <tr class="total-row">
        <td colspan="3" style="text-align:right;">TOPLAM</td>
        <td class="amount">${total.toLocaleString("tr-TR")} IQD</td>
      </tr>` : ""}
    </tbody>
  </table>

  <div class="footer">
    <span>ICSP Reporter — Harcama Raporu</span>
    <span>${dateStr}</span>
  </div>

</body>
</html>`
}
