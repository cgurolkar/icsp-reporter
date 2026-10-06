/** Makine / şantiye iş istatistikleri — günlük rapor production_summary_json kaynaklı */

export function normMachineName(s: unknown): string {
  return String(s ?? "").trim().toLocaleLowerCase("tr-TR")
}

export type ProductionMachineSlice = {
  machineId: string
  machineName: string
  piles: number
  meters: number
  /** Günlük rapordaki beton dökülen kazık (Ad.) */
  betonPiles: number
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
    const betonRaw = String(rec.concretePoured ?? rec.concrete_poured ?? "").trim()
    const betonPiles = betonRaw !== "" && /^\d+$/.test(betonRaw) ? Math.max(0, parseInt(betonRaw, 10) || 0) : 0
    if (piles === 0 && meters === 0 && betonPiles === 0) continue
    out.push({
      machineId,
      machineName: machineName || machineId,
      piles,
      meters,
      betonPiles,
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
  /** Günlük raporlardan delgi (Ad.) + rapor öncesi boş foraj */
  pileCount: number
  totalMeters: number
  /** Rapor öncesi (şantiye kartı) — makine bazında */
  preReportEmptyBorehole?: number
  preReportBetonPiles?: number
  preReportMeters?: number
  /** Raporlardan makine bazında beton dökülen (Ad.) */
  reportBetonPiles?: number
  /** Rapor öncesi + raporlardan makine bazında beton (Ad.) */
  cumulativeBetonPiles?: number
  costPerMeter: number | null
  billingCurrency: string | null
  earnedAmount: number | null
  expenseTotalUsd: number
  expenseTotalIqd: number
}

export type MachineWorkAggBucket = {
  machineId: number | null
  machineName: string
  siteId: number
  siteName: string
  siteCode: string
  pileCount: number
  totalMeters: number
  preReportEmptyBorehole: number
  preReportBetonPiles: number
  preReportMeters: number
  reportBetonPiles: number
  unitPrices: Record<string, number>
  billingCurrency: string | null
}

/** Aynı makine için id / isim anahtarı çiftlerini birleştirir. */
export function consolidateMachineWorkAgg(agg: Map<string, MachineWorkAggBucket>): Map<string, MachineWorkAggBucket> {
  const out = new Map<string, MachineWorkAggBucket>()
  for (const bucket of agg.values()) {
    const mid = bucket.machineId
    const canonKey =
      mid != null && mid > 0
        ? machineWorkAggKey(bucket.siteId, mid, bucket.machineName)
        : machineWorkAggKey(bucket.siteId, null, bucket.machineName)
    const prev = out.get(canonKey)
    if (!prev) {
      out.set(canonKey, { ...bucket })
      continue
    }
    prev.pileCount += bucket.pileCount
    prev.totalMeters += bucket.totalMeters
    prev.preReportEmptyBorehole += bucket.preReportEmptyBorehole
    prev.preReportBetonPiles += bucket.preReportBetonPiles
    prev.preReportMeters += bucket.preReportMeters
    prev.reportBetonPiles += bucket.reportBetonPiles
    prev.unitPrices = { ...prev.unitPrices, ...bucket.unitPrices }
    if (prev.machineId == null && bucket.machineId != null) prev.machineId = bucket.machineId
    if (prev.machineName.length < bucket.machineName.length) prev.machineName = bucket.machineName
  }
  return out
}

export function resolveMachineIdFromSlice(
  machineId: string,
  machineName: string,
  idByName: Map<string, number>,
): number | null {
  if (/^\d+$/.test(machineId)) {
    const id = parseInt(machineId, 10)
    if (!Number.isNaN(id) && id > 0) return id
  }
  const byName = idByName.get(normMachineName(machineName))
  return byName ?? null
}