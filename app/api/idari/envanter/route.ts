import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari, canManageIdariCentral, canWriteIdariModule, canAccessSite, getAllowedSiteIds } from "@/lib/auth"
import { initializeDatabase, getEnvanter, getEnvanterCount, createEnvanter } from "@/lib/database"

const ENVANTER_SORT_KEYS = new Set([
  "malzeme_adi",
  "kod",
  "adet",
  "yer",
  "durum",
  "fiyat",
  "site_name",
])

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const siteIdParam = searchParams.get("siteId")
    const yer = searchParams.get("yer")?.trim() || undefined
    const search = searchParams.get("search")?.trim() || undefined
    const limitParam = searchParams.get("limit")
    const offsetParam = searchParams.get("offset")
    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
    const limit = limitParam ? parseInt(limitParam, 10) : undefined
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined

    const sortByRaw = searchParams.get("sortBy")?.trim() ?? ""
    const sortBy = ENVANTER_SORT_KEYS.has(sortByRaw) ? sortByRaw : undefined
    const sortDirRaw = searchParams.get("sortDir")?.toLowerCase()
    const sortDir = sortDirRaw === "desc" || sortDirRaw === "asc" ? (sortDirRaw as "asc" | "desc") : undefined

    const restrictedToOwnSite = !canManageIdariCentral(session.role)
    const allowed = getAllowedSiteIds(session)
    if (restrictedToOwnSite && (allowed == null || allowed.length === 0)) {
      return NextResponse.json({ error: "Size atanmış şantiye yok." }, { status: 403 })
    }
    let effectiveSiteId: number | undefined
    if (restrictedToOwnSite) {
      if (siteId && !Number.isNaN(siteId)) {
        if (!canAccessSite(session, siteId)) {
          return NextResponse.json({ error: "Bu şantiye için yetkiniz yok." }, { status: 403 })
        }
        effectiveSiteId = siteId
      } else {
        effectiveSiteId = allowed!.length === 1 ? allowed![0] : undefined
      }
    } else {
      effectiveSiteId = siteId && !Number.isNaN(siteId) ? siteId : undefined
    }
    const opts = {
      siteId: effectiveSiteId,
      yer,
      search,
      limit: limit && !Number.isNaN(limit) ? limit : undefined,
      offset: offset && !Number.isNaN(offset) ? offset : undefined,
      sortBy: sortBy ?? null,
      sortDir: sortDir ?? null,
    }
    const [list, total] = await Promise.all([getEnvanter(opts), getEnvanterCount(opts)])
    return NextResponse.json({ data: list, total, limit: opts.limit, offset: opts.offset ?? 0 })
  } catch (error) {
    console.error("Envanter GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canWriteIdariModule(session, "envanter")) return NextResponse.json({ error: "Envanter ekleme yetkiniz yok." }, { status: 403 })
  try {
    const body = await request.json()
    const kod = String(body?.kod ?? "").trim()
    const malzeme_adi = String(body?.malzeme_adi ?? "").trim()
    if (!kod || !malzeme_adi) return NextResponse.json({ error: "Kod ve malzeme adı gerekli." }, { status: 400 })
    await initializeDatabase()
    const restrictedToOwnSite = !canManageIdariCentral(session.role)
    if (restrictedToOwnSite) {
      const allowedPost = getAllowedSiteIds(session)
      if (allowedPost == null || allowedPost.length === 0) {
        return NextResponse.json({ error: "Size atanmış şantiye yok." }, { status: 403 })
      }
    }
    const requestedSiteId = body.site_id != null ? Number(body.site_id) : null
    if (restrictedToOwnSite && requestedSiteId != null && !canAccessSite(session, requestedSiteId)) {
      return NextResponse.json({ error: "Sadece atanmış olduğunuz şantiye için kayıt yapabilirsiniz." }, { status: 403 })
    }
    const defaultSiteId = getAllowedSiteIds(session)?.[0] ?? null
    const id = await createEnvanter({
      kod,
      malzeme_adi,
      aciklama: body.aciklama ?? null,
      adet: body.adet != null ? Number(body.adet) : 1,
      fotograf_yolu: body.fotograf_yolu ?? null,
      fiyat: body.fiyat != null ? Number(body.fiyat) : null,
      yer: body.yer ?? null,
      site_id: restrictedToOwnSite
        ? (requestedSiteId != null && canAccessSite(session, requestedSiteId) ? requestedSiteId : defaultSiteId)
        : (body.site_id ?? null),
      durum: body.durum ?? 'aktif',
    })
    return NextResponse.json({ id })
  } catch (error) {
    console.error("Envanter POST error:", error)
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 })
  }
}
