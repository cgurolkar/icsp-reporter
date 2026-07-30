import { type NextRequest, NextResponse } from "next/server"
import { getSiteById, updateSite, initializeDatabase, softDeleteSite, releaseMachinesFromSite, getSitePileRates, replaceSitePileRates } from "@/lib/database"
import { canAccessAdmin, canAccessSite, getSessionFromRequest } from "@/lib/auth"
import { publicPileRateOptions } from "@/lib/hakedis"
import { normalizeSiteCurrency } from "@/lib/site-currency"

function parsePileRatesBody(body: unknown): Array<{
  diameterMm: number
  label?: string | null
  pricePrimary: number
  priceSecondary?: number | null
  sortOrder?: number
  isActive?: boolean
}> | null {
  if (!body || typeof body !== "object") return null
  const pileRates = (body as { pileRates?: unknown }).pileRates
  if (!Array.isArray(pileRates)) return null
  return pileRates
    .map((row, idx) => {
      const r = row as Record<string, unknown>
      return {
        diameterMm: Number(r.diameterMm ?? r.diameter_mm),
        label: r.label != null ? String(r.label) : null,
        pricePrimary: Number(r.pricePrimary ?? r.price_primary),
        priceSecondary:
          r.priceSecondary != null && String(r.priceSecondary).trim() !== ""
            ? Number(r.priceSecondary)
            : r.price_secondary != null && String(r.price_secondary).trim() !== ""
              ? Number(r.price_secondary)
              : null,
        sortOrder: idx,
        isActive: r.isActive !== false,
      }
    })
    .filter((r) => Number.isFinite(r.diameterMm) && r.diameterMm > 0 && Number.isFinite(r.pricePrimary) && r.pricePrimary >= 0)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
    const { id } = await params
    const siteId = parseInt(id, 10)
    if (isNaN(siteId)) {
      return NextResponse.json({ error: "Invalid site id" }, { status: 400 })
    }
    if (!canAccessSite(session, siteId)) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    }
    await initializeDatabase()
    const site = await getSiteById(siteId)
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const rates = await getSitePileRates(siteId, { activeOnly: false })
    if (session.role === "super_admin") {
      return NextResponse.json({
        ...site,
        pile_rates: rates,
      })
    }
    const { contract_unit_price, ...rest } = site as Record<string, unknown>
    return NextResponse.json({
      ...rest,
      pile_rates: publicPileRateOptions(rates),
    })
  } catch (error) {
    console.error("Error fetching site:", error)
    return NextResponse.json({ error: "Failed to fetch site" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
    if (!canAccessAdmin(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    await initializeDatabase()
    const { id } = await params
    const siteId = parseInt(id, 10)
    if (isNaN(siteId)) {
      return NextResponse.json({ error: "Invalid site id" }, { status: 400 })
    }
    const body = await request.json()
    const { name, code, emailList, isActive, totalPiles, region, city, country, authorizedPerson, employer, projectStartDate, isOngoing, initialPilesDone, initialEmptyBorehole, assignedMachineIds, assignedOperatorIds, assignedMachineOperators, budget, timezone, contractUnitPrice, iqdPerUsd, billingCurrency, initialConcreteMeters, releaseMachinesFromSite: releaseMachinesFlag } = body
    const site = await updateSite(siteId, {
      ...(name !== undefined && { name }),
      ...(code !== undefined && { code }),
      ...(emailList !== undefined && { emailList: Array.isArray(emailList) ? emailList : [] }),
      ...(isActive !== undefined && { isActive }),
      ...(totalPiles !== undefined && { totalPiles: typeof totalPiles === "number" ? totalPiles : parseInt(String(totalPiles), 10) || null }),
      ...(region !== undefined && { region: region != null ? String(region).trim() || null : undefined }),
      ...(city !== undefined && { city: city != null ? String(city).trim() || null : undefined }),
      ...(country !== undefined && { country: country != null ? String(country).trim() || null : undefined }),
      ...(authorizedPerson !== undefined && { authorizedPerson: authorizedPerson != null ? String(authorizedPerson).trim() || null : undefined }),
      ...(employer !== undefined && { employer: employer != null ? String(employer).trim() || null : undefined }),
      ...(projectStartDate !== undefined && { projectStartDate: projectStartDate != null ? String(projectStartDate).trim() || null : undefined }),
      ...(isOngoing !== undefined && { isOngoing: isOngoing === true }),
      ...(initialPilesDone !== undefined && { initialPilesDone: initialPilesDone != null ? (typeof initialPilesDone === "number" ? initialPilesDone : parseInt(String(initialPilesDone), 10) || null) : null }),
      ...(initialEmptyBorehole !== undefined && { initialEmptyBorehole: initialEmptyBorehole != null ? (typeof initialEmptyBorehole === "number" ? initialEmptyBorehole : parseInt(String(initialEmptyBorehole), 10) || null) : null }),
      ...(initialConcreteMeters !== undefined && {
        initialConcreteMeters:
          initialConcreteMeters != null && String(initialConcreteMeters).trim() !== "" && !Number.isNaN(Number(initialConcreteMeters))
            ? Number(initialConcreteMeters)
            : null,
      }),
      ...(assignedMachineIds !== undefined && { assignedMachineIds: Array.isArray(assignedMachineIds) ? assignedMachineIds.filter((x: unknown) => typeof x === "string") : [] }),
      ...(assignedOperatorIds !== undefined && { assignedOperatorIds: Array.isArray(assignedOperatorIds) ? assignedOperatorIds.map((x: unknown) => typeof x === "number" ? x : parseInt(String(x), 10)).filter((n: number) => !Number.isNaN(n)) : [] }),
      ...(assignedMachineOperators !== undefined && { assignedMachineOperators: Array.isArray(assignedMachineOperators) ? assignedMachineOperators.filter((x: unknown) => x != null && typeof (x as any).machineId === "string" && typeof (x as any).personelId === "number") : [] }),
      ...(budget !== undefined && { budget: budget != null && !Number.isNaN(Number(budget)) ? Number(budget) : null }),
      ...(timezone !== undefined && { timezone: timezone != null ? String(timezone).trim() || null : undefined }),
      ...(session.role === "super_admin" && contractUnitPrice !== undefined && { contractUnitPrice: contractUnitPrice != null && !Number.isNaN(Number(contractUnitPrice)) ? Number(contractUnitPrice) : null }),
      ...(session.role === "super_admin" && billingCurrency !== undefined && { billingCurrency: normalizeSiteCurrency(billingCurrency) }),
      ...(iqdPerUsd !== undefined &&
        iqdPerUsd != null &&
        !Number.isNaN(Number(iqdPerUsd)) &&
        Number(iqdPerUsd) > 0 && { iqdPerUsd: Number(iqdPerUsd) }),
    })
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    let pile_rates = await getSitePileRates(siteId, { activeOnly: false })
    if (session.role === "super_admin" && Array.isArray(body.pileRates)) {
      const parsed = parsePileRatesBody(body)
      pile_rates = await replaceSitePileRates(siteId, parsed ?? [])
    }
    if (isActive === false && releaseMachinesFlag === true) {
      await releaseMachinesFromSite(siteId)
    }
    if (session.role === "super_admin") return NextResponse.json({ ...site, pile_rates })
    const { contract_unit_price, ...rest } = site as Record<string, unknown>
    return NextResponse.json({ ...rest, pile_rates: publicPileRateOptions(pile_rates) })
  } catch (error) {
    console.error("Error updating site:", error)
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
    if (!canAccessAdmin(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
    await initializeDatabase()
    const { id } = await params
    const siteId = parseInt(id, 10)
    if (isNaN(siteId)) return NextResponse.json({ error: "Invalid site id" }, { status: 400 })
    let releaseMachines = true
    try {
      const body = await request.json()
      if (body && typeof body === "object" && body.releaseMachines === false) releaseMachines = false
    } catch {
      /* body optional */
    }
    const ok = await softDeleteSite(siteId, releaseMachines)
    if (!ok) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting site:", error)
    return NextResponse.json({ error: "Failed to deactivate site" }, { status: 500 })
  }
}
