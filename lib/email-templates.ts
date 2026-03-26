/**
 * Temiz, mobil uyumlu e-posta HTML şablonları.
 * Tam rapor HTML'i göndermek yerine özet bildirimler gönderir.
 */

export interface ReportNotificationData {
  reportId: number
  date: string
  siteName: string
  siteCode?: string | null
  project?: string
  submittedBy?: string
  // Üretim
  dailyPileCount?: string | number | null
  totalPileCount?: string | number | null
  remainingPiles?: string | number | null
  concretePoured?: string | number | null
  // Personel
  personnelTotal?: string | number | null
  engineerCount?: string | number | null
  // Makine
  machineHours?: string | number | null
  selectedMachineName?: string | null
  // Yakıt & Harcama
  dailyFuelUsage?: string | number | null
  expenseTotal?: number | null
  // Notlar
  notes?: string | null
  dailyNotes?: string | null
  // Anomaliler
  anomalies?: AnomalyItem[]
  // Rapor URL (opsiyonel)
  reportUrl?: string
}

export interface AnomalyItem {
  level: "warning" | "error"
  field: string
  message: string
}

export interface DailySummaryData {
  date: string
  totalReports: number
  sites: {
    siteName: string
    siteCode?: string | null
    reportCount: number
    totalPiles: number
    totalPersonnel: number
    totalExpenses: number
    anomalies: AnomalyItem[]
  }[]
  missingReportSites?: { siteName: string; siteCode?: string | null }[]
}

// Renk paleti
const COLORS = {
  primary: "#1a3a5c",      // koyu lacivert
  accent: "#2563eb",       // mavi
  warning: "#d97706",      // turuncu
  error: "#dc2626",        // kırmızı
  success: "#16a34a",      // yeşil
  bg: "#f8fafc",           // açık gri arkaplan
  cardBg: "#ffffff",
  border: "#e2e8f0",
  textPrimary: "#1e293b",
  textSecondary: "#64748b",
}

function baseLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${COLORS.textPrimary};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${COLORS.primary} 0%,#2d5a8e 100%);padding:28px 32px;border-radius:12px 12px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:4px;">ICSP Reporter</div>
                    <div style="font-size:20px;font-weight:700;color:#ffffff;">${title}</div>
                  </td>
                  <td align="right">
                    <div style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;">📋</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background:${COLORS.cardBg};padding:28px 32px;border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9;padding:16px 32px;border-radius:0 0 12px 12px;border:1px solid ${COLORS.border};border-top:none;">
              <div style="font-size:12px;color:${COLORS.textSecondary};text-align:center;">
                Bu e-posta ICSP Reporter sistemi tarafından otomatik olarak gönderilmiştir.<br>
                Yanıtlamayınız.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function stat(label: string, value: string | number | null | undefined, icon = "—"): string {
  const displayVal = (value != null && value !== "" && value !== "—") ? String(value) : "—"
  return `
  <td style="text-align:center;padding:12px 8px;">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.textSecondary};margin-bottom:4px;">${label}</div>
    <div style="font-size:22px;font-weight:700;color:${COLORS.primary};line-height:1.1;">${displayVal}</div>
    <div style="font-size:11px;color:${COLORS.textSecondary};margin-top:2px;">${icon}</div>
  </td>`
}

