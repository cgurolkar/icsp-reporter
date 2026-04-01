import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari } from "@/lib/auth"
import { buildPersonelTemplateBuffer } from "@/lib/personel-excel"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  try {
    const buffer = buildPersonelTemplateBuffer()
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="personel_sablonu.xlsx"',
      },
    })
  } catch (error) {
    console.error("Personel şablon hatası:", error)
    return NextResponse.json({ error: "Şablon oluşturulamadı." }, { status: 500 })
  }
}
