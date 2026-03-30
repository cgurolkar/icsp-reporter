import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionFromRequest, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, updateMachine, upsertMachineOperators } from "@/lib/database"
import pool from "@/lib/database"

const UpdateSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  machine_type: z.string().max(100).optional(),
  marka: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  plaka_no: z.string().max(50).optional().nullable(),
  seri_no: z.string().max(100).optional().nullable(),
  status: z.enum(["aktif", "bakimda", "hurda", "depoda"]).optional(),
  current_site_id: z.number({ coerce: true }).int().positive().optional().nullable(),
  notlar: z.string().max(1000).optional().nullable(),
  operator_personel_ids: z.array(z.number({ coerce: true }).int().positive()).optional(),
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 }) }
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Geçersiz." }, { status: 400 })

  await initializeDatabase()
  try {
    const { operator_personel_ids, ...machineData } = parsed.data
    await updateMachine(id, machineData)
    if (operator_personel_ids !== undefined) {
      await upsertMachineOperators(id, operator_personel_ids)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("PUT /api/idari/makineler/[id] error:", err)
    return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 })

  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })

  await initializeDatabase()
  try {
    const client = await pool.connect()
    try {
      await client.query(`DELETE FROM machines WHERE id = $1`, [id])
    } finally {
      client.release()
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("DELETE /api/idari/makineler/[id] error:", err)
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 })
  }
}
