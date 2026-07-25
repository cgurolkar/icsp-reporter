import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getHarcamaAltKalemler, createHarcamaAltKalem } from "@/lib/database"

const PostSchema = z.object({
  kalemId: z.number({ coerce: true }).int().positive(),
  ad: z.string().trim().min(1).max(255),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  try {
    await initializeDatabase()
    const kalemIdParam = request.nextUrl.searchParams.get("kalemId")
    const all = request.nextUrl.searchParams.get("all") === "1"
    const kalemId = kalemIdParam ? parseInt(kalemIdParam, 10) : undefined
    const list = await getHarcamaAltKalemler({
      kalemId: kalemId && !Number.isNaN(kalemId) ? kalemId : undefined,
      aktifOnly: !all,
    })
    return NextResponse.json(list)
  } catch (error) {
    console.error("Alt kalem GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  try {
    const parsed = PostSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "kalemId ve ad gerekli." }, { status: 400 })
    await initializeDatabase()
    const row = await createHarcamaAltKalem({ kalem_id: parsed.data.kalemId, ad: parsed.data.ad })
    return NextResponse.json(row)
  } catch (error: unknown) {
    console.error("Alt kalem POST error:", error)
    const msg = String((error as { code?: string })?.code || "")
    if (msg === "23505") return NextResponse.json({ error: "Bu alt kalem zaten var." }, { status: 409 })
    return NextResponse.json({ error: "Eklenemedi." }, { status: 500 })
  }
}
