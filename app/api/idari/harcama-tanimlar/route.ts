import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest } from "@/lib/auth"
import { initializeDatabase, getHarcamaTanimlar } from "@/lib/database"

/** Ana kalem / alt kalem / masraf yeri — dropdown ve tanım ekranı */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  // Rapor formu + idari: oturum yeterli (operatör de harcama girebilir)
  try {
    await initializeDatabase()
    const data = await getHarcamaTanimlar()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Harcama tanimlar GET error:", error)
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 })
  }
}
