/**
 * GET /api/admin/hakedis-piles-export?date=YYYY-MM-DD
 * Seçilen güne kadar raporlardaki betonlu kazıkları fiyatlarıyla Excel indirir.
 */
import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { initializeDatabase, listHakedisPileExport } from "@/lib/database"
import { buildKazikHakedisWorkbook } from "@/lib/kazik-hakedis-excel"

export const dynamic = "force-dynamic"

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (session.role !== "super_admin") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()
    const rawDate = (request.nextUrl.searchParams.get("date") || "").trim().slice(0, 10)
    const asOfDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayIsoDate()
    const rows = await listHakedisPileExport(asOfDate)
    const body = buildKazikHakedisWorkbook(rows, asOfDate)
    const filename = `kaziklar_${asOfDate}.xlsx`
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (e) {
    console.error("GET /api/admin/hakedis-piles-export:", e)
    return NextResponse.json({ error: "Kazık listesi dışa aktarılamadı." }, { status: 500 })
  }
}
