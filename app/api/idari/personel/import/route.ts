import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canManageIdariCentral } from "@/lib/auth"
import { initializeDatabase, createPersonel } from "@/lib/database"
import { parsePersonelExcel } from "@/lib/personel-excel"

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canManageIdariCentral(session.role))
    return NextResponse.json({ error: "Personel içe aktarma yetkiniz yok." }, { status: 403 })

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || !(file instanceof File))
      return NextResponse.json({ error: "Excel dosyası seçin." }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const rows = parsePersonelExcel(buffer)
    if (rows.length === 0)
      return NextResponse.json({ error: "Excel'de geçerli personel satırı bulunamadı. Şablonu kullanın veya sütun başlıklarını kontrol edin." }, { status: 400 })

    await initializeDatabase()
    let inserted = 0
    const errors: string[] = []

    for (const r of rows) {
      try {
        await createPersonel({
          ad: r.ad,
          soyad: r.soyad,
          gorev: r.gorev,
          tc_kimlik: r.tc_kimlik ?? null,
          pasaport_no: r.pasaport_no ?? null,
          calistigi_bolum: r.calistigi_bolum ?? null,
          dogum_tarihi: r.dogum_tarihi ?? null,
          kan_grubu: r.kan_grubu ?? null,
          acil_iletisim: r.acil_iletisim ?? null,
          acil_telefon: r.acil_telefon ?? null,
          ise_giris_tarihi: r.ise_giris_tarihi ?? null,
          isten_cikis_tarihi: r.isten_cikis_tarihi ?? null,
          sigorta_durumu: r.sigorta_durumu ?? null,
          iban: r.iban ?? null,
          banka_adi: r.banka_adi ?? null,
          gunluk_yevmiye: r.gunluk_yevmiye ?? null,
          aylik_maas: r.aylik_maas ?? null,
        })
        inserted++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${r.ad} ${r.soyad}: ${msg}`)
      }
    }

    return NextResponse.json({
      inserted,
      total: rows.length,
      failed: rows.length - inserted,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error("Personel import error:", error)
    return NextResponse.json({ error: "İçe aktarma sırasında hata oluştu." }, { status: 500 })
  }
}
