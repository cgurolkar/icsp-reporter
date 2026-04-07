import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, updateEnvanterHareketById, deleteEnvanterHareketById } from "@/lib/database"

const PatchSchema = z.object({
  hareket_tipi: z.enum(["gelen", "giden"]).optional(),
  kaynak_yer: z.string().max(255).optional().nullable(),
  hedef_yer: z.string().max(255).optional().nullable(),
  site_id: z.union([z.number({ coerce: true }).int().positive(), z.null()]).optional(),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  adet: z.number({ coerce: true }).int().positive().optional(),
  notlar: z.string().max(500).optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; hareketId: string }> },
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 })
  }

  const envanterId = parseInt((await params).id, 10)
  const hareketId = parseInt((await params).hareketId, 10)
  if (Number.isNaN(envanterId) || Number.isNaN(hareketId)) {
    return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Geçersiz." }, { status: 400 })
  }
  const data = parsed.data
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 })
  }
  await initializeDatabase()
  try {
    const r = await updateEnvanterHareketById(envanterId, hareketId, {
      ...data,
      tarih: data.tarih != null ? data.tarih.slice(0, 10) : undefined,
    })
    if (!r.ok) {
      if (r.error === "not_found") return NextResponse.json({ error: "Hareket bulunamadı." }, { status: 404 })
      if (r.error === "no_changes") return NextResponse.json({ error: "Değişiklik yok." }, { status: 400 })
      if (r.error === "invalid_adet") return NextResponse.json({ error: "Geçersiz adet." }, { status: 400 })
      if (r.error === "negative_stock") return NextResponse.json({ error: "Adet negatif olamaz." }, { status: 400 })
      return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası."
    console.error("Envanter hareket PATCH:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; hareketId: string }> },
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 })
  }

  const envanterId = parseInt((await params).id, 10)
  const hareketId = parseInt((await params).hareketId, 10)
  if (Number.isNaN(envanterId) || Number.isNaN(hareketId)) {
    return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })
  }

  await initializeDatabase()
  try {
    const ok = await deleteEnvanterHareketById(envanterId, hareketId)
    if (!ok) return NextResponse.json({ error: "Hareket bulunamadı." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası."
    console.error("Envanter hareket DELETE:", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
