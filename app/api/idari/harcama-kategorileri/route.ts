import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import pool, { initializeDatabase, getHarcamaKategorileri } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  try {
    await initializeDatabase()
    const list = await getHarcamaKategorileri()
    return NextResponse.json(list)
  } catch (error) {
    console.error("Harcama kategorileri GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  try {
    const body = await request.json().catch(() => ({}))
    const kod = String(body?.kod ?? "").trim()
    const ad = String(body?.ad ?? "").trim()
    if (!kod || !ad) return NextResponse.json({ error: "kod ve ad gerekli." }, { status: 400 })
    await initializeDatabase()
    const client = await pool.connect()
    try {
      await client.query(`INSERT INTO harcama_kategorileri (kod, ad, aciklama) VALUES ($1, $2, $3)`, [
        kod,
        ad,
        body.aciklama ? String(body.aciklama).trim() : null,
      ])
      const r = await client.query(`SELECT id FROM harcama_kategorileri WHERE kod = $1`, [kod])
      return NextResponse.json({ id: r.rows[0]?.id })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("Harcama kategorileri POST error:", error)
    return NextResponse.json({ error: "Eklenemedi." }, { status: 500 })
  }
}
