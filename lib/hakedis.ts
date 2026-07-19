import type { PileDetail, PriceTier } from "@/types/form-data"
import { parseMeters } from "@/lib/concrete-meters"

export type HakedisRate = {
  id: number
  diameter_mm: number
  label: string | null
  price_primary: number
  price_secondary: number | null
  is_active?: boolean
}

export type HakedisLine = {
  diameterMm: number | null
  label: string
  priceTier: string
  unitPrice: number
  meters: number
  amount: number
}

export type HakedisBreakdown = {
  totalMeters: number
  totalAmount: number
  lines: HakedisLine[]
  usedRates: boolean
}

function rateLabel(rate: HakedisRate): string {
  if (rate.label && String(rate.label).trim()) return String(rate.label).trim()
  return `Ø${rate.diameter_mm}`
}

function unitPriceFor(rate: HakedisRate | undefined, tier: PriceTier | string | undefined, fallback: number | null): number | null {
  if (rate) {
    if (tier === "secondary" && rate.price_secondary != null && Number.isFinite(Number(rate.price_secondary))) {
      return Number(rate.price_secondary)
    }
    return Number(rate.price_primary) || 0
  }
  if (fallback != null && Number.isFinite(fallback)) return fallback
  return null
}

function mergeLines(into: Map<string, HakedisLine>, line: HakedisLine) {
  const key = `${line.diameterMm ?? "x"}|${line.priceTier}|${line.unitPrice}`
  const prev = into.get(key)
  if (prev) {
    prev.meters += line.meters
    prev.amount += line.amount
  } else {
    into.set(key, { ...line })
  }
}

/** Tek gün: beton dökülen satırlardan kırılımlı hakediş. */
export function computeDayHakedis(
  pileDetails: PileDetail[] | null | undefined,
  rates: HakedisRate[],
  fallbackUnitPrice: number | null,
  concreteTotalLengthFallback?: string | number | null,
): HakedisBreakdown {
  const byId = new Map(rates.map((r) => [String(r.id), r]))
  const lineMap = new Map<string, HakedisLine>()
  let fromRows = 0
  const piles = Array.isArray(pileDetails) ? pileDetails : []

  for (const p of piles) {
    if (!p?.concretePoured) continue
    const meters = parseMeters(p.drilled)
    if (meters <= 0) continue
    fromRows += meters
    const rateId = p.diameterRateId != null && String(p.diameterRateId).trim() !== "" ? String(p.diameterRateId) : ""
    const rate = rateId ? byId.get(rateId) : undefined
    const tier = (p.priceTier === "secondary" ? "secondary" : "primary") as PriceTier
    const unit = unitPriceFor(rate, tier, fallbackUnitPrice)
    if (unit == null) continue
    mergeLines(lineMap, {
      diameterMm: rate?.diameter_mm ?? null,
      label: rate ? rateLabel(rate) : "Tek fiyat",
      priceTier: rate ? tier : "default",
      unitPrice: unit,
      meters,
      amount: meters * unit,
    })
  }

  // Satır yoksa ama toplam boy + tek fiyat varsa (eski raporlar / tarife yok)
  if (fromRows <= 0 && rates.length === 0 && fallbackUnitPrice != null) {
    const meters = parseMeters(concreteTotalLengthFallback)
    if (meters > 0) {
      mergeLines(lineMap, {
        diameterMm: null,
        label: "Tek fiyat",
        priceTier: "default",
        unitPrice: fallbackUnitPrice,
        meters,
        amount: meters * fallbackUnitPrice,
      })
      fromRows = meters
    }
  }

  const lines = [...lineMap.values()].sort((a, b) => (a.diameterMm ?? 0) - (b.diameterMm ?? 0) || a.priceTier.localeCompare(b.priceTier))
  const totalMeters = lines.reduce((s, l) => s + l.meters, 0)
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0)
  return {
    totalMeters,
    totalAmount,
    lines,
    usedRates: rates.length > 0,
  }
}

/** Birden fazla rapor kaydından kümülatif hakediş. */
export function computeHakedisFromReports(
  reports: Array<{ pile_details?: unknown; concrete_total_length?: unknown }>,
  rates: HakedisRate[],
  fallbackUnitPrice: number | null,
): HakedisBreakdown {
  const lineMap = new Map<string, HakedisLine>()
  let usedRates = rates.length > 0

  for (const r of reports) {
    let piles: PileDetail[] = []
    const raw = r.pile_details
    if (Array.isArray(raw)) piles = raw as PileDetail[]
    else if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) piles = parsed
      } catch {
        piles = []
      }
    }
    const day = computeDayHakedis(
      piles,
      rates,
      fallbackUnitPrice,
      r.concrete_total_length as string | number | null | undefined,
    )
    if (day.usedRates) usedRates = true
    for (const line of day.lines) mergeLines(lineMap, line)
  }

  const lines = [...lineMap.values()].sort((a, b) => (a.diameterMm ?? 0) - (b.diameterMm ?? 0) || a.priceTier.localeCompare(b.priceTier))
  return {
    totalMeters: lines.reduce((s, l) => s + l.meters, 0),
    totalAmount: lines.reduce((s, l) => s + l.amount, 0),
    lines,
    usedRates,
  }
}

export function publicPileRateOptions(rates: HakedisRate[]): Array<{ id: number; diameterMm: number; label: string }> {
  return rates
    .filter((r) => r.is_active !== false)
    .map((r) => ({
      id: r.id,
      diameterMm: r.diameter_mm,
      label: rateLabel(r),
    }))
}
