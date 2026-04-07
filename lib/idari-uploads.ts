import path from "path"
import fs from "fs/promises"

export const IDARI_BELGE_WEB_PREFIX = "/uploads/idari/belgeler/"

/**
 * DB'deki /uploads/idari/belgeler/... yollarını güvenli biçimde disk yoluna çevirir.
 */
export function resolveIdariBelgeFilePath(dosya_yolu: string | null | undefined): string | null {
  if (!dosya_yolu || typeof dosya_yolu !== "string") return null
  const t = dosya_yolu.trim()
  if (!t.startsWith(IDARI_BELGE_WEB_PREFIX)) return null
  const base = path.basename(t)
  if (!base || base === "." || base === "..") return null
  const dir = path.join(process.cwd(), "public", "uploads", "idari", "belgeler")
  const full = path.join(dir, base)
  const resolvedDir = path.resolve(dir)
  const resolvedFile = path.resolve(full)
  if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) return null
  return resolvedFile
}

export function mimeForIdariFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".pdf") return "application/pdf"
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".gif") return "image/gif"
  if (ext === ".webp") return "image/webp"
  return "application/octet-stream"
}

export async function readIdariFile(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}
