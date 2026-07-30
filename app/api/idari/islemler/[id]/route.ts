import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canManageIdariCentral, canAccessSite } from "@/lib/auth"
import {
  initializeDatabase,
  getIslemById,
  updateIslem,
  deleteIslem,
  resolveKategoriIdForAltKalem,
} from "@/lib/database"

const PatchSchema = z.object({
  siteId: z.number({ coerce: true }).int().positive().optional(),
  altKalemId: z.number({ coerce: true }).int().positive().optional().nullable(),
  masrafYeriId: z.number({ coerce: true }).int().positive().optional().nullable(),
  tutar: z.number({ coerce: true }).positive().optional(),
  islem_tarihi: z.string().optional().nullable(),
  odeme_kaynagi: z.enum(["Merkez_Banka", "Santiye_Kasa", "rapor"]).optional(),
  aciklama: z.string().max(500).optional().nullable(),
  fisFaturaNo: z.string().max(100).optional().nullable(),
  para_birimi: z.enum(["IQD", "USD"]).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (!id || Number.isNaN(id)) return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })

  try {
    await initializeDatabase()
    const existing = await getIslemById(id)
    if (!existing) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 })
    if (!canAccessSite(session, existing.site_id)) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    }

    const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri.", details: parsed.error.flatten() }, { status: 400 })
    }
    const body = parsed.data
    if (body.siteId != null && !canAccessSite(session, body.siteId)) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    }

    let islemTarihi = body.islem_tarihi ? String(body.islem_tarihi).slice(0, 10) : undefined
    if (islemTarihi && !/^\d{4}-\d{2}-\d{2}$/.test(islemTarihi)) {
      return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 })
    }

    let kategori_id: number | undefined
    if (body.altKalemId !== undefined) {
      const resolved = await resolveKategoriIdForAltKalem(body.altKalemId, existing.kategori_id)
      if (!resolved) return NextResponse.json({ error: "Kategori çözümlenemedi." }, { status: 400 })
      kategori_id = resolved
    }

    const updated = await updateIslem(id, {
      site_id: body.siteId,
      kategori_id,
      tutar: body.tutar,
      islem_tarihi: islemTarihi,
      odeme_kaynagi: body.odeme_kaynagi,
      aciklama: body.aciklama,
      para_birimi: body.para_birimi,
      alt_kalem_id: body.altKalemId,
      masraf_yeri_id: body.masrafYeriId,
      fis_fatura_no: body.fisFaturaNo !== undefined ? (body.fisFaturaNo?.trim() || null) : undefined,
    })
    if (!updated) return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 })

    const row = await getIslemById(id)
    return NextResponse.json({ id: updated, row })
  } catch (error) {
    console.error("Islem PATCH error:", error)
    const detail = error instanceof Error ? error.message : "Güncellenemedi."
    return NextResponse.json({ error: "Güncellenemedi.", detail }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (!id || Number.isNaN(id)) return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })

  try {
    await initializeDatabase()
    const existing = await getIslemById(id)
    if (!existing) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 })
    if (!canAccessSite(session, existing.site_id)) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    }
    await deleteIslem(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Islem DELETE error:", error)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}
