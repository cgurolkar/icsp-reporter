/** Şantiye iş / hakediş para birimleri (gider FX'ten bağımsız). */

export const SITE_CURRENCIES = ["USD", "IQD", "EUR", "TRY"] as const

export type SiteCurrency = (typeof SITE_CURRENCIES)[number]

export function isSiteCurrency(v: unknown): v is SiteCurrency {
  return typeof v === "string" && (SITE_CURRENCIES as readonly string[]).includes(v)
}

export function normalizeSiteCurrency(v: unknown): SiteCurrency {
  const s = String(v ?? "")
    .trim()
    .toUpperCase()
  return isSiteCurrency(s) ? s : "USD"
}

export function currencyLabel(code: unknown): string {
  return normalizeSiteCurrency(code)
}

export function pricePerMeterLabel(code: unknown): string {
  return `${normalizeSiteCurrency(code)}/m`
}

export function formatMoney(amount: number, code: unknown): string {
  const c = normalizeSiteCurrency(code)
  const n = Number(amount)
  if (!Number.isFinite(n)) return `— ${c}`
  const maxFrac = c === "IQD" || c === "TRY" ? 0 : 2
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: maxFrac })} ${c}`
}
