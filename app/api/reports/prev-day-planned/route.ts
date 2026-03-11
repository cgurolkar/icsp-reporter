import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { getReportBySiteAndDate } from "@/lib/database"

export const dynamic = "force-dynamic"

/** Dünkü raporun "bir sonraki gün planlanan" metnini döner (kullanıcı/personel pop-up için) */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : NaN
  if (!Number.isInteger(siteId) || siteId < 1) {
    return NextResponse.json({ error: "Geçerli siteId gerekli." }, { status: 400 })
  }
  if ((session.role === "user" || session.role === "personel") && session.siteId !== siteId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().slice(0, 10)
  const report = await getReportBySiteAndDate(siteId, dateStr)
  const nextDayPlanned = report?.next_day_planned && String(report.next_day_planned).trim() ? String(report.next_day_planned).trim() : null
  return NextResponse.json({ nextDayPlanned, date: dateStr })
}
