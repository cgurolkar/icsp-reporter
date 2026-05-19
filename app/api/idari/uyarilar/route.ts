import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari, canAccessSite } from "@/lib/auth"
import { initializeDatabase, getBelgeUyarilari } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
  if (siteId != null && !Number.isNaN(siteId) && !canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }
  try {
    await initializeDatabase()
    const list = await getBelgeUyarilari({
      siteId: siteId && !Number.isNaN(siteId) ? siteId : undefined,
    })
    return NextResponse.json(list)
  } catch (error) {
    console.error("Uyarilar GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}
