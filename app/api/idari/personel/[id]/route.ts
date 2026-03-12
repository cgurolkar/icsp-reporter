import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getPersonelById, updatePersonel, deletePersonel } from "@/lib/database"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const id = parseInt((await params).id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })

  try {
    await initializeDatabase()
    const row = await getPersonelById(id)
    if (!row) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 })
    return NextResponse.json(row)
  } catch (error) {
    console.error("Idari personel GET by id error:", error)
    return NextResponse.json({ error: "Kayıt alınamadı." }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Düzenleme yetkiniz yok." }, { status: 403 })

  const id = parseInt((await params).id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })

  try {
    const body = await request.json()
    await initializeDatabase()
    await updatePersonel(id, {
      ad: body.ad,
      soyad: body.soyad,
      tc_kimlik: body.tc_kimlik,
      dogum_tarihi: body.dogum_tarihi,
      kan_grubu: body.kan_grubu,
      acil_iletisim: body.acil_iletisim,
      acil_telefon: body.acil_telefon,
      gorev: body.gorev,
      ise_giris_tarihi: body.ise_giris_tarihi,
      sigorta_durumu: body.sigorta_durumu,
      iban: body.iban,
      banka_adi: body.banka_adi,
      gunluk_yevmiye: body.gunluk_yevmiye != null ? Number(body.gunluk_yevmiye) : undefined,
      aylik_maas: body.aylik_maas != null ? Number(body.aylik_maas) : undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Idari personel PUT error:", error)
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Silme yetkiniz yok." }, { status: 403 })

  const id = parseInt((await params).id, 10)
  if (Number.isNaN(id)) return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })

  try {
    await initializeDatabase()
    const deleted = await deletePersonel(id)
    if (!deleted) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Idari personel DELETE error:", error)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}
