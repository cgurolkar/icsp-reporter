/**
 * Envanter Excel şablonu ve içe aktarma.
 * Başlık satırı otomatik tespit edilir; gömülü resimler satır pozisyonuna göre eşleştirilir.
 */

import { execSync } from "child_process"
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx") as typeof import("xlsx")

export const ENVANTER_TEMPLATE_HEADERS = [
  "KOD",
  "MALZEME ADI",
  "AÇIKLAMA",
  "ADET",
  "FOTOĞRAF",
  "FİYAT",
  "YER",
] as const

export interface EnvanterExcelRow {
  kod: string
  malzeme_adi: string
  aciklama?: string | null
  adet?: number | null
  fiyat?: number | null
  yer?: string | null
  fotograf_yolu?: string | null
  /** Excel satırında gerçekten dolu olan sütunlar (içe aktarmada kısmi güncelleme) */
  filledFields: EnvanterExcelField[]
}

export type EnvanterExcelField =
  | "kod"
  | "malzeme_adi"
  | "aciklama"
  | "adet"
  | "fiyat"
  | "yer"
  | "fotograf_yolu"

type EnvanterField = EnvanterExcelField

/**
 * Header normalizasyonu: Turkish İ sorunu, büyük/küçük harf, fazla boşluk.
 */
function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .replace(/\r\n|\n|\r/g, " ")  // satır sonu → boşluk
    .trim()
    .replace(/İ/g, "i")           // Turkish İ (U+0130) → i, toLowerCase'den ÖNCE
    .toLowerCase()
    .replace(/\u0307/g, "")       // combining dot above temizle
    .replace(/\s+/g, " ")
}

const HEADER_ALIASES: Record<string, EnvanterField> = {
  // KOD sütunu
  kod: "kod",
  "malzeme kodu": "kod",
  "stok kodu": "kod",
  "stok no": "kod",
  "malzeme no": "kod",
  "urun kodu": "kod",     // ürün kodu
  "urunkodu": "kod",

  // MALZEME ADI sütunu
  "malzeme adi": "malzeme_adi",  // MALZEME ADI (uppercase normalized)
  "malzeme adı": "malzeme_adi",
  malzeme: "malzeme_adi",
  ad: "malzeme_adi",
  adi: "malzeme_adi",
  adı: "malzeme_adi",
  tanim: "malzeme_adi",
  "tanım": "malzeme_adi",
  "urun adi": "malzeme_adi",

  // AÇIKLAMA sütunu — hem ı hem i varyantı gerekli
  // Büyük I (Latin) → küçük i, ama Turkish ı (dotless) farklı karakter
  // "AÇIKLAMA" → normalize → "açiklama" (i ile), alias "açıklama" (ı ile) eşleşmez → ikisi de lazım
  aciklama: "aciklama",
  "açıklama": "aciklama",   // el yazısı / küçük harf Turkish ı
  "açiklama": "aciklama",   // AÇIKLAMA uppercase'den gelen, büyük I→küçük i
  not: "aciklama",
  notlar: "aciklama",
  "not/açıklama": "aciklama",
  "aciklama/not": "aciklama",

  // ADET sütunu
  adet: "adet",
  miktar: "adet",
  quantity: "adet",
  "adet/miktar": "adet",

  // FOTOĞRAF sütunu — normalized: "fotoğraf" (Ğ lowercase → ğ, no İ issue)
  "fotoğraf": "fotograf_yolu",   // FOTOĞRAF → fotoğraf ✓
  fotograf: "fotograf_yolu",
  "fotoğraf url": "fotograf_yolu",
  "fotograf url": "fotograf_yolu",
  resim: "fotograf_yolu",
  foto: "fotograf_yolu",
  image: "fotograf_yolu",
  photo: "fotograf_yolu",

  // FİYAT sütunu — FİYAT → replace İ → "Fiyat" → lowercase → "fiyat" ✓
  fiyat: "fiyat",
  "birim fiyat": "fiyat",
  "fiyatı": "fiyat",
  fiyati: "fiyat",
  "unit price": "fiyat",
  "birim maliyeti": "fiyat",

  // YER sütunu
  yer: "yer",
  konum: "yer",
  lokasyon: "yer",
  depo: "yer",
  "bulunduğu yer": "yer",
  "bulundugu yer": "yer",
  "muhafaza yeri": "yer",
}

