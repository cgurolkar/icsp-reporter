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
    const totalPiles = site.total_piles ?? null
    let remainingPiles = last?.remainingPiles ?? null
    if (remainingPiles != null && String(remainingPiles).trim() === "") remainingPiles = null
    if (remainingPiles == null && totalPiles != null && site.is_ongoing && site.initial_piles_done != null && !last) {
      remainingPiles = String(Number(totalPiles) - Number(site.initial_piles_done))
    }
    return NextResponse.json({
      totalPiles,
      lastDate: last?.date ?? null,
      remainingPiles,
      projectStartDate: site.project_start_date ?? null,
      isOngoing: site.is_ongoing === true,
      initialPilesDone: site.initial_piles_done ?? null,
      initialEmptyBorehole: site.initial_empty_borehole ?? null,
      iqd_per_usd: site.iqd_per_usd != null ? Number(site.iqd_per_usd) : 1320,
    })
  } catch (error) {
    console.error("Error fetching last report:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
