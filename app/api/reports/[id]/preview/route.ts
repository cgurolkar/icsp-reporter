import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { getWorkReportById, getOperatorEntriesBySiteAndDate, initializeDatabase } from "@/lib/database"
import { generatePDFMainReport, generatePDFExpensesPage } from "@/lib/report-html"

export const dynamic = "force-dynamic"

/** Veritabanındaki rapor + makineler + yakıt kayıtlarından formData benzeri obje oluşturur (eski raporlar için HTML üretimi). */
function formDataFromDbReport(data: { report: Record<string, unknown>; machines: Record<string, unknown>[]; fuelRecords: Record<string, unknown>[] }) {
  const r = data.report
  const dateVal = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : (typeof r.date === "string" ? r.date.slice(0, 10) : "")
  const machines = (data.machines || []).map((m: Record<string, unknown>, i: number) => ({
    machineName: m.machine_name ?? "",
    machineHours: i === 0 ? (r.machine_hours ?? "") : "",
    totalProduction: i === 0 ? (r.total_production ?? "") : "",
    pileCount: i === 0 ? (r.pile_count ?? "") : "",
    drilledPile: i === 0 ? (r.drilled_pile ?? "") : "",
    concretePile: i === 0 ? (r.concrete_pile ?? "") : "",
  }))
  const primary = data.machines?.[0]
  const formData = {
    basicInfo: {
      date: dateVal,
      project: r.project ?? "",
      machines,
    },
    machineSelection: {
      selectedMachine: { id: r.selected_machine_id ?? "", name: r.selected_machine_name ?? "" },
      additionalMachines: (data.machines || []).slice(1).map((m: Record<string, unknown>) => ({ name: m.machine_name ?? "" })),
      currentMachineIndex: 0,
    },
    productionSummary: [{
      machineName: r.selected_machine_name ?? "",
      totalProduction: r.total_production_summary ?? "",
      totalPileCount: r.total_pile_count ?? "",
      dailyPileCount: r.daily_pile_count ?? "",
      totalCompletedPiles: r.total_completed_piles ?? "",
      remainingPiles: r.remaining_piles ?? "",
      steelLoweredPiles: r.steel_lowered_piles ?? "",
      concretePoured: r.concrete_poured ?? "",
    }],
    personnel: {
      engineer: r.engineer_count ?? 0,
      foreman: r.foreman_count ?? 0,
      operator: r.operator_count ?? 0,
      oiler: r.oiler_count ?? 0,
      welder: r.welder_count ?? 0,
      other: r.other_count ?? 0,
      total: r.personnel_total ?? 0,
    },
    vehicles: {
      crane: r.crane_count ?? 0,
      loader: r.loader_count ?? 0,
      truck: r.truck_count ?? 0,
      pickup: r.pickup_count ?? 0,
      car: r.car_count ?? 0,
      service: r.service_count ?? 0,
      total: r.vehicles_total ?? 0,
    },
    fuel: {
      machines: (data.fuelRecords || []).map((f: Record<string, unknown>) => ({
        name: f.machine_name ?? "",
        shift: f.shift ?? "",
        incoming: f.incoming ?? "",
        remaining: f.remaining ?? "",
        used: f.used ?? "",
      })),
    },
    pileDetails: Array.isArray(r.pile_details) ? r.pile_details : [],
    notes: (r.notes as string) ?? "",
    expenses: Array.isArray(r.expenses) ? r.expenses : [],
    dailyInfo: {
      notes: (r.daily_notes as string) ?? "",
      nextDayPlannedWork: (r.next_day_planned as string) ?? "",
      image1: (r.daily_image1 as string) ?? "",
      image2: (r.daily_image2 as string) ?? "",
    },
  }
  return formData
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase()
    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) return new NextResponse("Invalid report id", { status: 400 })
    const data = await getWorkReportById(reportId)
    if (!data?.report) return new NextResponse("Report not found", { status: 404 })
    const report = data.report as { date?: string | Date; site_code?: string }
    const siteCode = (report.site_code && String(report.site_code).trim()) || "genel"
    const safeCode = siteCode.replace(/[^a-zA-Z0-9_-]/g, "_")
    const dateStr = (report.date instanceof Date ? report.date.toISOString().slice(0, 10) : (typeof report.date === "string" ? report.date : "").slice(0, 10))
    const filename = `report-${dateStr}-${reportId}.html`
    const filePath = path.join(process.cwd(), "public", "reports", safeCode, filename)
    let html: string
    if (fs.existsSync(filePath)) {
      html = fs.readFileSync(filePath, "utf-8")
    } else {
      // Eski raporlar: dosya yoksa veritabanından HTML üret
      const formData = formDataFromDbReport({
        report: data.report as Record<string, unknown>,
        machines: (data.machines || []) as Record<string, unknown>[],
        fuelRecords: (data.fuelRecords || []) as Record<string, unknown>[],
      })
      const r = data.report as Record<string, unknown>
      const concretePoured = parseInt(String(r.concrete_poured ?? ""), 10) || 0
      const siteId = r.site_id != null ? Number(r.site_id) : null
      const reportDate = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : (typeof r.date === "string" ? r.date.slice(0, 10) : "")
      const operatorEntries = siteId && reportDate ? await getOperatorEntriesBySiteAndDate(siteId, reportDate) : []
      html = generatePDFMainReport(formData, {
        computedRemainingPiles: r.remaining_piles != null && String(r.remaining_piles).trim() !== "" ? String(r.remaining_piles) : undefined,
        computedDailyPileCount: r.daily_pile_count != null && String(r.daily_pile_count).trim() !== "" ? String(r.daily_pile_count) : (concretePoured > 0 ? String(concretePoured) : undefined),
        concretePouredSum: concretePoured || undefined,
        operatorEntries,
      }) + generatePDFExpensesPage(formData)
    }
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error serving report preview:", error)
    return new NextResponse("Failed to load preview", { status: 500 })
  }
}
