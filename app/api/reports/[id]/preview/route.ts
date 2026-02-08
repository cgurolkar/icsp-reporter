import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { getWorkReportById, initializeDatabase } from "@/lib/database"

export const dynamic = "force-dynamic"

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
    const report = data.report as { date?: string; site_code?: string }
    const siteCode = (report.site_code && String(report.site_code).trim()) || "genel"
    const safeCode = siteCode.replace(/[^a-zA-Z0-9_-]/g, "_")
    const dateStr = (typeof report.date === "string" ? report.date : "").slice(0, 10)
    const filename = `report-${dateStr}-${reportId}.html`
    const filePath = path.join(process.cwd(), "public", "reports", safeCode, filename)
    if (!fs.existsSync(filePath)) {
      return new NextResponse("Rapor dosyası bulunamadı. Eski raporlar için kayıt oluşturulmamış olabilir.", { status: 404 })
    }
    const html = fs.readFileSync(filePath, "utf-8")
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (error) {
    console.error("Error serving report preview:", error)
    return new NextResponse("Failed to load preview", { status: 500 })
  }
}