function anomalyBadge(item: AnomalyItem): string {
  const bg = item.level === "error" ? "#fef2f2" : "#fffbeb"
  const border = item.level === "error" ? "#fecaca" : "#fde68a"
  const color = item.level === "error" ? COLORS.error : COLORS.warning
  const emoji = item.level === "error" ? "🚨" : "⚠️"
  return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:${color};">
    ${emoji} <strong>${item.field}:</strong> ${item.message}
  </div>`
}

function infoRow(label: string, value: string | null | undefined): string {
  if (!value) return ""
  return `<tr>
    <td style="padding:6px 0;font-size:13px;color:${COLORS.textSecondary};width:140px;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:${COLORS.textPrimary};font-weight:500;">${value}</td>
  </tr>`
}

/**
 * Yeni rapor gönderildi bildirimi e-postası.
 * Tam HTML yerine özet bilgi içerir.
 */
export function buildReportNotificationEmail(data: ReportNotificationData): { subject: string; html: string } {
  const subject = `📋 Yeni Rapor: ${data.siteName} — ${formatDate(data.date)}`

  const hasAnomalies = data.anomalies && data.anomalies.length > 0
  const expenseStr = data.expenseTotal != null ? `₺${data.expenseTotal.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : null

  const content = `
  <!-- Site & Date info -->
  <div style="background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${infoRow("Şantiye", data.siteName + (data.siteCode ? ` <span style="color:${COLORS.textSecondary}">(${data.siteCode})</span>` : ""))}
      ${infoRow("Tarih", formatDate(data.date))}
      ${data.submittedBy ? infoRow("Gönderen", data.submittedBy) : ""}
      ${data.selectedMachineName ? infoRow("Makine", data.selectedMachineName) : ""}
    </table>
  </div>

  <!-- Stats grid -->
  <div style="margin-bottom:24px;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.textSecondary};font-weight:600;margin-bottom:12px;">Üretim Özeti</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid ${COLORS.border};border-radius:10px;">
      <tr>
        ${stat("Günlük Kazık", data.dailyPileCount, "adet")}
        ${stat("Toplam Kazık", data.totalPileCount, "kümülatif")}
        ${stat("Kalan Kazık", data.remainingPiles, "adet")}
        ${stat("Makine Saati", data.machineHours, "saat")}
      </tr>
      <tr style="border-top:1px solid ${COLORS.border};">
        ${stat("Personel", data.personnelTotal, "kişi")}
        ${stat("Yakıt", data.dailyFuelUsage, "litre")}
        ${stat("Harcama", expenseStr, "bugün")}
        ${stat("Beton", data.concretePoured, "adet")}
      </tr>
    </table>
  </div>

  ${hasAnomalies ? `
  <!-- Anomalies -->
  <div style="margin-bottom:24px;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.textSecondary};font-weight:600;margin-bottom:12px;">⚠️ Dikkat Gerektiren Durumlar</div>
    ${data.anomalies!.map(anomalyBadge).join("")}
  </div>
  ` : ""}

  ${(data.dailyNotes || data.notes) ? `
  <!-- Notes -->
  <div style="margin-bottom:24px;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.textSecondary};font-weight:600;margin-bottom:12px;">Notlar</div>
    <div style="background:#f8fafc;border-left:3px solid ${COLORS.accent};padding:12px 16px;border-radius:0 8px 8px 0;font-size:13px;color:${COLORS.textPrimary};line-height:1.6;">
      ${escapeHtml(data.dailyNotes || data.notes || "")}
    </div>
  </div>
  ` : ""}

  ${data.reportUrl ? `
  <!-- CTA -->
  <div style="text-align:center;margin-top:8px;">
    <a href="${data.reportUrl}" style="display:inline-block;background:${COLORS.accent};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
      Tam Raporu Görüntüle →
    </a>
  </div>
  ` : ""}
  `

  return {
    subject,
    html: baseLayout(subject.replace(/^📋 /, ""), content),
  }
}

/**
 * Günlük özet e-postası — tüm şantiyeler için gün sonu özeti.
 */
export function buildDailySummaryEmail(data: DailySummaryData): { subject: string; html: string } {
  const subject = `📊 Günlük Özet: ${formatDate(data.date)} — ${data.totalReports} Rapor`

  const totalPiles = data.sites.reduce((s, x) => s + (x.totalPiles || 0), 0)
  const totalPersonnel = data.sites.reduce((s, x) => s + (x.totalPersonnel || 0), 0)
  const totalExpenses = data.sites.reduce((s, x) => s + (x.totalExpenses || 0), 0)
  const totalAnomalies = data.sites.reduce((s, x) => s + x.anomalies.length, 0)

  const siteRows = data.sites.map((site) => {
    const anomalyBadges = site.anomalies.map(anomalyBadge).join("")
    return `
    <tr style="border-bottom:1px solid ${COLORS.border};">
      <td style="padding:14px 12px;vertical-align:top;">
        <div style="font-weight:600;font-size:14px;color:${COLORS.primary};">${site.siteName}</div>
        ${site.siteCode ? `<div style="font-size:11px;color:${COLORS.textSecondary};margin-top:2px;">${site.siteCode}</div>` : ""}
      </td>
      <td style="padding:14px 12px;text-align:center;vertical-align:top;">
        <div style="font-size:18px;font-weight:700;color:${COLORS.primary};">${site.totalPiles || "—"}</div>
        <div style="font-size:10px;color:${COLORS.textSecondary};">kazık</div>
      </td>
      <td style="padding:14px 12px;text-align:center;vertical-align:top;">
        <div style="font-size:18px;font-weight:700;color:${COLORS.primary};">${site.totalPersonnel || "—"}</div>
        <div style="font-size:10px;color:${COLORS.textSecondary};">kişi</div>
      </td>
      <td style="padding:14px 12px;text-align:right;vertical-align:top;">
        <div style="font-size:14px;font-weight:600;color:${COLORS.primary};">${site.totalExpenses > 0 ? `₺${site.totalExpenses.toLocaleString("tr-TR")}` : "—"}</div>
      </td>
      ${anomalyBadges ? `<td style="padding:14px 12px;vertical-align:top;">${anomalyBadges}</td>` : `<td style="padding:14px 12px;text-align:center;color:${COLORS.success};">✓</td>`}
    </tr>`
  }).join("")

  const missingSiteRows = (data.missingReportSites || []).map((s) => `
    <div style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:6px 12px;margin:4px;font-size:13px;color:${COLORS.error};">
      ${s.siteName}${s.siteCode ? ` (${s.siteCode})` : ""}
    </div>`).join("")

  const content = `
  <!-- Date Banner -->
  <div style="background:linear-gradient(135deg,#f0f7ff 0%,#e8f0fe 100%);border:1px solid #bfdbfe;border-radius:10px;padding:16px 24px;margin-bottom:24px;text-align:center;">
    <div style="font-size:28px;font-weight:800;color:${COLORS.primary};">${formatDate(data.date)}</div>
    <div style="font-size:14px;color:${COLORS.textSecondary};margin-top:4px;">Günlük Çalışma Özeti</div>
  </div>

  <!-- Top Stats -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid ${COLORS.border};border-radius:10px;margin-bottom:24px;">
    <tr>
      ${stat("Toplam Rapor", data.totalReports, "şantiye")}
      ${stat("Toplam Kazık", totalPiles || null, "adet")}
      ${stat("Toplam Personel", totalPersonnel || null, "kişi")}
      ${stat("Toplam Harcama", totalExpenses > 0 ? `₺${totalExpenses.toLocaleString("tr-TR")}` : null, "bugün")}
    </tr>
  </table>

  ${totalAnomalies > 0 ? `
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:14px;color:${COLORS.warning};">
    ⚠️ Bugün toplam <strong>${totalAnomalies}</strong> anomali tespit edildi. Şantiye detaylarına bakın.
  </div>` : `
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:14px;color:${COLORS.success};">
    ✅ Bugün hiçbir şantiyede anomali tespit edilmedi.
  </div>`}

  <!-- Site Table -->
  ${data.sites.length > 0 ? `
  <div style="margin-bottom:24px;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.textSecondary};font-weight:600;margin-bottom:12px;">Şantiye Bazında Özet</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLORS.border};border-radius:10px;border-collapse:collapse;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:${COLORS.textSecondary};font-weight:600;">Şantiye</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:${COLORS.textSecondary};font-weight:600;">Kazık</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:${COLORS.textSecondary};font-weight:600;">Personel</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:${COLORS.textSecondary};font-weight:600;">Harcama</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:${COLORS.textSecondary};font-weight:600;">Durum</th>
        </tr>
      </thead>
      <tbody>
        ${siteRows}
      </tbody>
    </table>
  </div>
  ` : ""}

  ${missingSiteRows ? `
  <!-- Missing Reports -->
  <div style="margin-bottom:24px;">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${COLORS.error};font-weight:600;margin-bottom:12px;">🚨 Rapor Gönderilmeyen Şantiyeler</div>
    <div>${missingSiteRows}</div>
  </div>
  ` : ""}
  `

  return {
    subject,
    html: baseLayout("Günlük Özet Raporu", content),
  }
}

