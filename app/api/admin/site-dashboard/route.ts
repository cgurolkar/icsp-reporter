import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canViewReports, canViewAllSites, canAccessSite, getAllowedSiteIds } from "@/lib/auth"
import { getAdminDashboardSiteSummaries, initializeDatabase } from "@/lib/database"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canViewReports(session.role)) return NextResponse.json({ error: "Bu veriyi görüntüleme yetkiniz yok." }, { status: 403 })

  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    let siteId: number | null = searchParams.get("siteId") ? parseInt(searchParams.get("siteId")!, 10) : null
    if (!canViewAllSites(session.role, session)) {
      const allowed = getAllowedSiteIds(session)
      if (allowed == null || allowed.length === 0) {
        return NextResponse.json({ error: "Şantiye atanmamış." }, { status: 403 })
      }
      if (siteId != null && !Number.isNaN(siteId)) {
        if (!canAccessSite(session, siteId)) {
          return NextResponse.json({ error: "Bu şantiye için yetkiniz yok." }, { status: 403 })
        }
      } else {
        siteId = allowed[0]
      }
    } else if (siteId != null && Number.isNaN(siteId)) {
      siteId = null
    }
    const reportDate = searchParams.get("reportDate")?.slice(0, 10) || undefined

    const data = await getAdminDashboardSiteSummaries({
      siteId,
      reportDate,
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error("GET /api/admin/site-dashboard:", e)
    return NextResponse.json({ error: "Veri alınamadı." }, { status: 500 })
  }
}
