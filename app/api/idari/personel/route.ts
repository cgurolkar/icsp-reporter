import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getPersoneller, getPersonellerCount, createPersonel } from "@/lib/database"

const PersonelSchema = z.object({
  ad: z.string().min(1).max(100).trim(),
  soyad: z.string().min(1).max(100).trim(),
  tc_kimlik: z.string().max(20).optional().nullable(),
  pasaport_no: z.string().max(50).optional().nullable(),
  dogum_tarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable(),
  kan_grubu: z.string().max(10).optional().nullable(),
  acil_iletisim: z.string().max(255).optional().nullable(),
  acil_telefon: z.string().max(50).optional().nullable(),
  gorev: z.string().max(100).default("İşçi"),
  ise_giris_tarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable(),
  isten_cikis_tarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable(),
  calistigi_bolum: z.string().max(100).optional().nullable(),
  sigorta_durumu: z.string().max(50).optional().nullable(),
  iban: z.string().max(34).optional().nullable(),
  banka_adi: z.string().max(255).optional().nullable(),
  gunluk_yevmiye: z.number({ coerce: true }).nonnegative().optional().nullable(),
  aylik_maas: z.number({ coerce: true }).nonnegative().optional().nullable(),
  foto_yolu: z.string().max(500).optional().nullable(),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const siteIdParam = searchParams.get("siteId")
    const gorev = searchParams.get("gorev")?.trim() || undefined
    const search = searchParams.get("search")?.trim() || undefined
    const limitParam = searchParams.get("limit")
    const offsetParam = searchParams.get("offset")
    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
    const limit = limitParam ? parseInt(limitParam, 10) : undefined
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined

    const opts = {
      siteId: siteId && !Number.isNaN(siteId) ? siteId : undefined,
      gorev,
      search,
      limit: limit && !Number.isNaN(limit) ? limit : undefined,
      offset: offset && !Number.isNaN(offset) ? offset : undefined,
    }
    const [list, total] = await Promise.all([getPersoneller(opts), getPersonellerCount(opts)])
    return NextResponse.json({ data: list, total, limit: opts.limit, offset: opts.offset ?? 0 })
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
    const rawBody = await request.json().catch(() => ({}))
    const parsed = PersonelSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri.", details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data
    await initializeDatabase()
    const id = await createPersonel({
      ad: data.ad,
      soyad: data.soyad,
      tc_kimlik: data.tc_kimlik ?? null,
      pasaport_no: data.pasaport_no ?? null,
      dogum_tarihi: data.dogum_tarihi ?? null,
      kan_grubu: data.kan_grubu ?? null,
      acil_iletisim: data.acil_iletisim ?? null,
      acil_telefon: data.acil_telefon ?? null,
      gorev: data.gorev,
      ise_giris_tarihi: data.ise_giris_tarihi ?? null,
      isten_cikis_tarihi: data.isten_cikis_tarihi ?? null,
      calistigi_bolum: data.calistigi_bolum ?? null,
      sigorta_durumu: data.sigorta_durumu ?? null,
      iban: data.iban ?? null,
      banka_adi: data.banka_adi ?? null,
      gunluk_yevmiye: data.gunluk_yevmiye ?? null,
      aylik_maas: data.aylik_maas ?? null,
      foto_yolu: data.foto_yolu ?? null,
    })
    return NextResponse.json({ id })
  } catch (error) {
    console.error("Idari personel POST error:", error)
    return NextResponse.json({ error: "Kayıt oluşturulamadı." }, { status: 500 })
  }
}