function toStr(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number" && !Number.isNaN(v)) return v
  const n = parseFloat(String(v).replace(",", "."))
  return Number.isNaN(n) ? null : n
}

/**
 * İlk birkaç satır içinde gerçek başlık satırını bulur.
 * En az 2 sütununun alias'a eşleştiği ilk satırı döner.
 * Bulamazsa 0 döner.
 */
function findHeaderRowIndex(data: unknown[][]): number {
  for (let i = 0; i < Math.min(data.length, 6); i++) {
    const row = data[i] as unknown[]
    const matchCount = row.filter((cell) => {
      const key = normalizeHeader(cell)
      return key in HEADER_ALIASES
    }).length
    if (matchCount >= 2) return i
  }
  return 0
}

/**
 * xlsx içindeki gömülü resimleri çıkarır.
 * @param buffer xlsx ArrayBuffer
 * @param dataStartRow Veri satırlarının başladığı 0-tabanlı sayfa satır indeksi
 * @returns Map<0-tabanlı veri satırı → base64 data URL>
 */
function extractImagesFromXlsx(
  buffer: ArrayBuffer,
  dataStartRow: number
): Map<number, string> {
  const rowImageMap = new Map<number, string>()
  const tmpDir = join(tmpdir(), `envanter_img_${Date.now()}`)
  const tmpFile = join(tmpDir, "input.xlsx")

  try {
    mkdirSync(tmpDir, { recursive: true })
    writeFileSync(tmpFile, Buffer.from(buffer))

    // xlsx ZIP içeriğini kontrol et
    let listOutput = ""
    try {
      listOutput = execSync(`unzip -l "${tmpFile}"`, { encoding: "utf-8", timeout: 10000 })
    } catch {
      return rowImageMap
    }

    const hasDrawing = listOutput.includes("xl/drawings/drawing1.xml")
    const hasMedia = listOutput.includes("xl/media/")
    if (!hasDrawing || !hasMedia) return rowImageMap

    // Drawing XML + ilişki dosyasını çıkar
    try {
      execSync(
        `unzip -o -q "${tmpFile}" xl/drawings/drawing1.xml xl/drawings/_rels/drawing1.xml.rels -d "${tmpDir}"`,
        { encoding: "utf-8", timeout: 10000 }
      )
    } catch {
      try {
        execSync(`unzip -o -q "${tmpFile}" xl/drawings/drawing1.xml -d "${tmpDir}"`, {
          encoding: "utf-8",
          timeout: 10000,
        })
      } catch {
        return rowImageMap
      }
    }

    // Tüm media dosyalarını çıkar
    try {
      execSync(`unzip -o -q "${tmpFile}" "xl/media/*" -d "${tmpDir}"`, {
        encoding: "utf-8",
        timeout: 20000,
      })
    } catch {
      return rowImageMap
    }

    // rId → media dosya adı eşlemesi
    const ridToFile = new Map<string, string>()
    const relsPath = join(tmpDir, "xl", "drawings", "_rels", "drawing1.xml.rels")
    if (existsSync(relsPath)) {
      const relsXml = readFileSync(relsPath, "utf-8")
      const relRegex = /Id="([^"]+)"[^>]*Target="[^"]*\/media\/([^"]+)"/g
      let m: RegExpExecArray | null
      while ((m = relRegex.exec(relsXml)) !== null) {
        ridToFile.set(m[1], m[2])
      }
    }

    if (ridToFile.size === 0) return rowImageMap

    // Drawing XML'den her resmin satır pozisyonunu bul
    const drawingPath = join(tmpDir, "xl", "drawings", "drawing1.xml")
    if (!existsSync(drawingPath)) return rowImageMap
    const drawingXml = readFileSync(drawingPath, "utf-8")

    const anchorRegex =
      /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g
    let anchorMatch: RegExpExecArray | null

    while ((anchorMatch = anchorRegex.exec(drawingXml)) !== null) {
      const content = anchorMatch[1]
      // <xdr:from> bloğundan başlangıç satırını al (0-tabanlı sayfa satırı)
      const rowMatch = content.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
      const ridMatch = content.match(/r:embed="([^"]+)"/)
      if (!rowMatch || !ridMatch) continue

      const sheetRow = parseInt(rowMatch[1], 10)
      const rId = ridMatch[1]
      const mediaFile = ridToFile.get(rId)
      if (!mediaFile) continue

      const mediaPath = join(tmpDir, "xl", "media", mediaFile)
      if (!existsSync(mediaPath)) continue

      const imgData = readFileSync(mediaPath)
      // 2 MB sınırı — import sırasında dosyaya yazılır veya data URL geçici taşınır
      if (imgData.length > 2 * 1024 * 1024) continue

      const ext = (mediaFile.split(".").pop() ?? "png").toLowerCase()
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
      }
      const mimeType = mimeMap[ext] ?? "image/png"
      const dataUrl = `data:${mimeType};base64,${imgData.toString("base64")}`

      // sheetRow → 0-tabanlı veri satırı indeksi
      // Veri dataStartRow'dan başlar: dataRowIndex = sheetRow - dataStartRow
      if (sheetRow >= dataStartRow) {
        rowImageMap.set(sheetRow - dataStartRow, dataUrl)
      }
    }
  } catch (e) {
    console.warn("Envanter image extraction failed:", e)
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
  }

  return rowImageMap
}

