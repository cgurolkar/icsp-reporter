import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari } from "@/lib/auth"
import { buildHarcamaTemplateBuffer } from "@/lib/harcama-excel"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    const buffer = buildHarcamaTemplateBuffer()
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
