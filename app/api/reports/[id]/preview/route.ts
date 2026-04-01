import { type NextRequest, NextResponse } from "next/server"
import { getWorkReportById, getOperatorEntriesBySiteAndDate, initializeDatabase, getSiteById, getCumulativeTotalProduction } from "@/lib/database"
import { generatePDFMainReport, generatePDFExpensesPage } from "@/lib/report-html"
import { canViewAllSites, canViewReports, getSessionFromRequest } from "@/lib/auth"

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return new NextResponse("Giriş yapmalısınız.", { status: 401 })
    if (!canViewReports(session.role)) return new NextResponse("Yetkisiz.", { status: 403 })

    await initializeDatabase()
    const { id } = await params
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) return new NextResponse("Invalid report id", { status: 400 })
    const data = await getWorkReportById(reportId)
    if (!data?.report) return new NextResponse("Report not found", { status: 404 })
    // Rapor erişim sınırı: user/personel sadece kendi şantiyesi
    const rawReport = data.report as Record<string, unknown>
    const siteId = rawReport.site_id != null ? Number(rawReport.site_id) : null
    if (!canViewAllSites(session.role, session) && session.siteId !== siteId) {
      return new NextResponse("Yetkisiz.", { status: 403 })
    }

    // Her zaman DB'den yeniden üret: role bazlı alanlar (hakediş) dinamik kalsın
    const formData = formDataFromDbReport({
      report: data.report as Record<string, unknown>,
      machines: (data.machines || []) as Record<string, unknown>[],
      fuelRecords: (data.fuelRecords || []) as Record<string, unknown>[],
    })
    const r = data.report as Record<string, unknown>
    const concretePoured = parseInt(String(r.concrete_poured ?? ""), 10) || 0
    const reportDate = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : (typeof r.date === "string" ? r.date.slice(0, 10) : "")
    const operatorEntries = siteId && reportDate ? await getOperatorEntriesBySiteAndDate(siteId, reportDate) : []
    const site = siteId ? await getSiteById(siteId) : null
    const projectStartDate = site?.project_start_date ? String(site.project_start_date).slice(0, 10) : null
    const daysElapsed = projectStartDate && reportDate
      ? Math.max(0, Math.floor((new Date(`${reportDate}T00:00:00Z`).getTime() - new Date(`${projectStartDate}T00:00:00Z`).getTime()) / 86400000) + 1)
      : null
    const cumulativeTotalProduction = siteId && reportDate ? await getCumulativeTotalProduction(siteId, reportDate) : null
    const html = generatePDFMainReport(formData, {
      computedRemainingPiles: r.remaining_piles != null && String(r.remaining_piles).trim() !== "" ? String(r.remaining_piles) : undefined,
      computedDailyPileCount: r.daily_pile_count != null && String(r.daily_pile_count).trim() !== "" ? String(r.daily_pile_count) : (concretePoured > 0 ? String(concretePoured) : undefined),
      concretePouredSum: concretePoured || undefined,
      projectStartDate,
      daysElapsed,
      showHakedis: session.role === "super_admin",
      contractUnitPrice: site?.contract_unit_price != null ? Number(site.contract_unit_price) : null,
      cumulativeTotalProduction,
      operatorEntries,
    }) + generatePDFExpensesPage(formData)
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error serving report preview:", error)
    return new NextResponse("Failed to load preview", { status: 500 })
  }
}
