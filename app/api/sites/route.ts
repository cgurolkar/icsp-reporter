import { type NextRequest, NextResponse } from "next/server"
import { getAllSites, getSitesWithReportCount, createSite, initializeDatabase } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    await initializeDatabase()
    const { searchParams } = new URL(request.url)
    const withReportCount = searchParams.get("withReportCount") === "1"
    const sites = withReportCount ? await getSitesWithReportCount() : await getAllSites()
    return NextResponse.json(sites)
  } catch (error) {
    console.error("Error fetching sites:", error)
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    const body = await request.json().catch(() => ({}))
    const name = body.name != null ? String(body.name).trim() : ""
    const code = body.code != null ? String(body.code).trim().toUpperCase().replace(/\s/g, "") : ""
    const emailList = Array.isArray(body.emailList) ? body.emailList : []
    const totalPiles = body.totalPiles != null ? (typeof body.totalPiles === "number" ? body.totalPiles : parseInt(String(body.totalPiles), 10) || null) : null
    const region = body.region != null ? String(body.region).trim() || null : null
    const city = body.city != null ? String(body.city).trim() || null : null
    const country = body.country != null ? String(body.country).trim() || null : null
    const latitude = body.latitude != null && body.latitude !== "" ? parseFloat(String(body.latitude)) || null : null
    const longitude = body.longitude != null && body.longitude !== "" ? parseFloat(String(body.longitude)) || null : null
    if (!name || !code) {
      return NextResponse.json({ error: "Şantiye adı ve kod zorunludur." }, { status: 400 })
    }
    const site = await createSite({ name, code, emailList, totalPiles, region, city, country, latitude, longitude })
    return NextResponse.json(site)
  } catch (error: unknown) {
    console.error("Error creating site:", error)
    const msg =
      error && typeof (error as any)?.code === "string" && (error as any).code === "23505"
        ? "Bu kod zaten kullanılıyor. Farklı bir kod girin."
        : error instanceof Error
          ? error.message
          : "Veritabanı hatası. PostgreSQL çalışıyor mu? .env.local doğru mu?"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
