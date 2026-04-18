/**
 * GET/POST /api/admin/operator-entries — super_admin: operatör makine girişleri listesi / yeni kayıt
 */
import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { getAdminOperatorEntriesList, initializeDatabase, saveOperatorEntry } from "@/lib/database"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (session.role !== "super_admin") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 })
  }
  const siteId = typeof body.siteId === "number" ? body.siteId : parseInt(String(body.siteId ?? ""), 10)
  const userId = typeof body.userId === "number" ? body.userId : parseInt(String(body.userId ?? ""), 10)
  const reportDate = typeof body.reportDate === "string" ? body.reportDate.slice(0, 10) : ""
  const machineId = typeof body.machineId === "string" ? body.machineId.trim() : String(body.machineId ?? "").trim()
  const machineName = typeof body.machineName === "string" ? body.machineName.trim() : String(body.machineName ?? "").trim()
  if (!reportDate || !machineId || !machineName || !Number.isInteger(siteId) || siteId < 1 || !Number.isInteger(userId) || userId < 1) {
    return NextResponse.json({ error: "siteId, userId, reportDate, machineId ve machineName gerekli." }, { status: 400 })
  }
  const dbMachineIdRaw = body.dbMachineId
  const dbMachineId =
    dbMachineIdRaw == null || dbMachineIdRaw === ""
      ? null
      : typeof dbMachineIdRaw === "number"
        ? dbMachineIdRaw
        : parseInt(String(dbMachineIdRaw), 10)
  let pileDepths: unknown = body.pileDepths
  if (typeof pileDepths === "string") {
    try {
      pileDepths = JSON.parse(pileDepths || "[]")
    } catch {
      pileDepths = []
    }
  }
  try {
    await initializeDatabase()
    await saveOperatorEntry({
      siteId,
      reportDate,
      userId,
      machineId,
      machineName,
      dbMachineId: dbMachineId != null && !Number.isNaN(dbMachineId) ? dbMachineId : null,
      machineHours: body.machineHours != null ? String(body.machineHours) : "",
      startTime: body.startTime != null ? String(body.startTime) : undefined,
      endTime: body.endTime != null ? String(body.endTime) : undefined,
      motorSaatBinis: body.motorSaatBinis != null ? String(body.motorSaatBinis) : undefined,
      motorSaatInis: body.motorSaatInis != null ? String(body.motorSaatInis) : undefined,
      pileDepths: Array.isArray(pileDepths) ? (pileDepths as { depth: string | number; onForaj: boolean; bosForaj: boolean }[]) : [],
      usedFuel: body.usedFuel != null ? String(body.usedFuel) : "",
      workDone: body.workDone != null ? String(body.workDone) : "",
      note: body.note != null ? String(body.note) : "",
      dailyPileCount: body.dailyPileCount != null ? String(body.dailyPileCount) : "",
      totalProduction: body.totalProduction != null ? String(body.totalProduction) : "",
      emptyBorehole: body.emptyBorehole != null ? String(body.emptyBorehole) : "",
      preBorehole: body.preBorehole != null ? String(body.preBorehole) : "",
      concretePoured: body.concretePoured != null ? String(body.concretePoured) : "",
      elmasMiktar: body.elmasMiktar != null ? String(body.elmasMiktar) : undefined,
      elmasDegisimYok: body.elmasDegisimYok === true,
      bentonitMiktar: body.bentonitMiktar != null ? String(body.bentonitMiktar) : undefined,
      kullanılanMalzeme: body.kullanilanMalzeme != null ? String(body.kullanilanMalzeme) : undefined,
      malzemeIhtiyaci: body.malzemeIhtiyaci === true,
      servisIhtiyaci: body.servisIhtiyaci === true,
      image1: body.image1 != null ? String(body.image1) : null,
      image2: body.image2 != null ? String(body.image2) : null,
      notes: body.notes != null ? String(body.notes) : "",
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("admin operator-entries POST:", e)
    return NextResponse.json({ error: "Kayıt oluşturulamadı (aynı gün / aynı makine için kayıt var olabilir)." }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (session.role !== "super_admin") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const siteIdRaw = searchParams.get("siteId")
    const siteId = siteIdRaw && siteIdRaw !== "" ? parseInt(siteIdRaw, 10) : null
    const limit = parseInt(searchParams.get("limit") || "200", 10)

    const entries = await getAdminOperatorEntriesList({
      startDate,
      endDate,
      siteId: siteId != null && !Number.isNaN(siteId) ? siteId : null,
      limit,
    })
    return NextResponse.json({ entries })
  } catch (e) {
    console.error("admin operator-entries:", e)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}
