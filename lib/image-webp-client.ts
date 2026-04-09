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
