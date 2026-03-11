import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { getSiteById, getUsersByIds } from "@/lib/database"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) {
    return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  }
  try {
    const { id } = await params
    const siteId = parseInt(id, 10)
    if (isNaN(siteId)) {
      return NextResponse.json({ error: "Invalid site id" }, { status: 400 })
    }
    const site = await getSiteById(siteId)
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const ids = Array.isArray((site as any).assigned_operator_ids) ? (site as any).assigned_operator_ids.map((x: unknown) => Number(x)).filter((n: number) => !Number.isNaN(n)) : []
    const users = ids.length ? await getUsersByIds(ids) : []
    return NextResponse.json(users)
  } catch (error) {
    console.error("Error fetching assigned operators:", error)
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
