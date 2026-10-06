import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari } from "@/lib/auth"
import { getMachineWorkStats, initializeDatabase } from "@/lib/database"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const siteIdParam = searchParams.get("siteId")
    const asOfDate = searchParams.get("asOfDate")?.slice(0, 10) || undefined
    const machineIdParam = searchParams.get("machineId")
    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
    const machineId = machineIdParam ? parseInt(machineIdParam, 10) : undefined

    const rows = await getMachineWorkStats({
      siteId: siteId != null && !Number.isNaN(siteId) ? siteId : undefined,
      asOfDate,
      machineId: machineId != null && !Number.isNaN(machineId) ? machineId : undefined,
    })
    return NextResponse.json(rows)
  } catch (e) {
    console.error("GET /api/idari/makineler/ozet:", e)
    return NextResponse.json({ error: "Özet alınamadı." }, { status: 500 })
  }
}
