/**
 * GET/PATCH/DELETE /api/admin/operator-entries/[id] — super_admin
 */
import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import {
  getOperatorEntryByIdAdmin,
  deleteOperatorEntryByIdAdmin,
  updateOperatorEntryByIdAdmin,
  initializeDatabase,
} from "@/lib/database"

export const dynamic = "force-dynamic"

function parseBody(body: Record<string, unknown>) {
  const siteId = typeof body.siteId === "number" ? body.siteId : parseInt(String(body.siteId ?? ""), 10)
  const userId = typeof body.userId === "number" ? body.userId : parseInt(String(body.userId ?? ""), 10)
  const reportDate = typeof body.reportDate === "string" ? body.reportDate.slice(0, 10) : ""
  const machineId = typeof body.machineId === "string" ? body.machineId.trim() : String(body.machineId ?? "").trim()
  const machineName = typeof body.machineName === "string" ? body.machineName.trim() : String(body.machineName ?? "").trim()
  return { siteId, userId, reportDate, machineId, machineName }
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (session.role !== "super_admin") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { id: idStr } = await context.params
  const id = parseInt(idStr, 10)
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })
  try {
    await initializeDatabase()
    const row = await getOperatorEntryByIdAdmin(id)
    if (!row) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    return NextResponse.json({ entry: row })
  } catch (e) {
    console.error("admin operator-entries GET:", e)
    return NextResponse.json({ error: "Kayıt alınamadı." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (session.role !== "super_admin") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { id: idStr } = await context.params
  const id = parseInt(idStr, 10)
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 })
  }
  const { siteId, userId, reportDate, machineId, machineName } = parseBody(body)
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
    await updateOperatorEntryByIdAdmin(id, {
      siteId,
      reportDate,
      userId,
      machineId,
      machineName,
      dbMachineId: dbMachineId != null && !Number.isNaN(dbMachineId) ? dbMachineId : null,
      machineHours: body.machineHours != null ? String(body.machineHours) : "",
      startTime: body.startTime != null ? String(body.startTime) : null,
      endTime: body.endTime != null ? String(body.endTime) : null,
      motorSaatBinis: body.motorSaatBinis != null ? String(body.motorSaatBinis) : null,
      motorSaatInis: body.motorSaatInis != null ? String(body.motorSaatInis) : null,
      pileDepths,
      usedFuel: body.usedFuel != null ? String(body.usedFuel) : "",
      workDone: body.workDone != null ? String(body.workDone) : "",
      note: body.note != null ? String(body.note) : "",
      dailyPileCount: body.dailyPileCount != null ? String(body.dailyPileCount) : "",
      totalProduction: body.totalProduction != null ? String(body.totalProduction) : "",
      emptyBorehole: body.emptyBorehole != null ? String(body.emptyBorehole) : "",
      preBorehole: body.preBorehole != null ? String(body.preBorehole) : "",
      concretePoured: body.concretePoured != null ? String(body.concretePoured) : "",
      elmasMiktar: body.elmasMiktar != null ? String(body.elmasMiktar) : null,
      elmasDegisimYok: body.elmasDegisimYok === true,
      bentonitMiktar: body.bentonitMiktar != null ? String(body.bentonitMiktar) : null,
      kullanilanMalzeme: body.kullanilanMalzeme != null ? String(body.kullanilanMalzeme) : null,
      malzemeIhtiyaci: body.malzemeIhtiyaci === true,
      servisIhtiyaci: body.servisIhtiyaci === true,
      image1: body.image1 != null ? String(body.image1) : null,
      image2: body.image2 != null ? String(body.image2) : null,
      notes: body.notes != null ? String(body.notes) : "",
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.message === "UNIQUE_CONFLICT") {
      return NextResponse.json(
        { error: "Aynı şantiye, tarih, operatör ve makine kimliği ile başka bir kayıt var." },
        { status: 409 },
      )
    }
    console.error("admin operator-entries PATCH:", e)
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (session.role !== "super_admin") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { id: idStr } = await context.params
  const id = parseInt(idStr, 10)
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })
  try {
    await initializeDatabase()
    const ok = await deleteOperatorEntryByIdAdmin(id)
    if (!ok) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("admin operator-entries DELETE:", e)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}
