/**
 * Personel Excel şablonu ve içe aktarma için sütun eşlemesi.
 * Şablon sütun adları: Ad, Soyad, Görev, TC Kimlik, ...
 * Dış Excel'lerde farklı adlar olabilir; aşağıdaki alias'larla eşleştirilir.
 */

export const PERSONEL_TEMPLATE_HEADERS = [
  "Ad",
  "Soyad",
  "Görev",
  "TC Kimlik",
  "Pasaport No",
  "Çalıştığı Bölüm",
  "Doğum Tarihi",
  "Kan Grubu",
  "Acil İletişim",
  "Acil Telefon",
  "İşe Giriş Tarihi",
  "İşten Çıkış Tarihi",
  "Sigorta Durumu",
  "IBAN",
  "Banka Adı",
  "Günlük Yevmiye",
  "Aylık Maaş",
] as const

type PersonelField =
  | "ad"
  | "soyad"
  | "ad_soyad"
  | "gorev"
  | "tc_kimlik"
  | "pasaport_no"
  | "calistigi_bolum"
  | "dogum_tarihi"
  | "kan_grubu"
  | "acil_iletisim"
  | "acil_telefon"
  | "ise_giris_tarihi"
  | "isten_cikis_tarihi"
  | "sigorta_durumu"
  | "iban"
  | "banka_adi"
  | "gunluk_yevmiye"
  | "aylik_maas"

const HEADER_ALIASES: Record<string, PersonelField> = {
  ad: "ad",
  soyad: "soyad",
  gorev: "gorev",
  görev: "gorev",
  tc: "tc_kimlik",
  "tc kimlik": "tc_kimlik",
  "t.c.": "tc_kimlik",
  "tc no": "tc_kimlik",
  "tc_no": "tc_kimlik",
  dogum_tarihi: "dogum_tarihi",
  "doğum tarihi": "dogum_tarihi",
  "doğum_tarihi": "dogum_tarihi",
  dogum: "dogum_tarihi",
  kan_grubu: "kan_grubu",
  "kan grubu": "kan_grubu",
  acil_iletisim: "acil_iletisim",
  "acil iletişim": "acil_iletisim",
  acil_telefon: "acil_telefon",
  "acil telefon": "acil_telefon",
  telefon: "acil_telefon",
  cep: "acil_telefon",
  ise_giris_tarihi: "ise_giris_tarihi",
  "işe giriş": "ise_giris_tarihi",
  "işe giriş tarihi": "ise_giris_tarihi",
  "ise giris": "ise_giris_tarihi",
  sigorta_durumu: "sigorta_durumu",
  "sigorta durumu": "sigorta_durumu",
  sigorta: "sigorta_durumu",
  iban: "iban",
  banka_adi: "banka_adi",
  "banka adı": "banka_adi",
  banka: "banka_adi",
  gunluk_yevmiye: "gunluk_yevmiye",
  "günlük yevmiye": "gunluk_yevmiye",
  yevmiye: "gunluk_yevmiye",
  aylik_maas: "aylik_maas",
  "aylık maaş": "aylik_maas",
  maas: "aylik_maas",
  maaş: "aylik_maas",
  "aylık ücreti": "aylik_maas",   // aylık ücreti (ı + ü)
  "aylik ücreti": "aylik_maas",   // AYLIK ÜCRETİ normalize edilince (i + ü) → bu alias gerekli!
  "aylik ucreti": "aylik_maas",   // aksan yok
  "aylık ücret": "aylik_maas",
  "aylik ucret": "aylik_maas",
  ücret: "aylik_maas",
  ucret: "aylik_maas",
  "brüt maaş": "aylik_maas",
  "brut maas": "aylik_maas",
  "net maaş": "aylik_maas",
  "net maas": "aylik_maas",
  "aylık ücret": "aylik_maas",
  "aylik ucret": "aylik_maas",
  "günlük ücret": "gunluk_yevmiye",
  "gunluk ucret": "gunluk_yevmiye",
  "günlük": "gunluk_yevmiye",
  gunluk: "gunluk_yevmiye",
  görevi: "gorev",
  gorevi: "gorev",
  unvan: "gorev",
  ünvan: "gorev",
  pozisyon: "gorev",
  meslek: "gorev",
  "iş unvanı": "gorev",
  "is unvani": "gorev",
  "işe başlama": "ise_giris_tarihi",
  "ise baslama": "ise_giris_tarihi",
  "giriş tarihi": "ise_giris_tarihi",
  "giris tarihi": "ise_giris_tarihi",
  "çıkış tarihi": "isten_cikis_tarihi",
  "cikis tarihi": "isten_cikis_tarihi",
  "işten ayrılış": "isten_cikis_tarihi",
  "isten ayrilis": "isten_cikis_tarihi",
  "personel adi ve soyadi": "ad_soyad",
  "personel adı ve soyadı": "ad_soyad",
  "adi ve soyadi": "ad_soyad",
  "adı ve soyadı": "ad_soyad",
  "ad soyad": "ad_soyad",
  pasaport_no: "pasaport_no",
  "pasaport no": "pasaport_no",
  pasaport: "pasaport_no",
  "işten çıkış": "isten_cikis_tarihi",
  "isten cikis": "isten_cikis_tarihi",
  "işten çıkış tarihi": "isten_cikis_tarihi",
  "isten cikis tarihi": "isten_cikis_tarihi",
  "çalıştığı bölüm": "calistigi_bolum",
  "calistigi bolum": "calistigi_bolum",
  bölüm: "calistigi_bolum",
  bolum: "calistigi_bolum",
  birimi: "calistigi_bolum",
  birim: "calistigi_bolum",
}

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .replace(/\r\n/g, " ")
    .trim()
    .replace(/İ/g, "i") // Handle Turkish İ (U+0130) before toLowerCase to avoid combining-dot issue
    .toLowerCase()
    .replace(/\u0307/g, "") // Remove combining dot above that toLowerCase may add for İ
    .replace(/\s+/g, " ")
}

