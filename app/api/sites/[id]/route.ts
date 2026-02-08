import { type NextRequest, NextResponse } from "next/server"
import { getSiteById, updateSite, initializeDatabase } from "@/lib/database"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const siteId = parseInt(id, 10)
    if (isNaN(siteId)) {
      return NextResponse.json({ error: "Invalid site id" }, { status: 400 })
    }
    const site = await getSiteById(siteId)
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json(site)
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
    await initializeDatabase()
    const { id } = await params
    const siteId = parseInt(id, 10)
    if (isNaN(siteId)) {
      return NextResponse.json({ error: "Invalid site id" }, { status: 400 })
    }
    const body = await request.json()
    const { name, code, emailList, isActive, totalPiles, region, city, country, authorizedPerson, employer, projectStartDate, isOngoing, initialPilesDone } = body
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
    })
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json(site)
  } catch (error) {
    console.error("Error updating site:", error)
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 })
  }
}
