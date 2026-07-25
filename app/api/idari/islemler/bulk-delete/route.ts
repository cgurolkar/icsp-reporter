import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canManageIdariCentral, canAccessSite } from "@/lib/auth"
import pool, { initializeDatabase, deleteIslemlerBulk } from "@/lib/database"

const BodySchema = z.object({
  ids: z.array(z.number({ coerce: true }).int().positive()).min(1).max(500),
})

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçerli id listesi gerekli." }, { status: 400 })
    }
    const ids = parsed.data.ids
    await initializeDatabase()

    const client = await pool.connect()
    try {
      const r = await client.query(`SELECT id, site_id FROM islemler WHERE id = ANY($1::int[])`, [ids])
      for (const row of r.rows) {
        if (!canAccessSite(session, row.site_id)) {
          return NextResponse.json({ error: "Yetkisiz şantiye kaydı seçildi." }, { status: 403 })
        }
      }
      const allowedIds = r.rows.map((row: { id: number }) => row.id)
      if (allowedIds.length === 0) {
        return NextResponse.json({ error: "Silinecek kayıt bulunamadı." }, { status: 404 })
      }
      const deleted = await deleteIslemlerBulk(allowedIds)
      return NextResponse.json({ deleted })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("Islem bulk-delete error:", error)
    return NextResponse.json({ error: "Toplu silme başarısız." }, { status: 500 })
  }
}
