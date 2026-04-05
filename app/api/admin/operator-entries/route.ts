/**
 * GET /api/admin/operator-entries — super_admin: operatör makine girişleri listesi
 */
import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { getAdminOperatorEntriesList, initializeDatabase } from "@/lib/database"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (session.role !== "super_admin") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const siteIdRaw = searchParams.get("siteId")
    const siteId = siteIdRaw && siteIdRaw !== "" ? parseInt(siteIdRaw, 10) : null
    const limit = parseInt(searchParams.get("limit") || "200", 10)

    const entries = await getAdminOperatorEntriesList({
      startDate,
      endDate,
      siteId: siteId != null && !Number.isNaN(siteId) ? siteId : null,
      limit,
    })
    return NextResponse.json({ entries })
  } catch (e) {
    console.error("admin operator-entries:", e)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}
