import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getIslemler, createIslem } from "@/lib/database"

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
    const body = await request.json().catch(() => ({}))
    const site_id = body?.siteId != null ? Number(body.siteId) : NaN
    const kategori_id = body?.kategoriId != null ? Number(body.kategoriId) : NaN
    const tutar = body?.tutar != null ? Number(body.tutar) : NaN
    const islem_tarihi = body?.islem_tarihi ? String(body.islem_tarihi).trim().slice(0, 10) : ""
    const odeme_kaynagi = body?.odeme_kaynagi === "Merkez_Banka" ? "Merkez_Banka" : "Santiye_Kasa"
    const aciklama = body?.aciklama ? String(body.aciklama).trim() : null
    if (!site_id || !kategori_id || Number.isNaN(tutar) || !islem_tarihi) {
      return NextResponse.json({ error: "siteId, kategoriId, tutar ve islem_tarihi gerekli." }, { status: 400 })
    }
    let evrak_yolu: string | null = null
    if (body?.evrak_base64) {
      evrak_yolu = saveEvrak(body.evrak_base64, `islem_${site_id}_${Date.now()}`)
    }
    await initializeDatabase()
    const id = await createIslem({
      site_id,
      kategori_id,
      tutar,
      islem_tarihi,
      odeme_kaynagi,
      aciklama,
      evrak_yolu,
      olusturan_id: session.userId,
    })
    return NextResponse.json({ id })
  } catch (error) {
    console.error("Islemler POST error:", error)
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 })
  }
}
