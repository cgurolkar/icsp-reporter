import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari, canAccessSite } from "@/lib/auth"
import { initializeDatabase, getIsGucuRaporu } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const baslangic = searchParams.get("baslangic")?.trim().slice(0, 10)
  const bitis = searchParams.get("bitis")?.trim().slice(0, 10)
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : NaN
  if (!siteId || !baslangic || !bitis) return NextResponse.json({ error: "siteId, baslangic ve bitis gerekli." }, { status: 400 })
  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }
  try {
    await initializeDatabase()
    const list = await getIsGucuRaporu(siteId, baslangic, bitis)
    return NextResponse.json(list)
  } catch (error) {
    console.error("Is gucu raporu GET error:", error)
    return NextResponse.json({ error: "Rapor alınamadı." }, { status: 500 })
  }
}
