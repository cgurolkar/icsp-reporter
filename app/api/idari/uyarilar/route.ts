import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari } from "@/lib/auth"
import { initializeDatabase, getBelgeUyarilari } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
  if (session.role !== "admin" && session.role !== "manager" && session.siteId != null && siteId !== session.siteId) {
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
