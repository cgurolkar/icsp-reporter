/**
 * Tarayıcıda fotoğrafı yeniden boyutlandırıp WebP (destek yoksa JPEG) data URL üretir.
 * Rapor / operatör / envanter / personel formlarında kullanılır.
 */

const MAX_SIDE = 1920
const WEBP_QUALITY = 0.82
const JPEG_QUALITY = 0.85

export async function compressImageFileToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    let w = img.naturalWidth
    let h = img.naturalHeight
    if (w <= 0 || h <= 0) throw new Error("Geçersiz görüntü boyutu")
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
    w = Math.round(w * scale)
    h = Math.round(h * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas kullanılamıyor")
    ctx.drawImage(img, 0, 0, w, h)
    const webp = canvas.toDataURL("image/webp", WEBP_QUALITY)
    if (webp.startsWith("data:image/webp")) return webp
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Görüntü yüklenemedi"))
    img.src = src
  })
}

/**
 * Mevcut data URL (JPEG/PNG/WebP) → yeniden boyutlandırılmış WebP veya JPEG.
 * Taslak / eski büyük görselleri gönderimden hemen önce küçültmek için.
 */
export async function compressDataUrlToWebpOrJpeg(dataUrl: string, maxSide = MAX_SIDE, webpQ = WEBP_QUALITY, jpegQ = JPEG_QUALITY): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl
  const img = await loadImage(dataUrl)
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (w <= 0 || h <= 0) throw new Error("Geçersiz görüntü boyutu")
  const scale = Math.min(1, maxSide / Math.max(w, h))
  w = Math.round(w * scale)
  h = Math.round(h * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas kullanılamıyor")
  ctx.drawImage(img, 0, 0, w, h)
  const webp = canvas.toDataURL("image/webp", webpQ)
  if (webp.startsWith("data:image/webp")) return webp
  return canvas.toDataURL("image/jpeg", jpegQ)
}

const LARGE_DATA_URL_CHARS = 380_000

/** Günlük rapor görselleri çok büyükse gönderim öncesi sıkıştırır. */
export async function shrinkDailyInfoImagesForSubmit<T extends { dailyInfo?: { images?: string[]; image1?: string; image2?: string; notes?: string; nextDayPlannedWork?: string } }>(form: T): Promise<T> {
  const daily = form.dailyInfo
  if (!daily) return form
  const raw: string[] =
    Array.isArray(daily.images) && daily.images.length > 0
      ? daily.images.filter((s): s is string => typeof s === "string" && s.startsWith("data:"))
      : [daily.image1, daily.image2].filter((s): s is string => typeof s === "string" && s.startsWith("data:"))
  if (raw.length === 0) return form
  const next: string[] = []
  for (const url of raw) {
    if (url.length < LARGE_DATA_URL_CHARS) {
      next.push(url)
      continue
    }
    try {
      next.push(await compressDataUrlToWebpOrJpeg(url, 1600, 0.78, 0.82))
    } catch {
      next.push(url)
    }
  }
  return {
    ...form,
    dailyInfo: {
      ...daily,
      images: next,
      image1: next[0] ?? "",
      image2: next[1] ?? "",
    },
  }
}
