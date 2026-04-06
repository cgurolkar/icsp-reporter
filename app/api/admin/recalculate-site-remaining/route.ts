import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessAdmin } from "@/lib/auth"
import { initializeDatabase, recalculateRemainingPilesForSite } from "@/lib/database"

/**
 * POST /api/admin/recalculate-site-remaining
 * Body: { siteId: number }
 * Şantiye ayarı (devam eden proje + rapor öncesi kazık + toplam kazık) sonrası kalan kazık zincirini günceller.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const siteId = typeof body.siteId === "number" ? body.siteId : parseInt(String(body.siteId), 10)
    if (!siteId || Number.isNaN(siteId)) {
      return NextResponse.json({ error: "Geçerli siteId gerekli." }, { status: 400 })
    }
    await initializeDatabase()
    const result = await recalculateRemainingPilesForSite(siteId)
    if (result.skippedReason === "SITE_NOT_FOUND") {
      return NextResponse.json({ error: "Şantiye bulunamadı." }, { status: 404 })
    }
    if (result.skippedReason === "NO_TOTAL_PILES") {
      return NextResponse.json(
        {
          error: "Bu şantiyede proje toplam kazık sayısı tanımlı değil; kalan kazık yeniden hesaplanamadı.",
          updatedCount: 0,
          rows: [],
        },
        { status: 400 }
      )
    }
    return NextResponse.json({
      success: true,
      updatedCount: result.updatedCount,
      rows: result.rows,
    })
  } catch (err) {
    console.error("POST /api/admin/recalculate-site-remaining:", err)
    return NextResponse.json({ error: "Hesaplama başarısız." }, { status: 500 })
  }
}
