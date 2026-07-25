import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getMasrafYerleri, createMasrafYeri } from "@/lib/database"

const PostSchema = z.object({
  ad: z.string().trim().min(1).max(255),
  tip: z.string().trim().min(1).max(50),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  try {
    await initializeDatabase()
    const all = request.nextUrl.searchParams.get("all") === "1"
    const list = await getMasrafYerleri(!all)
    return NextResponse.json(list)
  } catch (error) {
    console.error("Masraf yerleri GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  try {
    const parsed = PostSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "ad ve tip gerekli." }, { status: 400 })
    await initializeDatabase()
    const row = await createMasrafYeri(parsed.data)
    return NextResponse.json(row)
  } catch (error: unknown) {
    console.error("Masraf yeri POST error:", error)
    const msg = String((error as { code?: string })?.code || "")
    if (msg === "23505") return NextResponse.json({ error: "Bu masraf yeri zaten var." }, { status: 409 })
    return NextResponse.json({ error: "Eklenemedi." }, { status: 500 })
  }
}
