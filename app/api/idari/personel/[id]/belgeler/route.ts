import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, getPersonelBelgeleri, addPersonelBelge, updatePersonel } from "@/lib/database"

export const runtime = "nodejs"

const UPLOAD_DIR = "public/uploads/idari/belgeler"
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

function safeBelgeTipiSegment(belgeTipi: string): string {
  const s = belgeTipi.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)
  return s || "belge"
}

function extFromMimeOrName(mime: string, fileName: string): string {
  const lower = mime.toLowerCase()
  if (lower.includes("pdf")) return "pdf"
  if (lower.includes("png")) return "png"
  if (lower.includes("webp")) return "webp"
  if (lower.includes("gif")) return "gif"
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  const e = m?.[1]
  if (e === "pdf" || e === "png" || e === "webp" || e === "gif") return e
  if (e === "jpeg" || e === "jpg") return "jpg"
  return "jpg"
}

function saveBelgeBuffer(buf: Buffer, personelId: number, belgeTipi: string, ext: string): string | null {
  if (buf.length > MAX_FILE_SIZE || buf.length === 0) return null
  const dir = path.join(process.cwd(), UPLOAD_DIR)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const seg = safeBelgeTipiSegment(belgeTipi)
  const name = `${personelId}_${seg}_${Date.now()}.${ext}`
  const fullPath = path.join(dir, name)
  fs.writeFileSync(fullPath, buf)
  return `/uploads/idari/belgeler/${name}`
}

/** Eski istemciler / küçük dosyalar için (base64 JSON gövdesi ~1MB sınırına takılabilir) */
function saveBelge(base64: string, personelId: number, belgeTipi: string): string | null {
  if (!base64 || !base64.startsWith("data:")) return null
  const match = base64.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  const ext = match[1].includes("pdf") ? "pdf" : "jpg"
  const buf = Buffer.from(match[2], "base64")
  return saveBelgeBuffer(buf, personelId, belgeTipi, ext)
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
    const contentType = request.headers.get("content-type") || ""
    let belge_tipi: string
    let gecerlilik_tarihi: string | null
    let dosya_yolu: string

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      belge_tipi = String(form.get("belge_tipi") ?? "").trim()
      const gRaw = form.get("gecerlilik_tarihi")
      const gStr = gRaw != null ? String(gRaw).trim() : ""
      gecerlilik_tarihi = gStr ? gStr.slice(0, 10) : null
      const file = form.get("file")
      if (!belge_tipi) return NextResponse.json({ error: "belge_tipi gerekli." }, { status: 400 })
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Dosya 5MB'dan küçük olmalı." }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const ext = extFromMimeOrName(file.type || "", file.name || "")
      const saved = saveBelgeBuffer(buf, personelId, belge_tipi, ext)
      if (!saved) return NextResponse.json({ error: "Dosya kaydedilemedi (boyut veya format)." }, { status: 400 })
      dosya_yolu = saved
    } else {
      const body = await request.json().catch(() => ({}))
      belge_tipi = String(body?.belge_tipi ?? "").trim()
      gecerlilik_tarihi = body?.gecerlilik_tarihi ? String(body.gecerlilik_tarihi).slice(0, 10) : null
      if (!belge_tipi) return NextResponse.json({ error: "belge_tipi gerekli." }, { status: 400 })
      if (body?.evrak_base64) {
        const saved = saveBelge(body.evrak_base64, personelId, belge_tipi)
        if (!saved) return NextResponse.json({ error: "Dosya kaydedilemedi (boyut veya format)." }, { status: 400 })
        dosya_yolu = saved
      } else {
        dosya_yolu = body?.dosya_yolu ? String(body.dosya_yolu) : ""
        if (!dosya_yolu) return NextResponse.json({ error: "evrak_base64 veya dosya_yolu gerekli." }, { status: 400 })
      }
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
