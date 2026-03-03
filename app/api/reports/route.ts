import { type NextRequest, NextResponse } from "next/server"
import { getAggregatedStats, getWorkReportsFiltered, initializeDatabase } from "@/lib/database"
import { getSessionFromRequest, canViewReports } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  if (!canViewReports(session.role)) {
    return NextResponse.json({ error: "Bu sayfayı görüntüleme yetkiniz yok." }, { status: 403 })
  }
  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    let siteIdParam = searchParams.get("siteId")
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const raw = searchParams.get("raw") === "1"

    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
    const options = { siteId: siteId ?? null, startDate, endDate }

    if (raw) {
      const limitParam = searchParams.get("limit")
      const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : undefined
      const rows = await getWorkReportsFiltered(options)
      const reversed = [...rows].reverse()
      const list = limit ? reversed.slice(0, limit) : reversed
      // Tarihi YYYY-MM-DD string olarak döndür (takvimde doğru gün görünsün, timezone kayması olmasın)
      const normalizeDate = (d: string | Date | unknown): string => {
        if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
        if (d instanceof Date) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
        return String(d).slice(0, 10)
      }
      const normalized = list.map((r: { date?: string | Date; [k: string]: unknown }) => {
        const row = { ...r, date: normalizeDate(r.date) }
        // Eski raporlarda daily_pile_count boş olabilir; beton dökülen varsa gösterim için doldur
        const daily = row.daily_pile_count
        const concrete = row.concrete_poured
        if ((daily == null || String(daily).trim() === "") && concrete != null && String(concrete).trim() !== "") {
          row.daily_pile_count = concrete
        }
        return row
      })
      return NextResponse.json(normalized)
    }

    const stats = await getAggregatedStats(options)
    return NextResponse.json(stats)
  } catch (error) {
    console.error("Error fetching reports:", error)
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })
  }
}
