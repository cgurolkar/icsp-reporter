import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari } from "@/lib/auth"
import { initializeDatabase, getPersonelById } from "@/lib/database"
import { resolveIdariBelgeFilePath, mimeForIdariFile, readIdariFile } from "@/lib/idari-uploads"

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const personelId = parseInt((await params).id, 10)
  if (Number.isNaN(personelId)) {
    return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })
  }

  try {
    await initializeDatabase()
    const row = await getPersonelById(personelId)
    if (!row?.foto_yolu) return NextResponse.json({ error: "Foto yok." }, { status: 404 })
    const filePath = resolveIdariBelgeFilePath(row.foto_yolu as string)
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
    console.error("Personel foto GET error:", error)
    return NextResponse.json({ error: "Dosya okunamadı." }, { status: 500 })
  }
}
