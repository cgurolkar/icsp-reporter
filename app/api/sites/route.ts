import { type NextRequest, NextResponse } from "next/server"
import { getAllSites, getSitesWithReportCount, createSite, initializeDatabase } from "@/lib/database"
import { getSessionFromRequest, canAccessAdmin, canViewAllSites } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const withReportCount = searchParams.get("withReportCount") === "1"
    const includeInactive = canAccessAdmin(session.role) && searchParams.get("includeInactive") === "1"
    let siteIdParam = searchParams.get("siteId")
    // Kullanıcı/Personel sadece kendi şantiyesini görebilir
    if (!canViewAllSites(session.role, session) && session.siteId != null) {
      siteIdParam = String(session.siteId)
    }
    const siteIdNum = siteIdParam ? parseInt(siteIdParam, 10) : NaN
    const filterSiteId = Number.isInteger(siteIdNum) ? siteIdNum : undefined
    const sites = withReportCount
      ? await getSitesWithReportCount(filterSiteId, { includeInactive })
      : await getAllSites()
    // Kullanıcı/Personel: sadece kendi şantiyesi dönsün
    const allowed = canViewAllSites(session.role, session)
      ? sites
      : (Array.isArray(sites) ? sites : []).filter((s: { id: number }) => s.id === session.siteId)
    const isSuperAdmin = session.role === "super_admin"
    const sanitized = (allowed as Array<Record<string, unknown>>).map((s) => {
      if (isSuperAdmin) return s
      const { contract_unit_price, ...rest } = s
      return rest
    })
    return NextResponse.json(sanitized)
  } catch (error) {
    console.error("Error fetching sites:", error)
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session || !canAccessAdmin(session.role)) {
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
    const timezone = body.timezone != null ? String(body.timezone).trim() || null : null
    const authorizedPerson = body.authorizedPerson != null ? String(body.authorizedPerson).trim() || null : null
    const employer = body.employer != null ? String(body.employer).trim() || null : null
    const projectStartDate = body.projectStartDate != null ? String(body.projectStartDate).trim() || null : null
    const isOngoing = body.isOngoing === true
    const initialPilesDone = body.initialPilesDone != null ? (typeof body.initialPilesDone === "number" ? body.initialPilesDone : parseInt(String(body.initialPilesDone), 10) || null) : null
    const assignedMachineIds = Array.isArray(body.assignedMachineIds) ? body.assignedMachineIds.filter((x: unknown) => typeof x === "string") : []
    const assignedOperatorIds = Array.isArray(body.assignedOperatorIds) ? body.assignedOperatorIds.filter((x: unknown) => typeof x === "number" || (typeof x === "string" && /^\d+$/.test(x))).map(Number) : []
    const assignedMachineOperators = Array.isArray(body.assignedMachineOperators)
      ? body.assignedMachineOperators.filter((x: unknown) => x != null && typeof (x as any).machineId === "string" && typeof (x as any).personelId === "number")
      : []
    const contractUnitPrice =
      session.role === "super_admin" && body.contractUnitPrice != null && !Number.isNaN(Number(body.contractUnitPrice))
        ? Number(body.contractUnitPrice)
        : null
    if (!name || !code) {
      return NextResponse.json({ error: "Şantiye adı ve kod zorunludur." }, { status: 400 })
    }
    const site = await createSite({ name, code, emailList, totalPiles, region, city, country, timezone, authorizedPerson, employer, projectStartDate, isOngoing, initialPilesDone, assignedMachineIds, assignedOperatorIds, assignedMachineOperators, contractUnitPrice })
    if (session.role === "super_admin") return NextResponse.json(site)
    const { contract_unit_price, ...rest } = site as Record<string, unknown>
    return NextResponse.json(rest)
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
