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

/** Eski GENEL KASA açıklama → eski kategori kodu (alt kalem bulunamazsa) */
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
      error: "Geçerli satır bulunamadı. Yeni şablonu kullanın (Tarih, Kalem Kodu, Alt Kalem, Tutar…).",
    }, { status: 400 })
  }

  const preview: PreviewItem[] = []
  const errors: string[] = []

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
    if (altId) {
      const ak = altKalemler.find((a: { id: number }) => a.id === altId) as {
        kalem_kod?: string
      } | undefined
      kalemKod = ak?.kalem_kod || kalemKod
      kategoriKod = legacyKategoriKodFromKalemKod(kalemKod)
    } else if (row.format === "eski") {
      kategoriKod = mapLegacyCategory(row.altKalem || row.aciklama)
      errors.push(`${row.tarih}: Alt kalem eşleşmedi (“${row.altKalem}”) — eski kategori: ${kategoriKod}`)
    } else {
      errors.push(`${row.tarih}: Alt kalem bulunamadı: “${row.altKalem}”`)
      // Önizlemede göster; aktarımda atlanır
    }

    let aciklama = row.aciklama
    if (row.format === "eski") {
      aciklama = [
        row.ch && row.ch !== "ICS" ? `[${row.ch}]` : null,
        row.fatNo ? `#${row.fatNo}` : null,
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
    })
  }

  if (previewOnly) {
    return NextResponse.json({
      preview: preview.slice(0, 100),
      totalRows: preview.length,
      errors: errors.slice(0, 50),
    })
  }

  let created = 0
  let failed = 0
  const skipNoMatch = preview.filter((p) => !p.matched && p.format === "yeni")
  const toInsert = preview.filter((p) => p.matched || p.format === "eski")

  for (const item of toInsert) {
    try {
      const katId = item.matched
        ? await resolveKategoriIdForAltKalem(item.altKalemId)
        : katMap[item.kategoriKod] ?? katMap["diger"]
      if (!katId) {
        failed++
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
      })
      created++
    } catch {
      failed++
    }
  }

  return NextResponse.json({
    created,
    failed: failed + skipNoMatch.length,
    totalParsed: preview.length,
    errors,
  })
}
