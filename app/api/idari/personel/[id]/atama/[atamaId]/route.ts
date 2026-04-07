import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, updatePersonelAtamaById, deletePersonelAtamaById } from "@/lib/database"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; atamaId: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Atama düzenleme yetkiniz yok." }, { status: 403 })

  const personelId = parseInt((await params).id, 10)
  const atamaId = parseInt((await params).atamaId, 10)
  if (Number.isNaN(personelId) || Number.isNaN(atamaId)) {
    return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const patch: { site_id?: number; baslangic_tarihi?: string; bitis_tarihi?: string | null } = {}
    if (body.site_id != null) patch.site_id = Number(body.site_id)
    if (body.baslangic_tarihi != null) patch.baslangic_tarihi = String(body.baslangic_tarihi).trim().slice(0, 10)
    if ("bitis_tarihi" in body) {
      patch.bitis_tarihi = body.bitis_tarihi ? String(body.bitis_tarihi).trim().slice(0, 10) : null
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 })
    }
    await initializeDatabase()
    const r = await updatePersonelAtamaById(personelId, atamaId, patch)
    if (!r.ok) {
      if (r.error === "not_found") return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 })
      return NextResponse.json({ error: "Bu şantiye ve başlangıç tarihi için zaten bir atama var." }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Idari personel atama PATCH error:", error)
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; atamaId: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Atama silme yetkiniz yok." }, { status: 403 })

  const personelId = parseInt((await params).id, 10)
  const atamaId = parseInt((await params).atamaId, 10)
  if (Number.isNaN(personelId) || Number.isNaN(atamaId)) {
    return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })
  }

  try {
    await initializeDatabase()
    const ok = await deletePersonelAtamaById(personelId, atamaId)
    if (!ok) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Idari personel atama DELETE error:", error)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}
