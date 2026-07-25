import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari } from "@/lib/auth"
import { initializeDatabase, getHarcamaTanimlar } from "@/lib/database"
import { buildHarcamaTemplateBuffer } from "@/lib/harcama-excel"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    await initializeDatabase()
    const tanimlar = await getHarcamaTanimlar()
    const buffer = buildHarcamaTemplateBuffer({
      kalemler: (tanimlar.kalemler || []).map((k: { kod: string; ad: string }) => ({ kod: k.kod, ad: k.ad })),
      altKalemler: (tanimlar.altKalemler || []).map(
        (a: { kalem_kod?: string; kalem_ad?: string; ad: string }) => ({
          kalem_kod: a.kalem_kod || "",
          kalem_ad: a.kalem_ad || "",
          ad: a.ad,
        }),
      ),
      masrafYerleri: (tanimlar.masrafYerleri || []).map((m: { ad: string; tip: string }) => ({
        ad: m.ad,
        tip: m.tip,
      })),
    })
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="harcama_sablonu.xlsx"',
      },
    })
  } catch (error) {
    console.error("Harcama şablon hatası:", error)
    return NextResponse.json({ error: "Şablon oluşturulamadı." }, { status: 500 })
  }
}
