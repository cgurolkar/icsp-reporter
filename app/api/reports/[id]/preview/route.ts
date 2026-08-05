import { type NextRequest, NextResponse } from "next/server"
import {
  getWorkReportById,
  getOperatorEntriesBySiteAndDate,
  initializeDatabase,
  getSiteById,
  getCumulativeTotalProduction,
  getCumulativePileCounts,
  getCumulativeHakedisBreakdown,
} from "@/lib/database"
import { generatePDFMainReport, generatePDFExpensesPage } from "@/lib/report-html"
import { canAccessSite, canViewReports, getSessionFromRequest } from "@/lib/auth"
import { formDataFromDbReport } from "@/lib/report-db-formdata"

export const dynamic = "force-dynamic"

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
    const rawReport = data.report as Record<string, unknown>
    const siteId = rawReport.site_id != null ? Number(rawReport.site_id) : null
    if (siteId != null && !canAccessSite(session, siteId)) {
      return new NextResponse("Yetkisiz.", { status: 403 })
    }

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
    const showHakedis = session.role === "super_admin"
    const cumulativeTotalProduction =
      showHakedis && siteId && reportDate ? await getCumulativeTotalProduction(siteId, reportDate) : null
    const hakedisBreakdown =
      showHakedis && siteId && reportDate ? await getCumulativeHakedisBreakdown(siteId, reportDate) : null
    const pileCounts = siteId && reportDate ? await getCumulativePileCounts(siteId, reportDate) : null
    const totalPiles = site?.total_piles != null ? Number(site.total_piles) : null
    const remainingComputed =
      totalPiles != null && pileCounts != null
        ? String(Math.max(0, totalPiles - (Number(pileCounts.concrete) || 0)))
        : r.remaining_piles != null && String(r.remaining_piles).trim() !== ""
          ? String(r.remaining_piles)
          : undefined
    const html = generatePDFMainReport(formData, {
      computedRemainingPiles: remainingComputed,
      computedDailyPileCount: r.daily_pile_count != null && String(r.daily_pile_count).trim() !== "" ? String(r.daily_pile_count) : (concretePoured > 0 ? String(concretePoured) : undefined),
      concretePouredSum: concretePoured || undefined,
      projectStartDate,
      daysElapsed,
      showHakedis,
      contractUnitPrice: showHakedis && site?.contract_unit_price != null ? Number(site.contract_unit_price) : null,
      billingCurrency: showHakedis && site?.billing_currency != null ? String(site.billing_currency) : null,
      cumulativeTotalProduction,
      hakedisBreakdown,
      cumulativeDrilledPiles: pileCounts?.drilled ?? null,
      cumulativeConcretePiles: pileCounts?.concrete ?? null,
      projectTotalPiles: totalPiles,
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
