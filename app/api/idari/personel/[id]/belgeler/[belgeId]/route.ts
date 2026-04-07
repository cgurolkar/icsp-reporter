import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari } from "@/lib/auth"
import { initializeDatabase, getPersonelBelgeById } from "@/lib/database"
import { resolveIdariBelgeFilePath, mimeForIdariFile, readIdariFile } from "@/lib/idari-uploads"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; belgeId: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const personelId = parseInt((await params).id, 10)
  const belgeId = parseInt((await params).belgeId, 10)
  if (Number.isNaN(personelId) || Number.isNaN(belgeId)) {
    return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })
  }

  try {
    await initializeDatabase()
    const row = await getPersonelBelgeById(personelId, belgeId)
    if (!row) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 })
    const filePath = resolveIdariBelgeFilePath(row.dosya_yolu)
    if (!filePath) return NextResponse.json({ error: "Geçersiz dosya yolu." }, { status: 400 })
    const buf = await readIdariFile(filePath)
    if (!buf) return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 })
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mimeForIdariFile(filePath),
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("Belge dosyası GET error:", error)
    return NextResponse.json({ error: "Dosya okunamadı." }, { status: 500 })
  }
}
