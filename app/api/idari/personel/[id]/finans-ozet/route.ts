import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { canAccessIdari } from "@/lib/auth"
import { initializeDatabase, getPersonelFinansOzet } from "@/lib/database"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(_request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role, session)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const personelId = parseInt((await params).id, 10)
  if (Number.isNaN(personelId)) return NextResponse.json({ error: "Geçersiz ID." }, { status: 400 })

  try {
    await initializeDatabase()
    const ozet = await getPersonelFinansOzet(personelId)
    if (!ozet) return NextResponse.json({ error: "Personel bulunamadı veya özet alınamadı." }, { status: 404 })
    return NextResponse.json(ozet)
  } catch (error) {
    console.error("Finans özet GET error:", error)
    return NextResponse.json({ error: "Özet alınamadı." }, { status: 500 })
  }
}
