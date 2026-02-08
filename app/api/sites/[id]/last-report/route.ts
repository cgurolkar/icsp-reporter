import { type NextRequest, NextResponse } from "next/server"
import { getSiteById, getLastReportRemainingBySite, initializeDatabase } from "@/lib/database"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase()
    const { id } = await params
    const siteId = parseInt(id, 10)
    if (isNaN(siteId)) {
      return NextResponse.json({ error: "Invalid site id" }, { status: 400 })
    }
    const site = await getSiteById(siteId)
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const last = await getLastReportRemainingBySite(siteId)
    return NextResponse.json({
      totalPiles: site.total_piles ?? null,
      lastDate: last?.date ?? null,
      remainingPiles: last?.remainingPiles ?? null,
    })
  } catch (error) {
    console.error("Error fetching last report:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
