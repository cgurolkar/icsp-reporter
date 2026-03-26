import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari } from "@/lib/auth"
import { buildEnvanterTemplateBuffer } from "@/lib/envanter-excel"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const buffer = buildEnvanterTemplateBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="envanter_sablonu.xlsx"',
    },
  })
}
