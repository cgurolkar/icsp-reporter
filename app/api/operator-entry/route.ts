import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canDoMachineEntry, canViewAllSites } from "@/lib/auth"
import { saveOperatorEntry, getOperatorEntriesBySiteAndDate, initializeDatabase } from "@/lib/database"

/** Şantiye + tarih için operatör girişlerini listele (bilgi girişinde Makine Detayları için) */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const reportDate = searchParams.get("reportDate")?.trim().slice(0, 10)
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : NaN
  if (!Number.isInteger(siteId) || siteId < 1 || !reportDate) {
    return NextResponse.json({ error: "siteId ve reportDate gerekli." }, { status: 400 })
  }
  if (!canViewAllSites(session.role) && session.siteId !== siteId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }
  try {
    await initializeDatabase()
    const entries = await getOperatorEntriesBySiteAndDate(siteId, reportDate)
    return NextResponse.json(entries)
  } catch (error) {
    console.error("Operator entries GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  if (!canDoMachineEntry(session.role)) {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok. Sadece operatör makine girişi yapabilirsiniz." }, { status: 403 })
  }
  try {
    await initializeDatabase()
    const body = await request.json().catch(() => ({}))
    const siteId = body.siteId != null ? Number(body.siteId) : null
    const reportDate = typeof body.reportDate === "string" ? body.reportDate.trim().slice(0, 10) : ""
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : ""
    const machineName = typeof body.machineName === "string" ? body.machineName.trim() : ""
    if (!siteId || !reportDate || !machineId || !machineName) {
      return NextResponse.json({ error: "Şantiye, tarih, makine seçimi zorunludur." }, { status: 400 })
    }
    if (session.role === "operator" && session.siteId != null && session.siteId !== siteId) {
      return NextResponse.json({ error: "Sadece atandığınız şantiye için giriş yapabilirsiniz." }, { status: 403 })
    }
    const pileDepths = Array.isArray(body.pileDepths)
      ? body.pileDepths.map((r: { depth?: string | number; onForaj?: boolean; bosForaj?: boolean }) => ({
          depth: r.depth != null ? String(r.depth) : "",
          onForaj: !!r.onForaj,
          bosForaj: !!r.bosForaj,
        }))
      : []
    await saveOperatorEntry({
      siteId,
      reportDate,
      userId: session.id,
      machineId,
      machineName,
      dbMachineId: body.dbMachineId != null ? Number(body.dbMachineId) : null,
      machineHours: typeof body.machineHours === "string" ? body.machineHours.trim() : "",
      startTime: typeof body.startTime === "string" ? body.startTime.trim().slice(0, 5) : "",
      endTime: typeof body.endTime === "string" ? body.endTime.trim().slice(0, 5) : "",
      motorSaatBinis: typeof body.motorSaatBinis === "string" ? body.motorSaatBinis.trim() : "",
      motorSaatInis: typeof body.motorSaatInis === "string" ? body.motorSaatInis.trim() : "",
      pileDepths,
      usedFuel: typeof body.usedFuel === "string" ? body.usedFuel.trim() : "",
      workDone: typeof body.workDone === "string" ? body.workDone.trim() : "",
      note: typeof body.note === "string" ? body.note.trim() : "",
      dailyPileCount: typeof body.dailyPileCount === "string" ? body.dailyPileCount.trim() : "",
      totalProduction: typeof body.totalProduction === "string" ? body.totalProduction.trim() : "",
      emptyBorehole: typeof body.emptyBorehole === "string" ? body.emptyBorehole.trim() : "",
      preBorehole: typeof body.preBorehole === "string" ? body.preBorehole.trim() : "",
      concretePoured: typeof body.concretePoured === "string" ? body.concretePoured.trim() : "",
      elmasMiktar: typeof body.elmasMiktar === "string" ? body.elmasMiktar.trim() : "",
      elmasDegisimYok: body.elmasDegisimYok === true,
      bentonitMiktar: typeof body.bentonitMiktar === "string" ? body.bentonitMiktar.trim() : "",
      kullanılanMalzeme: typeof body.kullanılanMalzeme === "string" ? body.kullanılanMalzeme.trim() : "",
      malzemeIhtiyaci: body.malzemeIhtiyaci === true,
      servisIhtiyaci: body.servisIhtiyaci === true,
      image1: typeof body.image1 === "string" ? body.image1 : null,
      image2: typeof body.image2 === "string" ? body.image2 : null,
      notes: typeof body.notes === "string" ? body.notes.trim() : "",
    })
    return NextResponse.json({ success: true, message: "Makine girişi kaydedildi." })
  } catch (error) {
    console.error("Operator entry error:", error)
    return NextResponse.json(
      { error: "Kayıt sırasında hata oluştu." },
      { status: 500 }
    )
  }
}
