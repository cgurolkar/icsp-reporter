/** 1 USD = kaç IQD (şantiye kuru). */
export type ExpenseCurrency = "IQD" | "USD"

export function normalizeIqdPerUsd(rate: number | null | undefined): number {
  const n = Number(rate)
  return n > 0 && Number.isFinite(n) ? n : 1320
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export function expenseAmountsToUsdIqd(
  amount: number,
  currency: ExpenseCurrency,
  iqdPerUsd: number
): { tutar_usd: number; tutar_iqd: number; kur_iqd_per_usd: number } {
  const kur = normalizeIqdPerUsd(iqdPerUsd)
  const a = Number(amount) || 0
  if (currency === "USD") {
    return { tutar_usd: round2(a), tutar_iqd: round2(a * kur), kur_iqd_per_usd: kur }
  }
  return { tutar_usd: round2(a / kur), tutar_iqd: round2(a), kur_iqd_per_usd: kur }
}

export function sumExpensesFx(
  expenses: Array<{ amount?: number; currency?: ExpenseCurrency }>,
  iqdPerUsd: number
): { totalUsd: number; totalIqd: number } {
  let totalUsd = 0
  let totalIqd = 0
  for (const e of expenses) {
    const { tutar_usd, tutar_iqd } = expenseAmountsToUsdIqd(
      Number(e?.amount) || 0,
      e?.currency === "USD" ? "USD" : "IQD",
      iqdPerUsd
    )
    totalUsd += tutar_usd
    totalIqd += tutar_iqd
  }
  return { totalUsd: round2(totalUsd), totalIqd: round2(totalIqd) }
}
