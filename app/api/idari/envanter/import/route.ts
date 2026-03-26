import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, createEnvanter } from "@/lib/database"
import { parseEnvanterExcel } from "@/lib/envanter-excel"

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
    const errors: string[] = []

    for (const r of rows) {
      try {
        await createEnvanter({
          kod: r.kod,
          malzeme_adi: r.malzeme_adi,
          aciklama: r.aciklama ?? null,
          adet: r.adet ?? 1,
          fiyat: r.fiyat ?? null,
          yer: r.yer ?? null,
          fotograf_yolu: r.fotograf_yolu ?? null,
          site_id: null,
        })
        inserted++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${r.kod} ${r.malzeme_adi}: ${msg}`)
      }
    }

    return NextResponse.json({
      inserted,
      total: rows.length,
      failed: rows.length - inserted,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error("Envanter import error:", error)
    return NextResponse.json({ error: "İçe aktarma sırasında hata oluştu." }, { status: 500 })
  }
}
