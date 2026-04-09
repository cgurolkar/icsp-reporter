import sharp from "sharp"

const DATA_URL_RE = /^data:image\/([\w.+-]+);base64,([\s\S]+)$/i

/** data:image/...;base64,... ve WebP değilse true */
export function isInlineImageNeedingWebpConversion(s: string | null | undefined): boolean {
  if (s == null || typeof s !== "string") return false
  const t = s.trim()
  if (!t.startsWith("data:image/")) return false
  return !t.startsWith("data:image/webp")
}

/**
 * Base64 data URL → WebP data URL (yeniden boyutlandırma + kalite).
 * WebP girişinde veya parse hatasında null döner; çağıran mevcut değeri korur.
 */
export async function convertImageDataUrlToWebp(
  dataUrl: string,
  opts?: { maxSide?: number; quality?: number }
): Promise<string | null> {
  const maxSide = opts?.maxSide ?? 1920
  const quality = opts?.quality ?? 82
  const trimmed = dataUrl.trim()
  const m = DATA_URL_RE.exec(trimmed)
  if (!m) return null
  const mime = m[1].toLowerCase().split(";")[0].trim()
  if (mime === "webp") return trimmed
  const b64 = m[2].replace(/\s/g, "")
  let buf: Buffer
  try {
    buf = Buffer.from(b64, "base64")
  } catch {
    return null
  }
  if (buf.length === 0) return null
  try {
    const out = await sharp(buf)
      .rotate()
      .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer()
    return `data:image/webp;base64,${out.toString("base64")}`
  } catch {
    return null
  }
}
