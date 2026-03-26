import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canApproveTimesheet } from "@/lib/auth"
import { initializeDatabase, getTaslakPuantajGroups, approvePuantaj } from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  if (!canApproveTimesheet(session.role)) return NextResponse.json({ error: "Puantaj onaylama yetkiniz yok." }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const baslangic = searchParams.get("baslangic")?.trim().slice(0, 10)
  const bitis = searchParams.get("bitis")?.trim().slice(0, 10)
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined

  try {
    await initializeDatabase()
    const list = await getTaslakPuantajGroups({ siteId: siteId && !Number.isNaN(siteId) ? siteId : undefined, baslangic, bitis })
    return NextResponse.json(list)
  } catch (error) {
    console.error("Puantaj onay GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canApproveTimesheet(session.role)) return NextResponse.json({ error: "Puantaj onaylama yetkiniz yok." }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const siteId = body?.siteId != null ? Number(body.siteId) : NaN
  const baslangicTarih = body?.baslangicTarih ? String(body.baslangicTarih).trim().slice(0, 10) : ""
  const bitisTarih = body?.bitisTarih ? String(body.bitisTarih).trim().slice(0, 10) : ""

  if (!siteId || !baslangicTarih || !bitisTarih) {
    return NextResponse.json({ error: "siteId, baslangicTarih ve bitisTarih gerekli." }, { status: 400 })
  }

  try {
    await initializeDatabase()
    const count = await approvePuantaj(siteId, baslangicTarih, bitisTarih, session.id)
    return NextResponse.json({ ok: true, count })
  } catch (error) {
    console.error("Puantaj onay POST error:", error)
    return NextResponse.json({ error: "Onaylanamadı." }, { status: 500 })
  }
}
