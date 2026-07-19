/**
 * GET /api/sites/[id]/machines
 * Şantiyeye atanmış aktif makineler (bilgi girişi / rapor formu).
 */
import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessSite, canDoDataEntry, canAccessIdari } from "@/lib/auth"
import { getMachinesForSite, initializeDatabase } from "@/lib/database"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canDoDataEntry(session.role, session) && !canAccessIdari(session.role, session)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }

  try {
    await initializeDatabase()
    const { id } = await params
    const siteId = parseInt(id, 10)
    if (Number.isNaN(siteId)) {
      return NextResponse.json({ error: "Geçersiz şantiye." }, { status: 400 })
    }
    if (!canAccessSite(session, siteId)) {
      return NextResponse.json({ error: "Bu şantiye için yetkiniz yok." }, { status: 403 })
    }
    const machines = await getMachinesForSite(siteId)
    return NextResponse.json(machines)
  } catch (error) {
    console.error("GET /api/sites/[id]/machines error:", error)
    return NextResponse.json({ error: "Makineler alınamadı." }, { status: 500 })
  }
}
