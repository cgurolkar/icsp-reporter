import * as XLSX from "xlsx"

/** Yeni harcama şablonu sütunları (sıra önemli) */
export const HARCAMA_TEMPLATE_HEADERS = [
  "Tarih",
  "Kalem Kodu",
  "Alt Kalem",
  "Masraf Yeri",
  "Fiş/Fatura No",
  "Açıklama",
  "Tutar",
  "Para Birimi",
  "Ödeme Kaynağı",
] as const

export type HarcamaExcelParsedRow = {
  tarih: string
  kalemKod: string
  altKalem: string
  masrafYeri: string
  fisFaturaNo: string
  aciklama: string
  tutar: number
  paraBirimi: "USD" | "IQD"
  odemeKaynagi: "Santiye_Kasa" | "Merkez_Banka"
  /** true = yeni şablon; false = eski GENEL KASA */
  format: "yeni" | "eski"
  /** Eski format için ham alanlar */
  ch?: string
  fatNo?: string
  detay?: string
}

export type HarcamaTemplateRef = {
  kalemler: { kod: string; ad: string }[]
  altKalemler: { kalem_kod: string; kalem_ad: string; ad: string }[]
  masrafYerleri: { ad: string; tip: string }[]
}

function parseAmount(val: unknown): number | null {
  if (val == null || val === "") return null
  if (typeof val === "number") {
    if (!Number.isFinite(val) || val <= 0) return null
    return Math.round(val * 100) / 100
  }
  let s = String(val).trim().replace(/\s/g, "").replace(/₺|\$|IQD|USD|TL/gi, "")
  if (!s) return null
  // TR: 1.234.567,89  |  US: 1,234,567.89  |  sade: 1234.5 / 1234,5
  const hasComma = s.includes(",")
  const hasDot = s.includes(".")
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".") // TR
    } else {
      s = s.replace(/,/g, "") // US
    }
  } else if (hasComma && !hasDot) {
    // 1234,50 veya 1.234 binlik değil sadece virgül
    s = s.replace(",", ".")
  } else if (hasDot && !hasComma) {
    // 1.234.567 (TR binlik) vs 1234.56
    const parts = s.split(".")
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)) {
      // muhtemel binlik ayırıcı(lar)
      if (parts.every((p, i) => i === 0 || p.length === 3)) {
        s = parts.join("")
      }
    }
  }
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function parseDate(val: unknown): string | null {
  if (val == null || val === "") return null
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    // Yerel tarihi kullan (UTC kayması olmasın)
    const y = val.getFullYear()
    const m = val.getMonth() + 1
    const d = val.getDate()
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
  }
  const s = String(val).trim()
  const m = s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`
  const m2 = s.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/)
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`
  return null
}

/** Excel'den gelen "100", 100, "100.0", "100 — Personel" → "100" */
export function normalizeKalemKod(raw: unknown): string {
  if (raw == null || raw === "") return ""
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.round(raw))
  const s = String(raw).trim()
  const m = s.match(/^(\d{2,4})\b/)
  return m ? m[1] : s
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function findHeaderRow(rows: unknown[][]): { index: number; kind: "yeni" | "eski" } | null {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] as unknown[]).map((c) => norm(String(c ?? "")))
    const joined = cells.join("|")
    if (joined.includes("alt kalem") && (joined.includes("kalem kod") || joined.includes("tutar"))) {
      return { index: i, kind: "yeni" }
    }
    if (joined.includes("tarih") && joined.includes("tediye") && (joined.includes("tahsilat") || joined.includes("aciklama"))) {
      return { index: i, kind: "eski" }
    }
  }
  return null
}

function colIndex(header: unknown[], ...names: string[]): number {
  const cells = header.map((c) => norm(String(c ?? "")))
  for (const name of names) {
    const n = norm(name)
    const idx = cells.findIndex((c) => c === n || c.includes(n))
    if (idx >= 0) return idx
  }
  return -1
}

