import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getEnvanter, createEnvanter } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const siteIdParam = searchParams.get("siteId")
    const yer = searchParams.get("yer")?.trim() || undefined
    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
    const list = await getEnvanter({
      siteId: siteId && !Number.isNaN(siteId) ? siteId : undefined,
      yer,
    })
    return NextResponse.json(list)
  } catch (error) {
    console.error("Envanter GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Envanter ekleme yetkiniz yok." }, { status: 403 })
  try {
    const body = await request.json()
    const kod = String(body?.kod ?? "").trim()
    const malzeme_adi = String(body?.malzeme_adi ?? "").trim()
    if (!kod || !malzeme_adi) return NextResponse.json({ error: "Kod ve malzeme adı gerekli." }, { status: 400 })
    await initializeDatabase()
    const id = await createEnvanter({
      kod,
      malzeme_adi,
      aciklama: body.aciklama ?? null,
      adet: body.adet != null ? Number(body.adet) : 1,
      fotograf_yolu: body.fotograf_yolu ?? null,
      fiyat: body.fiyat != null ? Number(body.fiyat) : null,
      yer: body.yer ?? null,
      site_id: body.site_id ?? null,
    })
    return NextResponse.json({ id })
  } catch (error) {
    console.error("Envanter POST error:", error)
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 })
  }
}
