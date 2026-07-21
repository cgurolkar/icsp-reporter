import { type NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { getSessionFromRequest, canAccessIdari, canManageIdariCentral, canAccessSite } from "@/lib/auth"
import { initializeDatabase, getHarcamaKategorileri } from "@/lib/database"
import pool from "@/lib/database" // default export

// Excel sütun indeksleri (0-tabanlı)
const COL_TARIH = 0
const COL_CH = 1
const COL_FATNO = 2
const COL_ACIKLAMA = 3
const COL_DETAY = 4
const COL_TAH_USD = 5
const COL_TAH_IQD = 6
const COL_TED_USD = 7
const COL_TED_IQD = 8

// Kategori kodu eşlemesi (AÇIKLAMA → kategori kod)
function mapCategory(aciklama: string): string {
  const val = (aciklama || "").toLowerCase().trim()
  if (/yemek|öğle|akşam|sabah/.test(val)) return "yemek"
  if (/mazot|benzin|yakıt|fuel|figo|corolla|mg pikap|mg$|benzi/.test(val)) return "akaryakit"
  if (/maaş|maas|avans|personel|ödeme|yevmiye/.test(val)) return "maas"
  if (/taşeron|taseron|sany|xcmg|sr60|loader|vinç|vınc|nakliye/.test(val)) return "tason"
  if (/sarf|malzeme|parça|parca/.test(val)) return "sarf"
  return "diger"
}

function parseAmount(val: unknown): number | null {
  if (val == null || val === "") return null
  const n = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, "."))
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function parseDate(val: unknown): string | null {
  if (val == null || val === "") return null
  // Excel serial number
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`
  }
  // JS Date from xlsx
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  const m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  return null
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  if (!canManageIdariCentral(session.role)) {
    return NextResponse.json({ error: "Harcama Excel aktarımı yetkiniz yok." }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek formatı." }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const siteIdStr = formData.get("siteId") as string | null
  const parabirimi = (formData.get("parabirimi") as string | null) || "USD"
  const previewOnly = formData.get("previewOnly") === "true"

  if (!file || !siteIdStr) {
    return NextResponse.json({ error: "Dosya ve şantiye seçimi zorunludur." }, { status: 400 })
  }
  const siteId = parseInt(siteIdStr, 10)
  if (isNaN(siteId) || siteId <= 0) {
    return NextResponse.json({ error: "Geçersiz şantiye." }, { status: 400 })
  }
  if (!canAccessSite(session, siteId)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })
  }

  await initializeDatabase()
  const kategoriler = await getHarcamaKategorileri()
  const katMap: Record<string, number> = {}
  for (const k of kategoriler) katMap[k.kod] = k.id

  // Excel parse
  const bytes = await file.arrayBuffer()
  const wb = XLSX.read(Buffer.from(bytes), { type: "buffer", cellDates: true })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

  // Veri satırlarını bul (başlık satırını atla)
  // Satır 7 (index 7) başlık, satır 8 (index 8) para birimi, satır 9+ veri
  const dataStartIndex = rows.findIndex((row) => {
    const r = row as unknown[]
    return r[COL_TARIH] instanceof Date || (typeof r[COL_TARIH] === "number" && r[COL_TARIH] > 40000)
  })
  const dataRows = dataStartIndex >= 0 ? rows.slice(dataStartIndex) : []

  const preview: Array<{
    tarih: string
    ch: string
    fatNo: string
    aciklama: string
    detay: string
    tutar: number
    parabirimi: string
    kategoriKod: string
    kategoriAdi: string
  }> = []

  const errors: string[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as unknown[]

    // Boş satır veya özet satırı kontrolü
    if (!row[COL_TARIH] && !row[COL_TED_USD] && !row[COL_TED_IQD]) continue
    const tarih = parseDate(row[COL_TARIH])
    if (!tarih) continue

    // Yalnızca Tediyeler (gider) satırlarını al
    const tedUSD = parseAmount(row[COL_TED_USD])
    const tedIQD = parseAmount(row[COL_TED_IQD])
    if (tedUSD == null && tedIQD == null) continue

    // Para birimi seçimine göre tutar
    let tutar: number | null = null
    let usedParabirimi = parabirimi
    if (parabirimi === "USD") {
      tutar = tedUSD ?? (tedIQD != null ? null : null)
      // USD yoksa IQD varsa IQD kullan
      if (tutar == null && tedIQD != null) {
        tutar = tedIQD
        usedParabirimi = "IQD"
      }
    } else {
      tutar = tedIQD ?? (tedUSD != null ? tedUSD : null)
      if (tutar == null && tedUSD != null) {
        tutar = tedUSD
        usedParabirimi = "USD"
      }
    }
    if (tutar == null || tutar <= 0) continue

    const aciklama = String(row[COL_ACIKLAMA] || "").trim()
    const detay = String(row[COL_DETAY] || "").trim()
    const ch = String(row[COL_CH] || "").trim()
    const fatNo = row[COL_FATNO] != null ? String(row[COL_FATNO]).trim() : ""

    const kategoriKod = mapCategory(aciklama)
    const katId = katMap[kategoriKod] ?? katMap["diger"]
    const kategoriAdi = kategoriler.find((k) => k.id === katId)?.ad ?? "Diğer"

    const fullAciklama = [
      ch && ch !== "ICS" ? `[${ch}]` : null,
      fatNo ? `#${fatNo}` : null,
      detay || aciklama || null,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 500)

    preview.push({
      tarih,
      ch,
      fatNo,
      aciklama,
      detay,
      tutar,
      parabirimi: usedParabirimi,
      kategoriKod,
      kategoriAdi,
    })
  }

  if (previewOnly) {
    return NextResponse.json({
      preview: preview.slice(0, 100),
      totalRows: preview.length,
      errors,
    })
  }

  // Gerçek import
  const client = await pool.connect()
  let created = 0
  let failed = 0

  try {
    await client.query("BEGIN")
    for (const item of preview) {
      const katId = katMap[item.kategoriKod] ?? katMap["diger"]
      const detayFull = [
        item.ch && item.ch !== "ICS" ? `[${item.ch}]` : null,
        item.fatNo ? `#${item.fatNo}` : null,
        item.detay || item.aciklama || null,
        item.parabirimi !== "USD" ? `(${item.parabirimi})` : null,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500)

      try {
        await client.query(
          `INSERT INTO islemler (site_id, kategori_id, tutar, islem_tarihi, odeme_kaynagi, aciklama, olusturan_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [siteId, katId, item.tutar, item.tarih, "Santiye_Kasa", detayFull || null, session.id]
        )
        created++
      } catch {
        failed++
      }
    }
    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK")
    return NextResponse.json({ error: "Import sırasında hata oluştu." }, { status: 500 })
  } finally {
    client.release()
  }

  return NextResponse.json({
    created,
    failed,
    totalParsed: preview.length,
    errors,
  })
}
