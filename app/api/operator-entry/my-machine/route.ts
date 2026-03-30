import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { initializeDatabase, getOperatorMachinesForSite } from "@/lib/database"

/**
 * GET /api/operator-entry/my-machine?siteId=X
 * Returns the DB machines assigned to the current operator at the given site.
 * Falls back to all active machines at the site if no specific assignment.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : NaN

  if (!Number.isInteger(siteId) || siteId < 1) {
    return NextResponse.json({ error: "Geçerli siteId gerekli." }, { status: 400 })
  }

  try {
    await initializeDatabase()
    const machines = await getOperatorMachinesForSite(session.id, siteId)
    return NextResponse.json(machines)
  } catch (error) {
    console.error("my-machine GET error:", error)
    return NextResponse.json({ error: "Makine bilgisi alınamadı." }, { status: 500 })
  }
}
