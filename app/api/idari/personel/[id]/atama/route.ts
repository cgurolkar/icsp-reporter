import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getPersonelAtamalar, addPersonelAtama } from "@/lib/database"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const personelId = parseInt((await params).id, 10)
  if (Number.isNaN(personelId)) return NextResponse.json({ error: "Geçersiz personel ID." }, { status: 400 })

  try {
    await initializeDatabase()
    const list = await getPersonelAtamalar(personelId)
    return NextResponse.json(list)
  } catch (error) {
    console.error("Idari personel atama GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Atama ekleme yetkiniz yok." }, { status: 403 })

  const personelId = parseInt((await params).id, 10)
  if (Number.isNaN(personelId)) return NextResponse.json({ error: "Geçersiz personel ID." }, { status: 400 })

  try {
    const body = await request.json()
    const site_id = body?.site_id != null ? Number(body.site_id) : NaN
    const baslangic_tarihi = String(body?.baslangic_tarihi ?? "").trim().slice(0, 10)
    if (!site_id || !baslangic_tarihi) return NextResponse.json({ error: "site_id ve baslangic_tarihi gerekli." }, { status: 400 })

    await initializeDatabase()
    const id = await addPersonelAtama({
      personel_id: personelId,
      site_id,
      baslangic_tarihi,
      bitis_tarihi: body.bitis_tarihi ? String(body.bitis_tarihi).slice(0, 10) : null,
    })
    return NextResponse.json({ id })
  } catch (error) {
    console.error("Idari personel atama POST error:", error)
    return NextResponse.json({ error: "Atama eklenemedi." }, { status: 500 })
  }
}
