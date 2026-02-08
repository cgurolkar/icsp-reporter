import { NextRequest, NextResponse } from "next/server"
import { getDatabase } from "@/lib/sqlite"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()
    const db = await getDatabase()

    console.log("Testing login for:", username)

    // Kullanıcıyı bul
    const user = await db.get("SELECT * FROM users WHERE username = ?", [username])
    
    if (!user) {
      return NextResponse.json({ error: "User not found" })
    }

    // Şifre kontrolü
    const isValid = await bcrypt.compare(password, user.password_hash)

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name
      },
      passwordValid: isValid,
      storedHash: user.password_hash
    })

  } catch (error) {
    console.error("Login test error:", error)
    return NextResponse.json({ 
      error: "Login test failed", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 