import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canEnterTimesheet } from "@/lib/auth"
import { initializeDatabase, getPuantajForSiteAndDate, savePuantajBulk } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const tarih = searchParams.get("tarih")?.trim().slice(0, 10)
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : NaN
  if (!siteId || !tarih) return NextResponse.json({ error: "siteId ve tarih gerekli." }, { status: 400 })

  try {
    await initializeDatabase()
    const list = await getPuantajForSiteAndDate(siteId, tarih)
    return NextResponse.json(list)
  } catch (error) {
    console.error("Puantaj GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const siteId = body?.siteId != null ? Number(body.siteId) : NaN
  const tarih = body?.tarih ? String(body.tarih).trim().slice(0, 10) : ""
  const rows = Array.isArray(body?.rows) ? body.rows : []

  if (!siteId || !tarih) return NextResponse.json({ error: "siteId ve tarih gerekli." }, { status: 400 })
  if (!canEnterTimesheet(session.role, session.siteId, siteId)) {
    return NextResponse.json({ error: "Bu şantiye için puantaj girişi yetkiniz yok." }, { status: 403 })
  }

  try {
    await initializeDatabase()
    await savePuantajBulk({
      siteId,
      tarih,
      userId: session.id,
      rows: rows
        .map((r: { personel_id: number; carpan?: number; durum_kod?: string; mesai_saat?: number; notlar?: string }) => ({
          personel_id: Number(r.personel_id),
          carpan: r.carpan != null ? Number(r.carpan) : undefined,
          durum_kod: r.durum_kod,
          mesai_saat: r.mesai_saat != null ? Number(r.mesai_saat) : undefined,
          notlar: r.notlar,
        }))
        .filter((r: { personel_id: number }) => r.personel_id > 0),
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Puantaj POST error:", error)
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 })
  }
}
