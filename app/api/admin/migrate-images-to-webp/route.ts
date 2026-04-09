import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessAdmin } from "@/lib/auth"
import pool, { initializeDatabase } from "@/lib/database"
import {
  migrateWorkReportsImagesBatch,
  migrateOperatorEntriesImagesBatch,
  migratePersonelFotoBatch,
  migrateEnvanterFotoBatch,
} from "@/lib/migrate-inline-images-webp"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 120

/**
 * POST — Veritabanındaki data:image/... (WebP olmayan) satır içi fotoğrafları WebP’ye çevirir.
 * Tek seferde sınırlı kayıt işler; kalanlar için isteği tekrarlayın.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessAdmin(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  let limit = DEFAULT_LIMIT
  try {
    const body = await request.json().catch(() => ({}))
    const raw = typeof body?.limit === "number" ? body.limit : parseInt(String(body?.limit ?? ""), 10)
    if (Number.isFinite(raw) && raw > 0) limit = Math.min(Math.floor(raw), MAX_LIMIT)
  } catch {
    /* default */
  }

  await initializeDatabase()
  const client = await pool.connect()
  try {
    const workReports = await migrateWorkReportsImagesBatch(client, limit)
    const operatorEntries = await migrateOperatorEntriesImagesBatch(client, limit)
    const personeller = await migratePersonelFotoBatch(client, limit)
    const envanter = await migrateEnvanterFotoBatch(client, limit)
    const allErrors = [
      ...workReports.errors,
      ...operatorEntries.errors,
      ...personeller.errors,
      ...envanter.errors,
    ]
    return NextResponse.json({
      limit,
      workReports,
      operatorEntries,
      personeller,
      envanter,
      totalUpdated:
        workReports.updated + operatorEntries.updated + personeller.updated + envanter.updated,
      errors: allErrors,
    })
  } catch (e) {
    console.error("migrate-images-to-webp:", e)
    return NextResponse.json(
      { error: "Migrasyon başarısız.", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
