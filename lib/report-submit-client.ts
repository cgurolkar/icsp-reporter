/** Rapor POST yanıtlarını ayrıştırma ve kullanıcıya gösterilecek kısa mesaj (mobil). */

export type SendReportErrorJson = {
  error?: string
  detail?: string
  ref?: string
}

export function estimateJsonPayloadBytes(payload: unknown): number {
  try {
    return new Blob([JSON.stringify(payload)]).size
  } catch {
    return 0
  }
}

export async function readResponseJsonSafe(res: Response): Promise<SendReportErrorJson | null> {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as SendReportErrorJson
  } catch {
    return { error: text.slice(0, 280) }
  }
}

export function buildReportSubmitUserMessage(
  t: (key: string) => string,
  res: Response | null,
  body: SendReportErrorJson | null,
  fetchError: unknown
): string {
  if (fetchError != null) {
    const name = fetchError instanceof Error ? fetchError.name : ""
    const msg = fetchError instanceof Error ? fetchError.message : String(fetchError)
    if (name === "TimeoutError" || msg.toLowerCase().includes("timeout")) {
      return t("report_submit_error_timeout")
    }
    if (
      msg === "Failed to fetch" ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed") ||
      msg.includes("network") ||
      name === "TypeError"
    ) {
      return t("report_submit_error_network")
    }
    return `${t("report_submit_error_network")}\n(${msg})`
  }
  if (!res) return t("error_sending_report")
  const st = res.status
  if (st === 413 || st === 431) return t("report_submit_error_too_large")
  if (st === 401) return (body?.error && body.error.trim()) || t("report_submit_error_auth")
  if (st === 403) return (body?.error && body.error.trim()) || t("report_submit_error_forbidden")
  if (st >= 502 && st <= 504) return t("report_submit_error_server_busy")
  const lines: string[] = []
  if (body?.error?.trim()) lines.push(body.error.trim())
  if (body?.detail?.trim() && body.detail !== body.error) lines.push(body.detail.trim())
  if (body?.ref) lines.push(`${t("report_submit_ref")}: ${body.ref}`)
  if (lines.length > 0) return lines.join("\n\n")
  return `${t("error_sending_report")} (HTTP ${st})`
}
