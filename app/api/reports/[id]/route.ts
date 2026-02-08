import { type NextRequest, NextResponse } from "next/server"
import { getWorkReportById, updateWorkReport, deleteWorkReport, initializeDatabase } from "@/lib/database"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    await initializeDatabase()
    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) return NextResponse.json({ error: "Invalid report id" }, { status: 400 })
    const body = await request.json().catch(() => ({}))
    const updated = await updateWorkReport(reportId, {
      date: body.date,
      project: body.project,
      siteId: body.siteId != null ? (typeof body.siteId === "number" ? body.siteId : parseInt(String(body.siteId), 10) || null) : undefined,
      selectedMachineName: body.selectedMachineName ?? body.selected_machine_name,
      totalProductionSummary: body.totalProductionSummary ?? body.total_production_summary,
      totalPileCount: body.totalPileCount ?? body.total_pile_count,
      dailyPileCount: body.dailyPileCount ?? body.daily_pile_count,
      remainingPiles: body.remainingPiles ?? body.remaining_piles,
      concretePoured: body.concretePoured ?? body.concrete_poured,
      personnelTotal: body.personnelTotal ?? body.personnel_total,
      dailyFuelUsage: body.dailyFuelUsage ?? body.daily_fuel_usage,
      notes: body.notes,
    })
    if (!updated) return NextResponse.json({ error: "Report not found" }, { status: 404 })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating report:", error)
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
