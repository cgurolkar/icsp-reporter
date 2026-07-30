/**
 * GET /api/admin/hakedis-summary — super_admin: aktif şantiyelerde seçilen güne kadar kümülatif hakediş
 */
import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { getAllSites, getCumulativeHakedisBreakdown, initializeDatabase } from "@/lib/database"
import { formatMoney, normalizeSiteCurrency } from "@/lib/site-currency"

export const dynamic = "force-dynamic"

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (session.role !== "super_admin") return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const rawDate = (searchParams.get("date") || "").trim().slice(0, 10)
    const asOfDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayIsoDate()

    const sites = await getAllSites()
    const rows = await Promise.all(
      sites.map(async (site: { id: number; name: string; code: string }) => {
        const breakdown = await getCumulativeHakedisBreakdown(Number(site.id), asOfDate)
        const currency = normalizeSiteCurrency(breakdown.currency)
        return {
          id: Number(site.id),
          name: String(site.name ?? ""),
          code: String(site.code ?? ""),
          currency,
          totalMeters: Number(breakdown.totalMeters) || 0,
          totalAmount: Number(breakdown.totalAmount) || 0,
          usedRates: breakdown.usedRates === true,
          amountFormatted: formatMoney(Number(breakdown.totalAmount) || 0, currency),
          lines: (breakdown.lines || []).map((l) => ({
            diameterMm: l.diameterMm,
            label: l.label,
            priceTier: l.priceTier,
            unitPrice: l.unitPrice,
            meters: l.meters,
            amount: l.amount,
          })),
        }
      }),
    )

    const totalsByCurrency: Record<string, { totalAmount: number; totalMeters: number; siteCount: number }> = {}
    for (const r of rows) {
      const c = r.currency
      if (!totalsByCurrency[c]) totalsByCurrency[c] = { totalAmount: 0, totalMeters: 0, siteCount: 0 }
      totalsByCurrency[c].totalAmount += r.totalAmount
      totalsByCurrency[c].totalMeters += r.totalMeters
      totalsByCurrency[c].siteCount += 1
    }

    return NextResponse.json({
      asOfDate,
      siteCount: rows.length,
      sites: rows,
      totalsByCurrency: Object.entries(totalsByCurrency).map(([currency, t]) => ({
        currency,
        totalAmount: t.totalAmount,
        totalMeters: t.totalMeters,
        siteCount: t.siteCount,
        amountFormatted: formatMoney(t.totalAmount, currency),
      })),
    })
  } catch (e) {
    console.error("GET /api/admin/hakedis-summary:", e)
    return NextResponse.json({ error: "Hakediş özeti alınamadı." }, { status: 500 })
  }
}
