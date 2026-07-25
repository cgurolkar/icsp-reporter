import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, updateHarcamaAltKalem } from "@/lib/database"

const PatchSchema = z.object({
  kalemId: z.number({ coerce: true }).int().positive().optional(),
  ad: z.string().trim().min(1).max(255).optional(),
  aktif: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (!id || Number.isNaN(id)) return NextResponse.json({ error: "Geçersiz id." }, { status: 400 })
  try {
    const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: "Geçersiz veri." }, { status: 400 })
    await initializeDatabase()
    const row = await updateHarcamaAltKalem(id, {
      kalem_id: parsed.data.kalemId,
      ad: parsed.data.ad,
      aktif: parsed.data.aktif,
    })
    if (!row) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 })
    return NextResponse.json(row)
  } catch (error) {
    console.error("Alt kalem PATCH error:", error)
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 })
  }
}
