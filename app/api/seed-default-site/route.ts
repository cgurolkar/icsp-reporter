import { NextResponse } from "next/server"
import { initializeDatabase, getAllSites, createSite } from "@/lib/database"

export const dynamic = "force-dynamic"

const DEFAULT_SITE = {
  name: "North Light Shaqlawa",
  code: "ICSP001",
  emailList: [] as string[],
}

/**
 * GET: Varsayılan şantiye yoksa ekler (tek seferlik). Tarayıcıdan /api/seed-default-site çağrılabilir.
 */
export async function GET() {
  try {
    await initializeDatabase()
    const existing = await getAllSites()
    const hasDefault = existing.some((s: any) => s.code === DEFAULT_SITE.code)
    if (hasDefault) {
      return NextResponse.json({
        message: "Varsayılan şantiye zaten var.",
        site: existing.find((s: any) => s.code === DEFAULT_SITE.code),
      })
    }
    const site = await createSite(DEFAULT_SITE)
    return NextResponse.json({
      message: "Varsayılan şantiye eklendi.",
      site,
    })
  } catch (error) {
    console.error("Seed default site error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: "Eklenemedi: " + msg },
      { status: 500 }
    )
  }
}
