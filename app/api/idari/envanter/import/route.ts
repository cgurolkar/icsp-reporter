import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, createEnvanter, getEnvanterByKod, updateEnvanter } from "@/lib/database"
import { parseEnvanterExcel, type EnvanterExcelField } from "@/lib/envanter-excel"
import { persistEnvanterPhotoDataUrl } from "@/lib/envanter-upload"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role))
    return NextResponse.json({ error: "Envanter içe aktarma yetkiniz yok." }, { status: 403 })

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || !(file instanceof File))
      return NextResponse.json({ error: "Excel dosyası seçin." }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const rows = parseEnvanterExcel(buffer)
    if (rows.length === 0)
      return NextResponse.json(
        {
          error:
            "Excel'de geçerli kayıt bulunamadı. Şablonu kullanın veya sütun başlıklarını kontrol edin.",
        },
        { status: 400 }
      )

    await initializeDatabase()
    let inserted = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const r of rows) {
      try {
        const kod = r.kod.trim()
        const filled = new Set<EnvanterExcelField>(r.filledFields)
        const existing = await getEnvanterByKod(kod)

        if (!existing) {
          const fotograf_yolu = persistEnvanterPhotoDataUrl(r.fotograf_yolu ?? null)
          await createEnvanter({
            kod,
            malzeme_adi: r.malzeme_adi || "—",
            aciklama: r.aciklama ?? null,
            adet: r.adet ?? 1,
            fiyat: r.fiyat ?? null,
            yer: r.yer ?? null,
            fotograf_yolu,
            site_id: null,
          })
          inserted++
          continue
        }

        const patch: Parameters<typeof updateEnvanter>[1] = {}
        if (filled.has("malzeme_adi")) patch.malzeme_adi = r.malzeme_adi.trim() || String(existing.malzeme_adi ?? "—")
        if (filled.has("aciklama")) patch.aciklama = r.aciklama ?? null
        if (filled.has("adet")) patch.adet = r.adet != null ? r.adet : Number(existing.adet) || 1
        if (filled.has("fiyat")) patch.fiyat = r.fiyat ?? null
        if (filled.has("yer")) patch.yer = r.yer ?? null
        if (filled.has("fotograf_yolu")) {
          patch.fotograf_yolu = persistEnvanterPhotoDataUrl(r.fotograf_yolu ?? null)
        }

        const patchKeys = Object.keys(patch)
        if (patchKeys.length === 0) {
          skipped++
          continue
        }
        await updateEnvanter(existing.id as number, patch)
        updated++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${r.kod} ${r.malzeme_adi}: ${msg}`)
      }
    }

    return NextResponse.json({
      inserted,
      updated,
      skipped,
      total: rows.length,
      failed: errors.length,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error("Envanter import error:", error)
    return NextResponse.json({ error: "İçe aktarma sırasında hata oluştu." }, { status: 500 })
  }
}
