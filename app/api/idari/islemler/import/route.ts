import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari, canManageIdariCentral, canAccessSite } from "@/lib/auth"
import {
  initializeDatabase,
  getHarcamaAltKalemler,
  getMasrafYerleri,
  createIslem,
  resolveKategoriIdForAltKalem,
  getHarcamaKategorileri,
  legacyKategoriKodFromKalemKod,
} from "@/lib/database"
import { parseHarcamaExcel, matchAltKalemId, matchMasrafYeriId } from "@/lib/harcama-excel"

/** Eski GENEL KASA / eşleşmeyen satır → eski kategori kodu */
function mapLegacyCategory(aciklama: string): string {
  const val = (aciklama || "").toLowerCase().trim()
  if (/yemek|öğle|akşam|sabah/.test(val)) return "yemek"
  if (/mazot|benzin|yakıt|fuel/.test(val)) return "akaryakit"
  if (/maaş|maas|avans|personel|yevmiye/.test(val)) return "maas"
  if (/taşeron|taseron|nakliye/.test(val)) return "tason"
  if (/sarf|malzeme|parça|parca/.test(val)) return "sarf"
  return "diger"
}

type PreviewItem = {
  tarih: string
  kalemKod: string
  altKalem: string
  masrafYeri: string
  fisFaturaNo: string
  aciklama: string
  tutar: number
  parabirimi: string
  altKalemId: number | null
  masrafYeriId: number | null
  kategoriKod: string
  kategoriAdi: string
  odemeKaynagi: string
  format: string
  matched: boolean
  warning?: string
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
  const [altKalemler, masrafYerleri, kategoriler] = await Promise.all([
    getHarcamaAltKalemler({ aktifOnly: true }),
    getMasrafYerleri(true),
    getHarcamaKategorileri(),
  ])
  const katMap: Record<string, number> = {}
  for (const k of kategoriler) katMap[k.kod] = k.id
  const katAdMap: Record<string, string> = {}
  for (const k of kategoriler) katAdMap[k.kod] = k.ad

  const bytes = await file.arrayBuffer()
  const parsed = parseHarcamaExcel(bytes, parabirimi)
  if (parsed.length === 0) {
    return NextResponse.json({
      error:
        "Geçerli satır bulunamadı. Tarih, Alt Kalem ve Tutar dolu olmalı. Şablonu kullanın veya sayı/tarih formatını kontrol edin.",
    }, { status: 400 })
  }

  const preview: PreviewItem[] = []
  const errors: string[] = []
  let unmatchedCount = 0

  for (const row of parsed) {
    const altId = matchAltKalemId(
      altKalemler as { id: number; ad: string; kalem_kod?: string; kalem_id: number }[],
      row.altKalem,
      row.kalemKod || undefined,
    )
    const masrafId = row.masrafYeri
      ? matchMasrafYeriId(masrafYerleri as { id: number; ad: string }[], row.masrafYeri)
      : null

    let kategoriKod = "diger"
    let kalemKod = row.kalemKod
    let warning: string | undefined

    if (altId) {
      const ak = altKalemler.find((a: { id: number }) => a.id === altId) as {
        kalem_kod?: string
      } | undefined
      kalemKod = ak?.kalem_kod || kalemKod
      kategoriKod = legacyKategoriKodFromKalemKod(kalemKod)
    } else {
      unmatchedCount++
      kategoriKod = mapLegacyCategory(row.altKalem || row.aciklama)
      warning = `Alt kalem eşleşmedi (“${row.altKalem}”) — kayıt eski kategori (${kategoriKod}) ile alınacak; sonra düzenleyin.`
      errors.push(`${row.tarih}: ${warning}`)
    }

    let aciklama = row.aciklama
    if (row.format === "eski") {
      aciklama = [
        row.ch && row.ch !== "ICS" ? `[${row.ch}]` : null,
        row.detay || row.aciklama || null,
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500)
    }

    preview.push({
      tarih: row.tarih,
      kalemKod: kalemKod || "",
      altKalem: row.altKalem,
      masrafYeri: row.masrafYeri,
      fisFaturaNo: row.fisFaturaNo || row.fatNo || "",
      aciklama,
      tutar: row.tutar,
      parabirimi: row.paraBirimi,
      altKalemId: altId,
      masrafYeriId: masrafId,
      kategoriKod,
      kategoriAdi: katAdMap[kategoriKod] || kategoriKod,
      odemeKaynagi: row.odemeKaynagi,
      format: row.format,
      matched: !!altId,
      warning,
    })
  }

  if (previewOnly) {
    return NextResponse.json({
      preview: preview.slice(0, 150),
      totalRows: preview.length,
      matchedRows: preview.filter((p) => p.matched).length,
      unmatchedRows: unmatchedCount,
      errors: errors.slice(0, 80),
    })
  }

  let created = 0
  let failed = 0
  const failReasons: string[] = []

  for (const item of preview) {
    try {
      let katId: number | null = null
      if (item.matched && item.altKalemId) {
        katId = await resolveKategoriIdForAltKalem(item.altKalemId)
      } else {
        katId = katMap[item.kategoriKod] ?? katMap["diger"] ?? null
      }
      if (!katId) {
        failed++
        failReasons.push(`${item.tarih}: kategori bulunamadı`)
        continue
      }
      await createIslem({
        site_id: siteId,
        kategori_id: katId,
        tutar: item.tutar,
        islem_tarihi: item.tarih,
        odeme_kaynagi: item.odemeKaynagi,
        aciklama: item.aciklama || null,
        olusturan_id: session.id,
        para_birimi: item.parabirimi === "USD" ? "USD" : "IQD",
        alt_kalem_id: item.altKalemId,
        masraf_yeri_id: item.masrafYeriId,
        fis_fatura_no: item.fisFaturaNo || null,
      })
      created++
    } catch (e: unknown) {
      failed++
      const msg = e instanceof Error ? e.message : "DB hatası"
      failReasons.push(`${item.tarih} / ${item.altKalem}: ${msg}`)
    }
  }

  return NextResponse.json({
    created,
    failed,
    totalParsed: preview.length,
    matchedRows: preview.filter((p) => p.matched).length,
    unmatchedRows: unmatchedCount,
    errors: [...errors, ...failReasons].slice(0, 80),
  })
}
