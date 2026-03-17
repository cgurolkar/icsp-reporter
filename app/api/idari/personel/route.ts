import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getPersoneller, createPersonel } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const siteIdParam = searchParams.get("siteId")
    const gorev = searchParams.get("gorev")?.trim() || undefined
    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
    const list = await getPersoneller({
      siteId: siteId && !Number.isNaN(siteId) ? siteId : undefined,
      gorev,
    })
    return NextResponse.json(list)
  } catch (error) {
    console.error("Idari personel GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Personel ekleme yetkiniz yok." }, { status: 403 })

  try {
    const body = await request.json()
    const ad = String(body?.ad ?? "").trim()
    const soyad = String(body?.soyad ?? "").trim()
    if (!ad || !soyad) return NextResponse.json({ error: "Ad ve soyad gerekli." }, { status: 400 })

    await initializeDatabase()
    const id = await createPersonel({
      ad,
      soyad,
      tc_kimlik: body.tc_kimlik ?? null,
      pasaport_no: body.pasaport_no ?? null,
      dogum_tarihi: body.dogum_tarihi ?? null,
      kan_grubu: body.kan_grubu ?? null,
      acil_iletisim: body.acil_iletisim ?? null,
      acil_telefon: body.acil_telefon ?? null,
      gorev: String(body.gorev ?? "İşçi").trim(),
      ise_giris_tarihi: body.ise_giris_tarihi ?? null,
      isten_cikis_tarihi: body.isten_cikis_tarihi ?? null,
      calistigi_bolum: body.calistigi_bolum ?? null,
      sigorta_durumu: body.sigorta_durumu ?? null,
      iban: body.iban ?? null,
      banka_adi: body.banka_adi ?? null,
      gunluk_yevmiye: body.gunluk_yevmiye != null ? Number(body.gunluk_yevmiye) : null,
      aylik_maas: body.aylik_maas != null ? Number(body.aylik_maas) : null,
      foto_yolu: body.foto_yolu ?? null,
    })
    return NextResponse.json({ id })
  } catch (error) {
    console.error("Idari personel POST error:", error)
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 })
  }
}
