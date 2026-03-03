import { type NextRequest, NextResponse } from "next/server"
import { getAllSites, getSitesWithReportCount, createSite, initializeDatabase } from "@/lib/database"
import { getSessionFromRequest, canViewAllSites } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const withReportCount = searchParams.get("withReportCount") === "1"
    let siteIdParam = searchParams.get("siteId")
    // Kullanıcı/Personel sadece kendi şantiyesini görebilir
    if (!canViewAllSites(session.role) && session.siteId != null) {
      siteIdParam = String(session.siteId)
    }
    const siteIdNum = siteIdParam ? parseInt(siteIdParam, 10) : NaN
    const filterSiteId = Number.isInteger(siteIdNum) ? siteIdNum : undefined
    const sites = withReportCount
      ? await getSitesWithReportCount(filterSiteId)
      : await getAllSites()
    // Kullanıcı/Personel: sadece kendi şantiyesi dönsün
    const allowed = canViewAllSites(session.role)
      ? sites
      : (Array.isArray(sites) ? sites : []).filter((s: { id: number }) => s.id === session.siteId)
    return NextResponse.json(allowed)
  } catch (error) {
    console.error("Error fetching sites:", error)
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }
  try {
    await initializeDatabase()
    const body = await request.json().catch(() => ({}))
    const name = body.name != null ? String(body.name).trim() : ""
    const code = body.code != null ? String(body.code).trim().toUpperCase().replace(/\s/g, "") : ""
    const emailList = Array.isArray(body.emailList) ? body.emailList : []
    const totalPiles = body.totalPiles != null ? (typeof body.totalPiles === "number" ? body.totalPiles : parseInt(String(body.totalPiles), 10) || null) : null
    const region = body.region != null ? String(body.region).trim() || null : null
    const city = body.city != null ? String(body.city).trim() || null : null
    const country = body.country != null ? String(body.country).trim() || null : null
    const authorizedPerson = body.authorizedPerson != null ? String(body.authorizedPerson).trim() || null : null
    const employer = body.employer != null ? String(body.employer).trim() || null : null
    const projectStartDate = body.projectStartDate != null ? String(body.projectStartDate).trim() || null : null
    const isOngoing = body.isOngoing === true
    const initialPilesDone = body.initialPilesDone != null ? (typeof body.initialPilesDone === "number" ? body.initialPilesDone : parseInt(String(body.initialPilesDone), 10) || null) : null
    if (!name || !code) {
      return NextResponse.json({ error: "Şantiye adı ve kod zorunludur." }, { status: 400 })
    }
    const site = await createSite({ name, code, emailList, totalPiles, region, city, country, authorizedPerson, employer, projectStartDate, isOngoing, initialPilesDone })
    return NextResponse.json(site)
  } catch (error: unknown) {
    console.error("Error creating site:", error)
    const msg =
      error && typeof (error as any)?.code === "string" && (error as any).code === "23505"
        ? "Bu kod zaten kullanılıyor. Farklı bir kod girin."
        : error instanceof Error
          ? error.message
          : "Veritabanı hatası. PostgreSQL çalışıyor mu? .env.local doğru mu?"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
