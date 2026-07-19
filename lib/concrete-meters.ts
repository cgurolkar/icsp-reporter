import type { PileDetail } from "@/types/form-data"

/** Delinen (m) değerini sayıya çevir. */
export function parseMeters(val: unknown): number {
  const t = String(val ?? "").trim().replace(",", ".")
  if (!t) return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

/** Beton döküldü işaretli kazık satırlarındaki delinen metre toplamı. */
export function sumConcretePouredDrilledMeters(pileDetails: PileDetail[] | null | undefined): number {
  if (!Array.isArray(pileDetails)) return 0
  return pileDetails.reduce((sum, p) => {
    if (!p?.concretePoured) return sum
    return sum + parseMeters(p.drilled)
  }, 0)
}

export function formatMeters(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return n === 0 ? "0" : ""
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}