function parseYeniRows(rows: unknown[][], headerIdx: number): HarcamaExcelParsedRow[] {
  const header = rows[headerIdx] as unknown[]
  const iTarih = colIndex(header, "Tarih")
  const iKalem = colIndex(header, "Kalem Kodu", "Kalem Kod")
  const iAlt = colIndex(header, "Alt Kalem")
  const iMasraf = colIndex(header, "Masraf Yeri")
  const iFis = colIndex(header, "Fiş/Fatura No", "Fis/Fatura No", "Fatura No", "Fiş No", "Fis No", "Fat. No")
  const iAciklama = colIndex(header, "Açıklama", "Aciklama")
  const iTutar = colIndex(header, "Tutar")
  const iPb = colIndex(header, "Para Birimi", "PB", "Kur")
  const iOdeme = colIndex(header, "Ödeme Kaynağı", "Odeme Kaynagi", "Ödeme")

  if (iTarih < 0 || iAlt < 0 || iTutar < 0) return []

  const out: HarcamaExcelParsedRow[] = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue
    const tarih = parseDate(row[iTarih])
    const tutar = parseAmount(row[iTutar])
    if (!tarih || tutar == null) continue

    const altKalem = String(row[iAlt] ?? "").trim()
    if (!altKalem) continue

    const pbRaw = iPb >= 0 ? String(row[iPb] ?? "IQD").trim().toUpperCase() : "IQD"
    const paraBirimi: "USD" | "IQD" = pbRaw.includes("USD") ? "USD" : "IQD"

    const odemeRaw = iOdeme >= 0 ? norm(String(row[iOdeme] ?? "")) : ""
    const odemeKaynagi: "Santiye_Kasa" | "Merkez_Banka" =
      odemeRaw.includes("merkez") || odemeRaw.includes("banka") ? "Merkez_Banka" : "Santiye_Kasa"

    const fisRaw = iFis >= 0 && row[iFis] != null ? String(row[iFis]).trim() : ""

    out.push({
      tarih,
      kalemKod: iKalem >= 0 ? normalizeKalemKod(row[iKalem]) : "",
      altKalem,
      masrafYeri: iMasraf >= 0 ? String(row[iMasraf] ?? "").trim() : "",
      fisFaturaNo: fisRaw,
      aciklama: iAciklama >= 0 ? String(row[iAciklama] ?? "").trim() : "",
      tutar,
      paraBirimi,
      odemeKaynagi,
      format: "yeni",
    })
  }
  return out
}

/** Eski GENEL KASA: Tarih | C/H | Fat | Açıklama | Detay | Tah USD | Tah IQD | Ted USD | Ted IQD */
function parseEskiRows(rows: unknown[][], preferredPb: string): HarcamaExcelParsedRow[] {
  const COL_TARIH = 0
  const COL_CH = 1
  const COL_FATNO = 2
  const COL_ACIKLAMA = 3
  const COL_DETAY = 4
  const COL_TED_USD = 7
  const COL_TED_IQD = 8

  const dataStart = rows.findIndex((row) => {
    const r = row as unknown[]
    return r[COL_TARIH] instanceof Date || (typeof r[COL_TARIH] === "number" && (r[COL_TARIH] as number) > 40000)
  })
  if (dataStart < 0) return []

  const out: HarcamaExcelParsedRow[] = []
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const tarih = parseDate(row[COL_TARIH])
    if (!tarih) continue
    const tedUSD = parseAmount(row[COL_TED_USD])
    const tedIQD = parseAmount(row[COL_TED_IQD])
    if (tedUSD == null && tedIQD == null) continue

    let tutar: number | null = null
    let paraBirimi: "USD" | "IQD" = preferredPb === "IQD" ? "IQD" : "USD"
    if (preferredPb === "USD") {
      tutar = tedUSD
      if (tutar == null && tedIQD != null) {
        tutar = tedIQD
        paraBirimi = "IQD"
      }
    } else {
      tutar = tedIQD
      if (tutar == null && tedUSD != null) {
        tutar = tedUSD
        paraBirimi = "USD"
      }
    }
    if (tutar == null) continue

    const aciklama = String(row[COL_ACIKLAMA] || "").trim()
    const detay = String(row[COL_DETAY] || "").trim()
    const fatNo = row[COL_FATNO] != null ? String(row[COL_FATNO]).trim() : ""
    out.push({
      tarih,
      kalemKod: "",
      altKalem: aciklama || detay,
      masrafYeri: "",
      fisFaturaNo: fatNo,
      aciklama: detay || aciklama,
      tutar,
      paraBirimi,
      odemeKaynagi: "Santiye_Kasa",
      format: "eski",
      ch: String(row[COL_CH] || "").trim(),
      fatNo,
      detay,
    })
  }
  return out
}

export function parseHarcamaExcel(buffer: ArrayBuffer, preferredPb = "USD"): HarcamaExcelParsedRow[] {
  const wb = XLSX.read(Buffer.from(buffer), { type: "buffer", cellDates: true })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const header = findHeaderRow(rows)
  if (header?.kind === "yeni") return parseYeniRows(rows, header.index)
  // Başlık yoksa ama ilk satır yeni header gibiyse
  if (rows[0] && colIndex(rows[0] as unknown[], "Alt Kalem") >= 0) {
    return parseYeniRows(rows, 0)
  }
  return parseEskiRows(rows, preferredPb)
}