export function mapHeaderToField(header: string): PersonelField | null {
  const key = normalizeHeader(header)
  return HEADER_ALIASES[key] ?? null
}

export interface PersonelExcelRow {
  ad: string
  soyad: string
  gorev: string
  tc_kimlik?: string | null
  pasaport_no?: string | null
  calistigi_bolum?: string | null
  dogum_tarihi?: string | null
  kan_grubu?: string | null
  acil_iletisim?: string | null
  acil_telefon?: string | null
  ise_giris_tarihi?: string | null
  isten_cikis_tarihi?: string | null
  sigorta_durumu?: string | null
  iban?: string | null
  banka_adi?: string | null
  gunluk_yevmiye?: number | null
  aylik_maas?: number | null
}

function toDateStr(v: unknown): string | null {
  if (v == null || v === "") return null
  if (typeof v === "string") {
    const s = v.trim()
    if (!s) return null
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return `${m[1]}-${m[2]}-${m[3]}`
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return s.slice(0, 10)
  }
  if (typeof v === "number" && v > 0) {
    const d = new Date((v - 25569) * 86400 * 1000)
    return d.toISOString().slice(0, 10)
  }
  return null
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null
  if (typeof v === "number" && !Number.isNaN(v)) return v
  const n = parseFloat(String(v).replace(",", "."))
  return Number.isNaN(n) ? null : n
}

function toStr(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx") as typeof import("xlsx")

export function parsePersonelExcel(buffer: ArrayBuffer): PersonelExcelRow[] {
  const wb = XLSX.read(buffer, { type: "array" })
  const firstSheet = wb.SheetNames[0]
  if (!firstSheet) return []
  const ws = wb.Sheets[firstSheet]
  const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" })
  if (data.length < 2) return []

  const headerRow = data[0] as unknown[]
  const colToField: (PersonelField | null)[] = headerRow.map((h) => mapHeaderToField(String(h)))
  const rows: PersonelExcelRow[] = []

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[]
    const record: Record<string, string | number | null | undefined> = {}
    for (let c = 0; c < colToField.length; c++) {
      const field = colToField[c]
      if (!field) continue
      const raw = row[c]
      if (field === "ad_soyad") {
        record.ad_soyad = toStr(raw)
      } else if (field === "ad" || field === "soyad" || field === "gorev" || field === "tc_kimlik" || field === "pasaport_no" || field === "calistigi_bolum") {
        record[field] = toStr(raw)
      } else if (field === "dogum_tarihi" || field === "ise_giris_tarihi" || field === "isten_cikis_tarihi") {
        record[field] = toDateStr(raw)
      } else if (field === "gunluk_yevmiye" || field === "aylik_maas") {
        record[field] = toNum(raw)
      } else {
        record[field] = toStr(raw) || null
      }
    }
    let ad = toStr(record.ad)
    let soyad = toStr(record.soyad)
    if (record.ad_soyad) {
      const parts = String(record.ad_soyad).trim().split(/\s+/)
      if (parts.length >= 2) {
        ad = parts[0]
        soyad = parts.slice(1).join(" ")
      } else if (parts.length === 1 && parts[0]) {
        ad = parts[0]
      }
    }
    if (!ad && !soyad) continue
    rows.push({
      ad: ad || "—",
      soyad: soyad || "—",
      gorev: toStr(record.gorev) || "İşçi",
      tc_kimlik: (record.tc_kimlik as string) || null,
      pasaport_no: (record.pasaport_no as string) || null,
      calistigi_bolum: (record.calistigi_bolum as string) || null,
      dogum_tarihi: (record.dogum_tarihi as string) || null,
      kan_grubu: (record.kan_grubu as string) || null,
      acil_iletisim: (record.acil_iletisim as string) || null,
      acil_telefon: (record.acil_telefon as string) || null,
      ise_giris_tarihi: (record.ise_giris_tarihi as string) || null,
      isten_cikis_tarihi: (record.isten_cikis_tarihi as string) || null,
      sigorta_durumu: (record.sigorta_durumu as string) || null,
      iban: (record.iban as string) || null,
      banka_adi: (record.banka_adi as string) || null,
      gunluk_yevmiye: (record.gunluk_yevmiye as number) ?? null,
      aylik_maas: (record.aylik_maas as number) ?? null,
    })
  }

  return rows
}

export function buildPersonelTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    PERSONEL_TEMPLATE_HEADERS as unknown as string[],
    [], // örnek boş satır
  ])
  XLSX.utils.book_append_sheet(wb, ws, "Personel")
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}
