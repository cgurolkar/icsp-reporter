import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari } from "@/lib/auth"
import { initializeDatabase, getButceRaporu } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : NaN
  if (!siteId) return NextResponse.json({ error: "siteId gerekli." }, { status: 400 })
  if (session.role !== "admin" && session.role !== "manager" && session.siteId !== siteId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }
  const baslangic = searchParams.get("baslangic")?.trim().slice(0, 10)
  const bitis = searchParams.get("bitis")?.trim().slice(0, 10)
  try {
    await initializeDatabase()
    const data = await getButceRaporu(siteId, baslangic, bitis)
    return NextResponse.json(data ?? {})
  } catch (error) {
    console.error("Butce raporu GET error:", error)
    return NextResponse.json({ error: "Rapor alınamadı." }, { status: 500 })
  }
}