export function buildHarcamaTemplateBuffer(refs?: HarcamaTemplateRef): Buffer {
  const wb = XLSX.utils.book_new()

  const sampleRows: (string | number | Date | null)[][] = [
    [...HARCAMA_TEMPLATE_HEADERS],
    [new Date(2026, 0, 15), "100", "Yemek", "Kamp", "F-001", "Öğle yemeği", 45.5, "USD", "Santiye_Kasa"],
    [new Date(2026, 0, 16), "300", "Akaryakıt", "Saha Genel", "", "Jeneratör mazot", 120, "USD", "Santiye_Kasa"],
    [new Date(2026, 0, 17), "400", "Genel Sarf", "Ofis", "F-002", "Malzeme", 150000, "IQD", "Santiye_Kasa"],
  ]

  const ws = XLSX.utils.aoa_to_sheet(sampleRows)
  ws["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 28 },
    { wch: 14 },
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, "Harcamalar")

  // Yardım / açıklama
  const help = XLSX.utils.aoa_to_sheet([
    ["Harcama Excel Aktarım Şablonu"],
    [],
    ["Sütun", "Açıklama"],
    ["Tarih", "YYYY-MM-DD veya Excel tarih"],
    ["Kalem Kodu", "100–700 (Ana Kalemler sayfasına bakın)"],
    ["Alt Kalem", "Tam ad — Alt Kalemler sayfasından kopyalayın"],
    ["Masraf Yeri", "Tam ad — Masraf Yerleri sayfasından (opsiyonel)"],
    ["Fiş/Fatura No", "Fiş veya fatura numarası (opsiyonel)"],
    ["Açıklama", "Serbest metin"],
    ["Tutar", "Pozitif sayı"],
    ["Para Birimi", "USD veya IQD"],
    ["Ödeme Kaynağı", "Santiye_Kasa veya Merkez_Banka"],
    [],
    ["Not", "Aktarımda şantiye uygulamadan seçilir. Alt kalem adı sistemdeki kayıtla eşleşmelidir."],
  ])
  help["!cols"] = [{ wch: 16 }, { wch: 55 }]
  XLSX.utils.book_append_sheet(wb, help, "Yardim")

  if (refs?.kalemler?.length) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Kalem Kodu", "Ana Kalem"],
      ...refs.kalemler.map((k) => [k.kod, k.ad]),
    ])
    sheet["!cols"] = [{ wch: 12 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, sheet, "Ana Kalemler")
  }

  if (refs?.altKalemler?.length) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Kalem Kodu", "Ana Kalem", "Alt Kalem"],
      ...refs.altKalemler.map((a) => [a.kalem_kod, a.kalem_ad, a.ad]),
    ])
    sheet["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, sheet, "Alt Kalemler")
  }

  if (refs?.masrafYerleri?.length) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Masraf Yeri", "Tip"],
      ...refs.masrafYerleri.map((m) => [m.ad, m.tip]),
    ])
    sheet["!cols"] = [{ wch: 32 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, sheet, "Masraf Yerleri")
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}

function findAltInPool(
  pool: { id: number; ad: string }[],
  target: string,
): number | null {
  const exact = pool.find((a) => norm(a.ad) === target)
  if (exact) return exact.id
  // "Yemek / Öğle" gibi ek açıklamalı hücreler
  const starts = pool.find((a) => target.startsWith(norm(a.ad)) || norm(a.ad).startsWith(target))
  if (starts) return starts.id
  const partial = pool.find((a) => {
    const n = norm(a.ad)
    return (n.length >= 4 && target.includes(n)) || (target.length >= 4 && n.includes(target))
  })
  return partial?.id ?? null
}

/**
 * Alt kalem adını eşle.
 * Önce kalem kodu ile daraltır; bulamazsa tüm listede arar (yanlış kod yüzünden satır düşmesin).
 */
export function matchAltKalemId(
  altKalemler: { id: number; ad: string; kalem_kod?: string; kalem_id: number }[],
  altAd: string,
  kalemKod?: string,
): number | null {
  const target = norm(altAd)
  if (!target) return null

  const kod = kalemKod ? normalizeKalemKod(kalemKod) : ""
  if (kod) {
    const filtered = altKalemler.filter((a) => String(a.kalem_kod) === kod)
    if (filtered.length) {
      const hit = findAltInPool(filtered, target)
      if (hit != null) return hit
    }
  }
  // Kod yok / yanlış / eşleşmedi → tüm alt kalemler
  return findAltInPool(altKalemler, target)
}

export function matchMasrafYeriId(
  masrafYerleri: { id: number; ad: string }[],
  ad: string,
): number | null {
  const target = norm(ad)
  if (!target) return null
  const exact = masrafYerleri.find((m) => norm(m.ad) === target)
  if (exact) return exact.id
  const partial = masrafYerleri.find((m) => norm(m.ad).includes(target) || target.includes(norm(m.ad)))
  return partial?.id ?? null
}
