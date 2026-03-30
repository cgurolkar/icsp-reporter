import { randomBytes } from "crypto"
import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"

const MAX_BYTES = 2 * 1024 * 1024

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
}

/**
 * data:image/...;base64,... ise dosyaya yazar, web yolu döner.
 * Aksi halde (http(s), /uploads/..., boş) değeri aynen döner.
 */
export function persistEnvanterPhotoDataUrl(dataUrl: string | null | undefined): string | null {
  if (dataUrl == null) return null
  const trimmed = String(dataUrl).trim()
  if (trimmed === "") return null
  if (!trimmed.startsWith("data:image/")) return trimmed

  const match = /^data:(image\/[\w.+-]+);base64,(.*)$/s.exec(trimmed)
  if (!match) return null
  const mimeRaw = match[1].toLowerCase().split(";")[0].trim()
  const b64 = match[2].replace(/\s/g, "")
  let buf: Buffer
  try {
    buf = Buffer.from(b64, "base64")
  } catch {
    return null
  }
  if (buf.length === 0 || buf.length > MAX_BYTES) return null

  const ext = MIME_TO_EXT[mimeRaw] ?? "png"
  const dir = join(process.cwd(), "public", "uploads", "envanter")
  mkdirSync(dir, { recursive: true })
  const name = `env-${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`
  const abs = join(dir, name)
  writeFileSync(abs, buf)
  return `/uploads/envanter/${name}`
}
