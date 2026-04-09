import { type NextRequest, NextResponse } from "next/server"
import { getWorkReportById, updateWorkReport, updateWorkReportAllEditableFields, deleteWorkReport, initializeDatabase } from "@/lib/database"
import { getSessionFromRequest, canViewReports } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
    if (!canViewReports(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    await initializeDatabase()
    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) return NextResponse.json({ error: "Invalid report id" }, { status: 400 })
    const data = await getWorkReportById(reportId)
    if (!data?.report) return NextResponse.json({ error: "Report not found" }, { status: 404 })
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching report:", error)
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
    if (!canViewReports(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    await initializeDatabase()
    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) return NextResponse.json({ error: "Invalid report id" }, { status: 400 })
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const isSuperAdmin = session.role === "super_admin"

    const updated = (isSuperAdmin && body.fullUpdate === true && body.rawData && typeof body.rawData === "object")
      ? await updateWorkReportAllEditableFields(reportId, body.rawData as Record<string, unknown>)
      : await updateWorkReport(reportId, {
          date: body.date as string | undefined,
          project: body.project as string | undefined,
          siteId: body.siteId != null ? (typeof body.siteId === "number" ? body.siteId : parseInt(String(body.siteId), 10) || null) : undefined,
          selectedMachineName: (body.selectedMachineName ?? body.selected_machine_name) as string | undefined,
          totalProductionSummary: (body.totalProductionSummary ?? body.total_production_summary) as string | undefined,
          totalPileCount: (body.totalPileCount ?? body.total_pile_count) as string | undefined,
          dailyPileCount: (body.dailyPileCount ?? body.daily_pile_count) as string | undefined,
          remainingPiles: (body.remainingPiles ?? body.remaining_piles) as string | undefined,
          concretePoured: (body.concretePoured ?? body.concrete_poured) as string | undefined,
          personnelTotal: (body.personnelTotal ?? body.personnel_total) as number | undefined,
          dailyFuelUsage: (body.dailyFuelUsage ?? body.daily_fuel_usage) as string | undefined,
          notes: body.notes as string | undefined,
        })
    if (!updated) return NextResponse.json({ error: "Report not found" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating report:", error)
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
    if (!canViewReports(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    await initializeDatabase()
    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) return NextResponse.json({ error: "Invalid report id" }, { status: 400 })
    const deleted = await deleteWorkReport(reportId)
    if (!deleted) return NextResponse.json({ error: "Report not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting report:", error)
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 })
  }
}
