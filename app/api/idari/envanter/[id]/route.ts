import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getEnvanterById, updateEnvanter, deleteEnvanter, getEnvanterHareketler } from "@/lib/database"

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
    const row = await getEnvanterById(id)
    if (!row) return NextResponse.json({ error: "Envanter bulunamadı." }, { status: 404 })
    const hareketler = await getEnvanterHareketler(id)
    return NextResponse.json({ ...row, hareketler })
  } catch (error) {
    console.error("Envanter GET by id error:", error)
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
    await updateEnvanter(id, {
      kod: body.kod,
      malzeme_adi: body.malzeme_adi,
      aciklama: body.aciklama,
      adet: body.adet != null ? Number(body.adet) : undefined,
      fotograf_yolu: body.fotograf_yolu,
      fiyat: body.fiyat != null ? Number(body.fiyat) : undefined,
      yer: body.yer,
      site_id: body.site_id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Envanter PUT error:", error)
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
    const deleted = await deleteEnvanter(id)
    if (!deleted) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Envanter DELETE error:", error)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}
