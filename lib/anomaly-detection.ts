/**
 * Kural tabanlı anomali tespiti.
 * Raporlardaki olağandışı durumları (sıfır makine saati, yüksek harcama vb.) tespit eder.
 */

import type { AnomalyItem } from "./email-templates"

export interface ReportAnomalyInput {
  machineHours?: string | number | null
  dailyPileCount?: string | number | null
  personnelTotal?: string | number | null
  dailyFuelUsage?: string | number | null
  expenseTotal?: number | null
  remainingPiles?: string | number | null
  notes?: string | null
  dailyNotes?: string | null
  selectedMachineName?: string | null
}

// Eşik değerleri — gerekirse .env'den veya ayarlardan okunabilir
const THRESHOLDS = {
  maxDailyExpense: 50_000,    // ₺ — bu değeri aşan günlük harcama uyarısı
  maxDailyFuel: 5_000,        // litre — makul üst sınır
  minMachineHoursWhenWorking: 1,  // çalışıldığı günler minimum saat
  maxMachineHours: 24,        // günde 24 saatten fazla olamaz
}

function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number") return Number.isNaN(v) ? null : v
  const n = parseFloat(String(v).replace(",", "."))
  return Number.isNaN(n) ? null : n
}

/**
 * Bir rapor için anomali listesi döner.
 */
export function detectReportAnomalies(data: ReportAnomalyInput): AnomalyItem[] {
  const anomalies: AnomalyItem[] = []

  const machineHours = toNum(data.machineHours)
  const dailyPileCount = toNum(data.dailyPileCount)
  const personnelTotal = toNum(data.personnelTotal)
  const dailyFuelUsage = toNum(data.dailyFuelUsage)
  const expenseTotal = data.expenseTotal ?? null
  const remainingPiles = toNum(data.remainingPiles)

  // Makine saati sıfır ama kazık yapılmış
  if (machineHours !== null && machineHours === 0 && dailyPileCount !== null && dailyPileCount > 0) {
    anomalies.push({
      level: "warning",
      field: "Makine Saati",
      message: `Makine saati 0 girilmiş ama ${dailyPileCount} kazık rapor edilmiş. Lütfen kontrol edin.`,
    })
  }

  // Makine saati hiç girilmemiş ama kazık var
  if ((machineHours === null || machineHours === 0) && dailyPileCount !== null && dailyPileCount > 0 && !data.selectedMachineName) {
    anomalies.push({
      level: "warning",
      field: "Makine",
      message: "Makine seçilmemiş veya çalışma saati girilmemiş.",
    })
  }

  // Makine saati 24'ü aşıyor
  if (machineHours !== null && machineHours > THRESHOLDS.maxMachineHours) {
    anomalies.push({
      level: "error",
      field: "Makine Saati",
      message: `${machineHours} saat girilmiş — bir günde ${THRESHOLDS.maxMachineHours} saatten fazla olamaz.`,
    })
  }

  // Personel sıfır veya girilmemiş
  if (personnelTotal !== null && personnelTotal === 0) {
    anomalies.push({
      level: "warning",
      field: "Personel",
      message: "Toplam personel sayısı 0 girilmiş.",
    })
  }

  // Günlük harcama eşiği aşıldı
  if (expenseTotal !== null && expenseTotal > THRESHOLDS.maxDailyExpense) {
    anomalies.push({
      level: "warning",
      field: "Günlük Harcama",
      message: `₺${expenseTotal.toLocaleString("tr-TR")} — olağandışı yüksek harcama (eşik: ₺${THRESHOLDS.maxDailyExpense.toLocaleString("tr-TR")}).`,
    })
  }

  // Yakıt olağandışı yüksek
  if (dailyFuelUsage !== null && dailyFuelUsage > THRESHOLDS.maxDailyFuel) {
    anomalies.push({
      level: "warning",
      field: "Yakıt",
      message: `${dailyFuelUsage} litre girilmiş — olağandışı yüksek değer.`,
    })
  }

  // Kalan kazık sıfıra indi (proje tamamlandı mı?)
  if (remainingPiles !== null && remainingPiles === 0) {
    anomalies.push({
      level: "warning",
      field: "Kalan Kazık",
      message: "Kalan kazık sayısı 0'a indi. Proje tamamlandı mı?",
    })
  }

  // Kalan kazık negatif (hata)
  if (remainingPiles !== null && remainingPiles < 0) {
    anomalies.push({
      level: "error",
      field: "Kalan Kazık",
      message: `Kalan kazık negatif (${remainingPiles}). Veri girişini kontrol edin.`,
    })
  }

  return anomalies
}

/**
 * Birden fazla rapor için toplu anomali tespiti (günlük özet için).
 */
export function detectDailyAnomalies(reports: ReportAnomalyInput[]): AnomalyItem[] {
  const allAnomalies: AnomalyItem[] = []
  for (const report of reports) {
    allAnomalies.push(...detectReportAnomalies(report))
  }
  // Tekrarları filtrele (aynı mesaj birden fazla kez varsa bir kez göster)
  const seen = new Set<string>()
  return allAnomalies.filter((a) => {
    const key = `${a.level}:${a.field}:${a.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
