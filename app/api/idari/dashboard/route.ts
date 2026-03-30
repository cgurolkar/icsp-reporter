import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari } from "@/lib/auth"
import { initializeDatabase } from "@/lib/database"
import pool from "@/lib/database"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  await initializeDatabase()

  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get("siteId") ? parseInt(searchParams.get("siteId")!, 10) : null

  const client = await pool.connect()
  try {
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = today.slice(0, 7) + "-01"

    // Toplam aktif personel
    const personelRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM personel WHERE isten_cikis_tarihi IS NULL OR isten_cikis_tarihi > CURRENT_DATE`
    )
    const personelSayisi = parseInt(personelRes.rows[0]?.cnt ?? "0", 10)

    // Bugünkü puantaj (kaç kişi geldi)
    let puantajQuery = `SELECT COUNT(*) AS cnt FROM puantaj WHERE tarih = $1 AND carpan > 0`
    const puantajParams: unknown[] = [today]
    if (siteId) { puantajQuery += ` AND site_id = $2`; puantajParams.push(siteId) }
    const puantajRes = await client.query(puantajQuery, puantajParams)
    const bugunGelen = parseInt(puantajRes.rows[0]?.cnt ?? "0", 10)

    // Bu ay harcama toplamı
    let harcamaQuery = `SELECT COALESCE(SUM(tutar), 0) AS toplam FROM islemler WHERE islem_tarihi >= $1`
    const harcamaParams: unknown[] = [monthStart]
    if (siteId) { harcamaQuery += ` AND site_id = $2`; harcamaParams.push(siteId) }
    const harcamaRes = await client.query(harcamaQuery, harcamaParams)
    const buAyHarcama = parseFloat(harcamaRes.rows[0]?.toplam ?? "0")

    // Envanter toplam kalem sayısı
    const envanterRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM envanter WHERE durum != 'hurda'`
    )
    const envanterSayisi = parseInt(envanterRes.rows[0]?.cnt ?? "0", 10)

    // Yaklaşan / süresi dolan belge uyarıları
    const uyariRes = await client.query(
      `SELECT COUNT(*) AS cnt FROM personel_belgeler
       WHERE gecerlilik_tarihi IS NOT NULL AND gecerlilik_tarihi <= CURRENT_DATE + INTERVAL '30 days'`
    )
    const uyariSayisi = parseInt(uyariRes.rows[0]?.cnt ?? "0", 10)

    return NextResponse.json({
      personelSayisi,
      bugunGelen,
      buAyHarcama,
      envanterSayisi,
      uyariSayisi,
    })
  } catch (error) {
    console.error("Dashboard GET error:", error)
    return NextResponse.json({ error: "Veri alınamadı." }, { status: 500 })
  } finally {
    client.release()
  }
}
