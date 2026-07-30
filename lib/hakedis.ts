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
  currency?: string
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

/** Aktif tarife sayısı 0 veya 1 → tek fiyat / tek çap şantiyesi */
export function isSingleTariffSite(rates: HakedisRate[]): boolean {
  const active = rates.filter((r) => r.is_active !== false)
  return active.length <= 1
}

/**
 * Devam eden + tek tarife şantiyelerde rapor öncesi beton metrajını hakedişe ekler.
 */
export function withPreReportMeters(
  base: HakedisBreakdown,
  opts: {
    isOngoing: boolean
    initialConcreteMeters: number
    rates: HakedisRate[]
    fallbackUnitPrice: number | null
  },
): HakedisBreakdown {
  const meters = Number(opts.initialConcreteMeters) || 0
  if (!opts.isOngoing || meters <= 0 || !isSingleTariffSite(opts.rates)) {
    return base
  }
  const active = opts.rates.filter((r) => r.is_active !== false)
  const rate = active[0]
  const unit = unitPriceFor(rate, "primary", opts.fallbackUnitPrice)
  if (unit == null) return base

  const lineMap = new Map<string, HakedisLine>()
  for (const line of base.lines) mergeLines(lineMap, line)
  mergeLines(lineMap, {
    diameterMm: rate?.diameter_mm ?? null,
    label: rate ? `${rateLabel(rate)} (rapor öncesi)` : "Rapor öncesi",
    priceTier: "pre_report",
    unitPrice: unit,
    meters,
    amount: meters * unit,
  })
  const lines = [...lineMap.values()].sort(
    (a, b) => (a.diameterMm ?? 0) - (b.diameterMm ?? 0) || a.priceTier.localeCompare(b.priceTier),
  )
  return {
    totalMeters: lines.reduce((s, l) => s + l.meters, 0),
    totalAmount: lines.reduce((s, l) => s + l.amount, 0),
    lines,
    usedRates: base.usedRates || active.length > 0,
    currency: base.currency,
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

  // Eski kayıtlarda concretePoured işareti olmayabilir; hiç işaret yoksa metrajlı satırları say.
  const anyConcreteMarked = piles.some((p) => {
    const v = (p as { concretePoured?: unknown; concrete_poured?: unknown })?.concretePoured
      ?? (p as { concrete_poured?: unknown })?.concrete_poured
    return v === true || v === "true" || v === 1 || v === "1"
  })

  for (const p of piles) {
    const pouredRaw =
      (p as { concretePoured?: unknown; concrete_poured?: unknown })?.concretePoured ??
      (p as { concrete_poured?: unknown })?.concrete_poured
    const poured =
      pouredRaw === true || pouredRaw === "true" || pouredRaw === 1 || pouredRaw === "1"
    if (anyConcreteMarked && !poured) continue
    const meters = parseMeters(
      (p as { drilled?: unknown }).drilled ?? (p as { drilled_m?: unknown }).drilled_m,
    )
    if (meters <= 0) continue
    const rateIdRaw =
      (p as { diameterRateId?: unknown }).diameterRateId ??
      (p as { diameter_rate_id?: unknown }).diameter_rate_id
    const rateId = rateIdRaw != null && String(rateIdRaw).trim() !== "" ? String(rateIdRaw) : ""
    const activeRates = rates.filter((r) => r.is_active !== false)
    let rate = rateId ? byId.get(rateId) : undefined
    // Tek tarife / id yok veya eşleşmiyor: şantiyenin aktif tarifesini kullan
    if (!rate && isSingleTariffSite(rates) && activeRates[0]) {
      rate = activeRates[0]
    }
    const tierRaw =
      (p as { priceTier?: unknown }).priceTier ?? (p as { price_tier?: unknown }).price_tier
    const tier = (tierRaw === "secondary" ? "secondary" : "primary") as PriceTier
    let unit = unitPriceFor(rate, tier, fallbackUnitPrice)
    // contract_unit_price boşsa bile tarife fiyatını kullan
    if (unit == null && rate) {
      unit =
        tier === "secondary" && rate.price_secondary != null
          ? Number(rate.price_secondary)
          : Number(rate.price_primary) || null
    }
    if (unit == null && activeRates[0]) {
      unit = Number(activeRates[0].price_primary) || null
      if (unit != null && !rate) rate = activeRates[0]
    }
    if (unit == null) continue
    fromRows += meters
    mergeLines(lineMap, {
      diameterMm: rate?.diameter_mm ?? null,
      label: rate ? rateLabel(rate) : "Tek fiyat",
      priceTier: rate ? tier : "default",
      unitPrice: unit,
      meters,
      amount: meters * unit,
    })
  }

  // Satırlardan metraj çıkmadıysa rapor toplam boyu × birim fiyat (eski raporlar / tarife sonrası)
  if (fromRows <= 0) {
    const meters = parseMeters(concreteTotalLengthFallback)
    if (meters > 0) {
      const active = rates.filter((r) => r.is_active !== false)
      const rate = isSingleTariffSite(rates) ? active[0] : undefined
      let unit = unitPriceFor(rate, "primary", fallbackUnitPrice)
      if (unit == null && active[0]) {
        unit = Number(active[0].price_primary) || null
      }
      if (unit != null) {
        const labelRate = rate ?? active[0]
        mergeLines(lineMap, {
          diameterMm: labelRate?.diameter_mm ?? null,
          label: labelRate ? `${rateLabel(labelRate)} (toplam boy)` : "Tek fiyat",
          priceTier: labelRate ? "primary" : "default",
          unitPrice: unit,
          meters,
          amount: meters * unit,
        })
        fromRows = meters
      }
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

export function publicPileRateOptions(
  rates: HakedisRate[],
): Array<{ id: number; diameterMm: number; label: string; hasSecondary: boolean }> {
  return rates
    .filter((r) => r.is_active !== false)
    .map((r) => ({
      id: r.id,
      diameterMm: r.diameter_mm,
      label: rateLabel(r),
      hasSecondary:
        r.price_secondary != null && Number.isFinite(Number(r.price_secondary)) && Number(r.price_secondary) >= 0,
    }))
}
