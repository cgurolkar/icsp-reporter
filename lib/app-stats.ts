/**
 * Puantaj / ücret özetleri bu tarihten öncesini hesaba katmaz (eski sistem yok).
 * Ortam değişkeni: APP_STATS_SINCE_DATE=YYYY-MM-DD
 */
export function getAppStatsSinceSqlDate(): string {
  const env = process.env.APP_STATS_SINCE_DATE?.trim()
  if (env && /^\d{4}-\d{2}-\d{2}$/.test(env)) return env
  return "2026-01-01"
}