export function parseEnvanterExcel(buffer: ArrayBuffer): EnvanterExcelRow[] {
  const wb = XLSX.read(buffer, { type: "array" })
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) return []
  const ws = wb.Sheets[firstSheet]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][]
  if (data.length < 2) return []

  // Başlık satırını otomatik bul (başlık 0. satırda olabileceği gibi 1., 2. satırda da olabilir)
  const headerRowIndex = findHeaderRowIndex(data)
  const dataStartRow = headerRowIndex + 1  // verinin başladığı 0-tabanlı sayfa satırı

  const headerRow = data[headerRowIndex] as unknown[]
  const colToField: (EnvanterField | null)[] = headerRow.map((h) => {
    const key = normalizeHeader(h)
    return HEADER_ALIASES[key] ?? null
  })

  // Gömülü resimleri çıkar — dataStartRow offset'ini geçir
  const imageMap = extractImagesFromXlsx(buffer, dataStartRow)

  const rows: EnvanterExcelRow[] = []

  for (let i = dataStartRow; i < data.length; i++) {
    const row = data[i] as unknown[]
    const record: Record<string, unknown> = {}
    const filled = new Set<EnvanterField>()

    for (let c = 0; c < colToField.length; c++) {
      const field = colToField[c]
      if (!field) continue
      const raw = row[c]
      if (field === "adet" || field === "fiyat") {
        const n = toNum(raw)
        if (n !== null) {
          record[field] = n
          filled.add(field)
        }
      } else {
        const s = toStr(raw)
        if (s) {
          record[field] = s
          filled.add(field)
        }
      }
    }

    const dataRowIndex = i - dataStartRow
    const embeddedImage = imageMap.get(dataRowIndex)
    if (embeddedImage && !record.fotograf_yolu) {
      record.fotograf_yolu = embeddedImage
      filled.add("fotograf_yolu")
    }

    const kod = toStr(record.kod)
    const malzeme_adi = toStr(record.malzeme_adi)
    if (!kod && !malzeme_adi) continue

    rows.push({
      kod: kod || `ITEM-${dataRowIndex + 1}`,
      malzeme_adi: malzeme_adi || "—",
      aciklama: filled.has("aciklama") ? ((record.aciklama as string) ?? null) : null,
      adet: filled.has("adet") ? (record.adet as number) : null,
      fiyat: filled.has("fiyat") ? (record.fiyat as number) : null,
      yer: filled.has("yer") ? ((record.yer as string) ?? null) : null,
      fotograf_yolu: filled.has("fotograf_yolu") ? ((record.fotograf_yolu as string) ?? null) : null,
      filledFields: Array.from(filled),
    })
  }

  return rows
}

export function buildEnvanterTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    // Şablon başlıkları — kullanıcının kendi dosyasıyla aynı format
    ENVANTER_TEMPLATE_HEADERS as unknown as string[],
    ["ICSP0001", "Örnek Malzeme", "Açıklama buraya", 5, "", 250.0, "Depo"],
  ])
  // Sütun genişlikleri
  ws["!cols"] = [
    { wch: 12 }, // KOD
    { wch: 30 }, // MALZEME ADI
    { wch: 25 }, // AÇIKLAMA
    { wch: 8 },  // ADET
    { wch: 15 }, // FOTOĞRAF
    { wch: 10 }, // FİYAT
    { wch: 20 }, // YER
  ]
  XLSX.utils.book_append_sheet(wb, ws, "Malzeme Envanteri")
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}
