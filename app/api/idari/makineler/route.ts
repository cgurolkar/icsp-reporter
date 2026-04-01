import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getMachines, createMachine } from "@/lib/database"

const MACHINE_TYPES = ["Kazık Makinesi", "Ekskavatör", "Vinç", "Loader", "Beton Pompası", "Jeneratör", "Kompresör", "Araç", "Diğer"]

const MachineSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  machine_type: z.string().max(100).default("Kazık Makinesi"),
  marka: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  plaka_no: z.string().max(50).optional().nullable(),
  seri_no: z.string().max(100).optional().nullable(),
  status: z.enum(["aktif", "bakimda", "hurda", "depoda"]).default("aktif"),
  current_site_id: z.number({ coerce: true }).int().positive().optional().nullable(),
  notlar: z.string().max(1000).optional().nullable(),
})

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  await initializeDatabase()
  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get("siteId") ? parseInt(searchParams.get("siteId")!, 10) : null
  const status = searchParams.get("status") || null

  try {
    const machines = await getMachines({ siteId: siteId && !isNaN(siteId) ? siteId : null, status })
    return NextResponse.json(machines)
  } catch (err) {
    console.error("GET /api/idari/makineler error:", err)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 }) }
  const parsed = MachineSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Geçersiz." }, { status: 400 })

  await initializeDatabase()
  try {
    const id = await createMachine(parsed.data)
    return NextResponse.json({ id })
  } catch (err) {
    console.error("POST /api/idari/makineler error:", err)
    return NextResponse.json({ error: "Makine oluşturulamadı." }, { status: 500 })
  }
}
