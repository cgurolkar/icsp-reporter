import { type NextRequest, NextResponse } from "next/server"
import {
  getSiteById,
  getLastReportRemainingBySite,
  initializeDatabase,
  getSitePileRates,
  getCumulativePileCounts,
} from "@/lib/database"
import { publicPileRateOptions } from "@/lib/hakedis"

/** pg Date → yerel YYYY-MM-DD. String(date).slice(0,10) "Wed Oct 06" üretir ve sorguyu bozar. */
function reportDateOnly(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, "0")
    const d = String(v.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  const s = String(v ?? "").trim()
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ""
}

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
    let concreteCompletedToDate: number | null = null
    const lastDate = reportDateOnly(last?.date)
    try {
      if (lastDate) {
        const piles = await getCumulativePileCounts(siteId, lastDate)
        concreteCompletedToDate = piles.concrete
        if (totalPiles != null) {
          remainingPiles = String(Math.max(0, Number(totalPiles) - piles.concrete))
        }
      } else if (totalPiles != null && site.is_ongoing) {
        const today = reportDateOnly(new Date())
        const piles = await getCumulativePileCounts(siteId, today)
        if (piles.concrete > 0) {
          concreteCompletedToDate = piles.concrete
          remainingPiles = String(Math.max(0, Number(totalPiles) - piles.concrete))
        } else if (site.initial_piles_done != null) {
          concreteCompletedToDate = Number(site.initial_piles_done) || 0
          remainingPiles = String(Number(totalPiles) - concreteCompletedToDate)
        }
      }
    } catch (cumErr) {
      console.error("last-report cumulative piles:", cumErr)
    }
    const rates = await getSitePileRates(siteId, { activeOnly: true })
    return NextResponse.json({
      totalPiles,
      lastDate: lastDate || null,
      remainingPiles,
      projectStartDate: site.project_start_date ?? null,
      isOngoing: site.is_ongoing === true,
      initialPilesDone: site.initial_piles_done ?? null,
      concreteCompletedToDate,
      initialEmptyBorehole: site.initial_empty_borehole ?? null,
      iqd_per_usd: site.iqd_per_usd != null ? Number(site.iqd_per_usd) : 1320,
      /** Çap seçenekleri — birim fiyatlar dahil değil (form için) */
      pileRates: publicPileRateOptions(rates),
    })
  } catch (error) {
    console.error("Error fetching last report:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
