import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, createPersonelIzin } from "@/lib/database"

const IzinSchema = z.object({
  personel_id: z.number({ coerce: true }).int().positive(),
  izin_tipi: z.string().max(50).default("Yıllık"),
  baslangic_tarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  bitis_tarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  notlar: z.string().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  if (!canManageIdariCentral(session.role)) {
    return NextResponse.json({ error: "İzin girişi yetkiniz yok." }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 }) }

  const parsed = IzinSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Geçersiz." }, { status: 400 })

  const data = parsed.data
  if (data.bitis_tarihi < data.baslangic_tarihi) {
    return NextResponse.json({ error: "Bitiş tarihi başlangıçtan önce olamaz." }, { status: 400 })
  }

  await initializeDatabase()
  try {
    const id = await createPersonelIzin({
      personel_id: data.personel_id,
      izin_tipi: data.izin_tipi,
      baslangic_tarihi: data.baslangic_tarihi.slice(0, 10),
      bitis_tarihi: data.bitis_tarihi.slice(0, 10),
      notlar: data.notlar ?? null,
      olusturan_id: session.id,
    })
    return NextResponse.json({ id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
