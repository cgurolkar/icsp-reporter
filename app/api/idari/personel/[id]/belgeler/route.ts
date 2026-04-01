import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getPersonelBelgeleri, addPersonelBelge, updatePersonel } from "@/lib/database"

const UPLOAD_DIR = "public/uploads/idari/belgeler"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function saveBelge(base64: string, personelId: number, belgeTipi: string): string | null {
  if (!base64 || !base64.startsWith("data:")) return null
  const match = base64.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const ext = match[1].includes("pdf") ? "pdf" : "jpg"
  const buf = Buffer.from(match[2], "base64")
  if (buf.length > MAX_FILE_SIZE) return null
  const dir = path.join(process.cwd(), UPLOAD_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const name = `${personelId}_${belgeTipi}_${Date.now()}.${ext}`
  const fullPath = path.join(dir, name)
  fs.writeFileSync(fullPath, buf)
  return `/uploads/idari/belgeler/${name}`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  const personelId = parseInt((await params).id, 10)
  if (Number.isNaN(personelId)) return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })
  try {
    await initializeDatabase()
    const list = await getPersonelBelgeleri(personelId)
    return NextResponse.json(list)
  } catch (error) {
    console.error("Belgeler GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role)) return NextResponse.json({ error: "Belge yükleme yetkiniz yok." }, { status: 403 })
  const personelId = parseInt((await params).id, 10)
  if (Number.isNaN(personelId)) return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })
  try {
    const body = await request.json().catch(() => ({}))
    const belge_tipi = String(body?.belge_tipi ?? "").trim()
    const gecerlilik_tarihi = body?.gecerlilik_tarihi ? String(body.gecerlilik_tarihi).slice(0, 10) : null
    if (!belge_tipi) return NextResponse.json({ error: "belge_tipi gerekli." }, { status: 400 })
    let dosya_yolu: string
    if (body?.evrak_base64) {
      const saved = saveBelge(body.evrak_base64, personelId, belge_tipi)
      if (!saved) return NextResponse.json({ error: "Dosya kaydedilemedi (boyut veya format)." }, { status: 400 })
      dosya_yolu = saved
    } else {
      dosya_yolu = body?.dosya_yolu ? String(body.dosya_yolu) : ""
      if (!dosya_yolu) return NextResponse.json({ error: "evrak_base64 veya dosya_yolu gerekli." }, { status: 400 })
    }
    await initializeDatabase()
    const id = await addPersonelBelge({ personel_id: personelId, belge_tipi, dosya_yolu, gecerlilik_tarihi })
    if (belge_tipi === "personel_foto") await updatePersonel(personelId, { foto_yolu: dosya_yolu })
    return NextResponse.json({ id })
  } catch (error) {
    console.error("Belgeler POST error:", error)
    return NextResponse.json({ error: "Eklenemedi." }, { status: 500 })
  }
}
