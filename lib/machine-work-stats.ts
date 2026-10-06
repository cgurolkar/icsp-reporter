/** Makine / şantiye iş istatistikleri — günlük rapor production_summary_json kaynaklı */

export function normMachineName(s: unknown): string {
  return String(s ?? "").trim().toLocaleLowerCase("tr-TR")
}

export type ProductionMachineSlice = {
  machineId: string
  machineName: string
  piles: number
  meters: number
}

export function slicesFromProductionSummaryJson(raw: unknown): ProductionMachineSlice[] {
  let arr: unknown[] | null = null
  if (Array.isArray(raw)) arr = raw
  else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) arr = parsed
    } catch {
      arr = null
    }
  }
  if (!arr?.length) return []
  const out: ProductionMachineSlice[] = []
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const machineName = String(rec.machineName ?? rec.machine_name ?? "").trim()
    const machineId = String(rec.machineId ?? rec.machine_id ?? "").trim()
    if (!machineName && !machineId) continue
    const pilesRaw = String(rec.dailyDrilledPiles ?? rec.daily_drilled_piles ?? rec.dailyPileCount ?? "").trim()
    const piles = pilesRaw !== "" && /^\d+$/.test(pilesRaw) ? Math.max(0, parseInt(pilesRaw, 10) || 0) : 0
    const metersRaw = String(rec.totalProduction ?? rec.total_production ?? "").trim().replace(",", ".")
    const meters = metersRaw !== "" && Number.isFinite(Number(metersRaw)) ? Math.max(0, Number(metersRaw)) : 0
    if (piles === 0 && meters === 0) continue
    out.push({
      machineId,
      machineName: machineName || machineId,
      piles,
      meters,
    })
  }
  return out
}

export type MachineWorkAggKey = string

export function machineWorkAggKey(siteId: number, machineId: number | null, machineName: string): MachineWorkAggKey {
  if (machineId != null && machineId > 0) return `${siteId}:id:${machineId}`
  return `${siteId}:name:${normMachineName(machineName)}`
}

export interface MachineWorkStatRow {
  machineId: number | null
  machineName: string
  siteId: number
  siteName: string
  siteCode: string
  pileCount: number
  totalMeters: number
  costPerMeter: number | null
  billingCurrency: string | null
  earnedAmount: number | null
  expenseTotalUsd: number
  expenseTotalIqd: number
}