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

function storedUnitPrice(p: object): number | null {
  const raw =
    (p as { unitPrice?: unknown }).unitPrice ??
    (p as { unit_price?: unknown }).unit_price ??
    (p as { hakedisUnitPrice?: unknown }).hakedisUnitPrice
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim().replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

function tierPrice(rate: HakedisRate, tier: PriceTier): number | null {
  if (tier === "secondary" && rate.price_secondary != null && Number.isFinite(Number(rate.price_secondary))) {
    return Number(rate.price_secondary)
  }
  const primary = Number(rate.price_primary)
  return Number.isFinite(primary) && primary >= 0 ? primary : null
}

/** Aynı tipte (1. / 2. fiyat) tek bir birim fiyat varsa onu döndürür. */
function uniqueTierPrice(rates: HakedisRate[], tier: PriceTier): { rate: HakedisRate; unit: number } | null {
  const active = rates.filter((r) => r.is_active !== false)
  const hits: { rate: HakedisRate; unit: number }[] = []
  for (const rate of active) {
    if (tier === "secondary" && (rate.price_secondary == null || !Number.isFinite(Number(rate.price_secondary)))) continue
    const unit = tierPrice(rate, tier)
    if (unit == null) continue
    hits.push({ rate, unit })
  }
  const prices = [...new Set(hits.map((h) => h.unit))]
  if (prices.length !== 1 || hits.length === 0) return null
  return hits[0]
}

function resolvePileRate(
  rates: HakedisRate[],
  rateId: string,
  hints: { diameterMm?: number | null; label?: string | null; notes?: string | null },
): HakedisRate | undefined {
  const active = rates.filter((r) => r.is_active !== false)
  const pool = active.length > 0 ? active : rates
  if (rateId) {
    const byId = pool.find((r) => String(r.id) === rateId) ?? rates.find((r) => String(r.id) === rateId)
    if (byId) return byId
    const asMm = Number(rateId)
    if (Number.isFinite(asMm)) {
      const byMm = pool.filter((r) => r.diameter_mm === asMm)
      if (byMm.length === 1) return byMm[0]
    }
  }
  const textHints = [hints.label, hints.notes]
    .map((v) => String(v ?? "").trim().toLocaleLowerCase("tr-TR"))
    .filter(Boolean)
  if (textHints.length > 0) {
    const byLabel = pool.filter((r) => textHints.includes(rateLabel(r).trim().toLocaleLowerCase("tr-TR")))
    if (byLabel.length === 1) return byLabel[0]
  }
  if (hints.diameterMm != null && Number.isFinite(hints.diameterMm)) {
    const byMm = pool.filter((r) => r.diameter_mm === hints.diameterMm)
    if (byMm.length === 1) return byMm[0]
  }
  return undefined
}

/**
 * Tarife seçilmemiş eski raporlar — bugünkü çoklu tarife öncesi hesap:
 * sözleşme birim fiyatı, yoksa ilk tarifenin fiyatı.
 */
function legacyUnassignedPrice(
  rates: HakedisRate[],
  fallbackUnitPrice: number | null,
  tier: PriceTier = "primary",
): { unit: number; label: string; priceTier: string; diameterMm: number | null } | null {
  if (fallbackUnitPrice != null && Number.isFinite(fallbackUnitPrice) && fallbackUnitPrice > 0) {
    const active = rates.filter((r) => r.is_active !== false)
    const samePrimary = active.filter((r) => tierPrice(r, "primary") === fallbackUnitPrice)
    if (samePrimary.length === 1) {
      const rate = samePrimary[0]
      return { unit: fallbackUnitPrice, label: rateLabel(rate), priceTier: "primary", diameterMm: rate.diameter_mm }
    }
    return { unit: fallbackUnitPrice, label: "Tek fiyat", priceTier: "default", diameterMm: null }
  }
  const picked = rates.filter((r) => r.is_active !== false)[0]
  if (!picked) return null
  const secondary = tier === "secondary" ? tierPrice(picked, "secondary") : null
  if (secondary != null && secondary > 0) {
    return { unit: secondary, label: rateLabel(picked), priceTier: "secondary", diameterMm: picked.diameter_mm }
  }
  const unit = tierPrice(picked, "primary")
  if (unit == null || unit <= 0) return null
  return { unit, label: rateLabel(picked), priceTier: "primary", diameterMm: picked.diameter_mm }
}

function mergeLines(into: Map<string, HakedisLine>, line: HakedisLine) {
  const key = `${line.label}|${line.diameterMm ?? "x"}|${line.priceTier}|${line.unitPrice}`
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
    const diameterHint = Number(
      (p as { diameterMm?: unknown }).diameterMm ?? (p as { diameter_mm?: unknown }).diameter_mm,
    )
    const labelHint =
      (p as { rateLabel?: unknown }).rateLabel ??
      (p as { rate_label?: unknown }).rate_label ??
      (p as { diameterLabel?: unknown }).diameterLabel
    let rate = resolvePileRate(rates, rateId, {
      diameterMm: Number.isFinite(diameterHint) ? diameterHint : null,
      label: labelHint != null ? String(labelHint) : null,
      notes: (p as { notes?: unknown }).notes != null ? String((p as { notes?: unknown }).notes) : null,
    })
    if (!rate && isSingleTariffSite(rates) && activeRates[0]) {
      rate = activeRates[0]
    }
    const tierRaw =
      (p as { priceTier?: unknown }).priceTier ?? (p as { price_tier?: unknown }).price_tier
    const tierExplicit = tierRaw === "secondary" || tierRaw === "primary"
    const tier = (tierRaw === "secondary" ? "secondary" : "primary") as PriceTier
    const multiTariff = !isSingleTariffSite(rates)
    const snapshot = storedUnitPrice(p)
    let unit = snapshot
    if (unit == null) unit = unitPriceFor(rate, tier, multiTariff ? null : fallbackUnitPrice)
    if (unit == null && rate) unit = tierPrice(rate, tier)
    if (unit == null && tierExplicit) {
      const unique = uniqueTierPrice(rates, tier)
      if (unique) {
        unit = unique.unit
        if (!rate) rate = unique.rate
      }
    }
    if (unit == null && !multiTariff && activeRates[0]) {
      unit = tierPrice(activeRates[0], "primary")
      if (unit != null && !rate) rate = activeRates[0]
    }
    if (unit == null) {
      const legacy = legacyUnassignedPrice(rates, fallbackUnitPrice, tierExplicit ? tier : "primary")
      if (legacy) {
        fromRows += meters
        mergeLines(lineMap, {
          diameterMm: legacy.diameterMm,
          label: legacy.label,
          priceTier: legacy.priceTier,
          unitPrice: legacy.unit,
          meters,
          amount: meters * legacy.unit,
        })
      }
      continue
    }
    fromRows += meters
    mergeLines(lineMap, {
      diameterMm: rate?.diameter_mm ?? (Number.isFinite(diameterHint) ? diameterHint : null),
      label: rate ? rateLabel(rate) : tierExplicit ? (tier === "secondary" ? "2. fiyat" : "1. fiyat") : "Tek fiyat",
      priceTier: rate || tierExplicit ? tier : "default",
      unitPrice: unit,
      meters,
      amount: meters * unit,
    })
  }

  // Satırlardan metraj çıkmadıysa rapor toplam boyu × birim fiyat (eski raporlar / tarife sonrası)
  if (fromRows <= 0) {
    const meters = parseMeters(concreteTotalLengthFallback)
    if (meters > 0) {
      const selectedTiers = new Set<PriceTier>()
      for (const p of piles) {
        const t = (p as { priceTier?: unknown }).priceTier ?? (p as { price_tier?: unknown }).price_tier
        if (t === "primary" || t === "secondary") selectedTiers.add(t)
      }
      const onlyTier = selectedTiers.size === 1 ? [...selectedTiers][0] : null
      const unique = onlyTier ? uniqueTierPrice(rates, onlyTier) : null
      if (unique && onlyTier) {
        mergeLines(lineMap, {
          diameterMm: unique.rate.diameter_mm,
          label: rateLabel(unique.rate),
          priceTier: onlyTier,
          unitPrice: unique.unit,
          meters,
          amount: meters * unique.unit,
        })
        fromRows = meters
      } else if (!isSingleTariffSite(rates) && rates.filter((r) => r.is_active !== false).length > 1) {
        const legacy = legacyUnassignedPrice(rates, fallbackUnitPrice)
        if (legacy) {
          mergeLines(lineMap, {
            diameterMm: legacy.diameterMm,
            label: legacy.label,
            priceTier: legacy.priceTier,
            unitPrice: legacy.unit,
            meters,
            amount: meters * legacy.unit,
          })
          fromRows = meters
        }
      } else {
        const active = rates.filter((r) => r.is_active !== false)
        const rate = isSingleTariffSite(rates) ? active[0] : undefined
        let unit = unitPriceFor(rate, "primary", fallbackUnitPrice)
        if (unit == null && active[0]) unit = tierPrice(active[0], "primary")
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
  }

  const selectedTiers = new Set<PriceTier>()
  for (const p of piles) {
    const t = (p as { priceTier?: unknown }).priceTier ?? (p as { price_tier?: unknown }).price_tier
    if (t === "primary" || t === "secondary") selectedTiers.add(t)
  }
  if (selectedTiers.size === 1) {
    const tier = [...selectedTiers][0]
    const unique = uniqueTierPrice(rates, tier)
    const unassigned = [...lineMap.entries()].filter(([, line]) => line.priceTier === "unassigned" && line.meters > 0)
    if (unique && unassigned.length > 0) {
      let moved = 0
      for (const [key] of unassigned) {
        moved += lineMap.get(key)?.meters ?? 0
        lineMap.delete(key)
      }
      if (moved > 0) {
        mergeLines(lineMap, {
          diameterMm: unique.rate.diameter_mm,
          label: rateLabel(unique.rate),
          priceTier: tier,
          unitPrice: unique.unit,
          meters: moved,
          amount: moved * unique.unit,
        })
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

  const activeRates = rates.filter((r) => r.is_active !== false)
  if (activeRates.length > 1) {
    for (const rate of activeRates) {
      const hasPrimary = [...lineMap.values()].some(
        (l) => l.priceTier === "primary" && l.unitPrice === (Number(rate.price_primary) || 0) && l.label === rateLabel(rate),
      )
      if (!hasPrimary) {
        mergeLines(lineMap, {
          diameterMm: rate.diameter_mm,
          label: rateLabel(rate),
          priceTier: "primary",
          unitPrice: Number(rate.price_primary) || 0,
          meters: 0,
          amount: 0,
        })
      }
      const secondary = rate.price_secondary
      if (secondary != null && Number.isFinite(Number(secondary))) {
        const hasSecondary = [...lineMap.values()].some(
          (l) => l.priceTier === "secondary" && l.unitPrice === Number(secondary) && l.label === rateLabel(rate),
        )
        if (!hasSecondary) {
          mergeLines(lineMap, {
            diameterMm: rate.diameter_mm,
            label: rateLabel(rate),
            priceTier: "secondary",
            unitPrice: Number(secondary),
            meters: 0,
            amount: 0,
          })
        }
      }
    }
  }

  const lines = [...lineMap.values()].sort((a, b) => {
    if (a.priceTier === "unassigned") return 1
    if (b.priceTier === "unassigned") return -1
    return (a.diameterMm ?? 0) - (b.diameterMm ?? 0) || a.priceTier.localeCompare(b.priceTier)
  })
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
