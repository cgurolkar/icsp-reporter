import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canAccessIdari } from "@/lib/auth"
import { initializeDatabase, createEnvanterHareket } from "@/lib/database"

const HareketSchema = z.object({
  envanter_id: z.number({ coerce: true }).int().positive(),
  hareket_tipi: z.enum(["gelen", "giden"]),
  kaynak_yer: z.string().max(255).optional().nullable(),
  hedef_yer: z.string().max(255).optional().nullable(),
  site_id: z.number({ coerce: true }).int().positive().optional().nullable(),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  adet: z.number({ coerce: true }).int().positive().default(1),
  notlar: z.string().max(500).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  if (session.role !== "admin" && session.role !== "manager") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 }) }

  const parsed = HareketSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Geçersiz." }, { status: 400 })

  const data = parsed.data
  await initializeDatabase()

  try {
    const id = await createEnvanterHareket({
      envanter_id: data.envanter_id,
      hareket_tipi: data.hareket_tipi,
      kaynak_yer: data.kaynak_yer ?? null,
      hedef_yer: data.hedef_yer ?? null,
      site_id: data.site_id ?? null,
      tarih: data.tarih.slice(0, 10),
      adet: data.adet,
      notlar: data.notlar ?? null,
      olusturan_id: session.id,
    })
    return NextResponse.json({ id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
