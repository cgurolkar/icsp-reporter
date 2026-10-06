import { type NextRequest, NextResponse } from "next/server"
import { canAccessSite, getSessionFromRequest } from "@/lib/auth"
import { getMachineWorkStats, initializeDatabase } from "@/lib/database"

export const dynamic = "force-dynamic"

/** Şantiye + tarihe kadar makine kümülatif iş özeti (kaydedilmiş raporlar). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })

  const { id } = await params
  const siteId = parseInt(id, 10)
  if (Number.isNaN(siteId)) return NextResponse.json({ error: "Geçersiz şantiye." }, { status: 400 })
  if (!canAccessSite(session, siteId)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")?.slice(0, 10)
  if (!date) return NextResponse.json({ error: "date parametresi gerekli (YYYY-MM-DD)." }, { status: 400 })

  try {
    await initializeDatabase()
    const rows = await getMachineWorkStats({ siteId, asOfDate: date })
    return NextResponse.json(rows)
  } catch (e) {
    console.error("GET machine-cumulative:", e)
    return NextResponse.json({ error: "Veri alınamadı." }, { status: 500 })
  }
}
