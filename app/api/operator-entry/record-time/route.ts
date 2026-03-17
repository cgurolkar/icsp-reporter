import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canDoMachineEntry } from "@/lib/auth"
import { getSiteById, getTimezoneForCountry, updateOperatorEntryTime, initializeDatabase } from "@/lib/database"

/** Operatör biniş/iniş ok butonu: motor saati + bölgesel saati kaydet */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  if (!canDoMachineEntry(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 })
  }
  try {
    await initializeDatabase()
    const body = await request.json().catch(() => ({}))
    const siteId = body.siteId != null ? Number(body.siteId) : null
    const reportDate = typeof body.reportDate === "string" ? body.reportDate.trim().slice(0, 10) : ""
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : ""
    const type = body.type === "start" || body.type === "end" ? body.type : null
    const motorSaati = typeof body.motorSaati === "string" ? body.motorSaati.trim() : ""

    if (!siteId || !reportDate || !machineId || type === null) {
      return NextResponse.json({ error: "siteId, reportDate, machineId ve type (start/end) gerekli." }, { status: 400 })
    }
    if (session.role === "operator" && session.siteId != null && session.siteId !== siteId) {
      return NextResponse.json({ error: "Sadece atandığınız şantiye için giriş yapabilirsiniz." }, { status: 403 })
    }

    const site = await getSiteById(siteId)
    if (!site) return NextResponse.json({ error: "Şantiye bulunamadı." }, { status: 404 })

    const timezone = (site as { timezone?: string }).timezone && String((site as { timezone?: string }).timezone).trim()
      ? String((site as { timezone?: string }).timezone).trim()
      : getTimezoneForCountry((site as { country?: string }).country)

    const machineName = typeof body.machineName === "string" ? body.machineName.trim() : (site as { name?: string }).name || ""

    const result = await updateOperatorEntryTime({
      siteId,
      reportDate,
      userId: session.id,
      machineId,
      machineName: machineName || "Makine",
      type,
      motorSaati,
      timezone,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Operator record-time error:", error)
    return NextResponse.json({ error: "Kayıt sırasında hata oluştu." }, { status: 500 })
  }
}
