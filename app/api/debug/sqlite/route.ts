import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/sqlite"

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }
  try {
    const db = await getDatabase()

    // Kullanıcıları listele
    const users = await db.all("SELECT id, username, email, full_name FROM users")
    
    // Şantiyeleri listele
    const sites = await db.all("SELECT id, site_code, name, location FROM sites")
    
    // Yetkileri listele
    const permissions = await db.all(`
      SELECT usp.user_id, usp.site_id, usp.role, u.username, s.name as site_name
      FROM user_site_permissions usp
      JOIN users u ON usp.user_id = u.id
      JOIN sites s ON usp.site_id = s.id
    `)

    return NextResponse.json({
      success: true,
      message: "SQLite bağlantısı başarılı",
      users,
      sites,
      permissions
    })

  } catch (error) {
    console.error("SQLite connection error:", error)
    return NextResponse.json({ 
      success: false,
      error: "SQLite bağlantı hatası", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 