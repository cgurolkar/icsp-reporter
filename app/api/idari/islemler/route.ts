import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { z } from "zod"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getIslemler, createIslem } from "@/lib/database"

const IslemSchema = z.object({
  siteId: z.number({ coerce: true }).int().positive(),
  kategoriId: z.number({ coerce: true }).int().positive(),
  tutar: z.number({ coerce: true }).positive(),
  islem_tarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  odeme_kaynagi: z.enum(["Merkez_Banka", "Santiye_Kasa"]).default("Santiye_Kasa"),
  aciklama: z.string().max(500).optional().nullable(),
  evrak_base64: z.string().optional().nullable(),
})

const UPLOAD_DIR = "public/uploads/idari/evrak"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function saveEvrak(base64: string, prefix: string): string | null {
  if (!base64 || !base64.startsWith("data:")) return null
  const match = base64.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const ext = match[1].includes("pdf") ? "pdf" : "jpg"
  const buf = Buffer.from(match[2], "base64")
  if (buf.length > MAX_FILE_SIZE) return null
  const dir = path.join(process.cwd(), UPLOAD_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const name = `${prefix}_${Date.now()}.${ext}`
  const fullPath = path.join(dir, name)
  fs.writeFileSync(fullPath, buf)
  return `/uploads/idari/evrak/${name}`
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const { searchParams } = new URL(request.url)
  const siteIdParam = searchParams.get("siteId")
  const baslangic = searchParams.get("baslangic")?.trim().slice(0, 10)
  const bitis = searchParams.get("bitis")?.trim().slice(0, 10)
  const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined
  if (session.role !== "admin" && session.role !== "manager" && session.siteId != null && siteId !== session.siteId) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }
  try {
    await initializeDatabase()
    const list = await getIslemler({
      siteId: siteId && !Number.isNaN(siteId) ? siteId : undefined,
      baslangic,
      bitis,
    })
    return NextResponse.json(list)
  } catch (error) {
    console.error("Islemler GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Harcama girişi yetkiniz yok." }, { status: 403 })
  try {
    const rawBody = await request.json().catch(() => ({}))
    const parsed = IslemSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri.", details: parsed.error.flatten() }, { status: 400 })
    }
    const { siteId, kategoriId, tutar, islem_tarihi, odeme_kaynagi, aciklama, evrak_base64 } = parsed.data
    let evrak_yolu: string | null = null
    if (evrak_base64) {
      evrak_yolu = saveEvrak(evrak_base64, `islem_${siteId}_${Date.now()}`)
    }
    await initializeDatabase()
    const id = await createIslem({
      site_id: siteId,
      kategori_id: kategoriId,
      tutar,
      islem_tarihi: islem_tarihi.slice(0, 10),
      odeme_kaynagi,
      aciklama: aciklama ?? null,
      evrak_yolu,
      olusturan_id: session.id,
    })
    return NextResponse.json({ id })
  } catch (error) {
    console.error("Islemler POST error:", error)
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 })
  }
}
