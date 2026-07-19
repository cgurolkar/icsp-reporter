import { type NextRequest, NextResponse } from "next/server"
import { getWorkReportById, getOperatorEntriesBySiteAndDate, initializeDatabase, getSiteById, getCumulativeTotalProduction, getCumulativePileCounts } from "@/lib/database"
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
    // Rapor erişim sınırı: user/personel sadece kendi şantiyesi
    const rawReport = data.report as Record<string, unknown>
    const siteId = rawReport.site_id != null ? Number(rawReport.site_id) : null
    if (siteId != null && !canAccessSite(session, siteId)) {
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
    const pileCounts = siteId && reportDate ? await getCumulativePileCounts(siteId, reportDate) : null
    const html = generatePDFMainReport(formData, {
      computedRemainingPiles: r.remaining_piles != null && String(r.remaining_piles).trim() !== "" ? String(r.remaining_piles) : undefined,
      computedDailyPileCount: r.daily_pile_count != null && String(r.daily_pile_count).trim() !== "" ? String(r.daily_pile_count) : (concretePoured > 0 ? String(concretePoured) : undefined),
      concretePouredSum: concretePoured || undefined,
      projectStartDate,
      daysElapsed,
      showHakedis: session.role === "super_admin",
      contractUnitPrice: site?.contract_unit_price != null ? Number(site.contract_unit_price) : null,
      cumulativeTotalProduction,
      cumulativeDrilledPiles: pileCounts?.drilled ?? null,
      cumulativeConcretePiles: pileCounts?.concrete ?? null,
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