/**
 * E-posta test şablonu.
 */
export function buildTestEmail(): { subject: string; html: string } {
  const subject = "✅ ICSP Reporter — E-posta Yapılandırması Çalışıyor"
  const content = `
  <div style="text-align:center;padding:20px 0;">
    <div style="font-size:56px;margin-bottom:16px;">✅</div>
    <div style="font-size:20px;font-weight:700;color:${COLORS.primary};margin-bottom:8px;">E-posta Sistemi Çalışıyor!</div>
    <div style="font-size:14px;color:${COLORS.textSecondary};max-width:400px;margin:0 auto;line-height:1.6;">
      SMTP yapılandırmanız doğru çalışıyor. Yeni raporlar gönderildiğinde bu adrese bildirim e-postası gelecektir.
    </div>
    <div style="margin-top:24px;background:#f8fafc;border:1px solid ${COLORS.border};border-radius:8px;padding:16px;display:inline-block;text-align:left;">
      <div style="font-size:12px;color:${COLORS.textSecondary};margin-bottom:8px;">Test bilgileri</div>
      <div style="font-size:13px;color:${COLORS.textPrimary};font-family:monospace;">Gönderim zamanı: ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</div>
    </div>
  </div>
  `
  return {
    subject,
    html: baseLayout("E-posta Test", content),
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return dateStr
  try {
    const d = new Date(dateStr + "T12:00:00Z")
    return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
  } catch {
    return dateStr
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
}
