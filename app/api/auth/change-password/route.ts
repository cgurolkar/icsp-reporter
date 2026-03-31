import { NextRequest, NextResponse } from "next/server"
import pool, { initializeDatabase } from "@/lib/database"
import { getSessionFromRequest, verifyPassword, hashPassword, createToken, setSessionCookie } from "@/lib/auth"

function isBcryptHash(hash: string): boolean {
  return typeof hash === "string" && (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$"))
}

function legacyPasswordMatch(password: string, storedHash: string): boolean {
  try {
    const encoded = Buffer.from(password).toString("base64")
    return encoded === storedHash
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ success: false, error: "Oturum bulunamadı." }, { status: 401 })
  }

  await initializeDatabase()
  const body = await request.json().catch(() => ({}))
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ success: false, error: "Mevcut ve yeni şifre gerekli." }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ success: false, error: "Yeni şifre en az 6 karakter olmalı." }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ success: false, error: "Yeni şifre mevcut şifre ile aynı olamaz." }, { status: 400 })
  }

  const client = await pool.connect()
  try {
    const result = await client.query("SELECT id, username, role, site_id, password_hash FROM users WHERE id = $1", [session.id])
    const row = result.rows[0]
    if (!row) {
      return NextResponse.json({ success: false, error: "Kullanıcı bulunamadı." }, { status: 404 })
    }

    let valid = false
    if (isBcryptHash(row.password_hash)) {
      valid = await verifyPassword(currentPassword, row.password_hash)
    } else {
      valid = legacyPasswordMatch(currentPassword, row.password_hash)
    }
    if (!valid) {
      return NextResponse.json({ success: false, error: "Mevcut şifre hatalı." }, { status: 400 })
    }

    const newHash = await hashPassword(newPassword)
    await client.query(
      "UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newHash, session.id]
    )

    const token = await createToken({
      id: row.id,
      username: row.username,
      role: session.role,
      siteId: row.site_id ?? null,
      mustChangePassword: false,
    })

    const forwardedProto = request.headers.get("x-forwarded-proto")
    const isSecureRequest =
      forwardedProto === "https" ||
      (typeof request.nextUrl?.protocol === "string" && request.nextUrl.protocol === "https:") ||
      (typeof request.url === "string" && request.url.startsWith("https://"))

    const response = NextResponse.json({ success: true })
    response.headers.set("Set-Cookie", setSessionCookie(token, isSecureRequest))
    return response
  } catch (error) {
    console.error("Change password error:", error)
    return NextResponse.json({ success: false, error: "Şifre güncelleme başarısız." }, { status: 500 })
  } finally {
    client.release()
  }
}
