import { NextRequest, NextResponse } from "next/server"
import pool, { initializeDatabase } from "@/lib/database"
import { verifyPassword, hashPassword, createToken, setSessionCookie, type Role } from "@/lib/auth"

const ALLOWED_ROLES: Role[] = ["super_admin", "admin", "manager", "user", "personel", "operator", "engineer"]

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
  try {
    const body = await request.json().catch(() => ({}))
    const username = typeof body.username === "string" ? body.username.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!username || !password) {
      return NextResponse.json({ error: "Kullanıcı adı ve şifre gerekli." }, { status: 400 })
    }

    // Login sayfası DB init tetiklemez; eksik sütunlar (must_change_password vb.) olunca SELECT patlıyordu
    await initializeDatabase()

    const client = await pool.connect()
    let row: {
      id: number
      username: string
      password_hash: string
      role: string
      site_id: number | null
      secondary_site_id: number | null
      must_change_password: boolean
      module_permissions: Record<string, string> | null
    } | null = null
    try {
      const result = await client.query(
        `SELECT id, username, password_hash, role, site_id, secondary_site_id, must_change_password, module_permissions FROM users WHERE username = $1`,
        [username]
      )
      row = result.rows[0] || null
    } finally {
      client.release()
    }

    if (!row) {
      return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 })
    }

    const rawRole = String(row.role || "").toLowerCase()
    const role = ALLOWED_ROLES.includes(rawRole as Role) ? (rawRole as Role) : "user"
    let valid = false
    if (isBcryptHash(row.password_hash)) {
      valid = await verifyPassword(password, row.password_hash)
    } else {
      valid = legacyPasswordMatch(password, row.password_hash)
      if (valid) {
        const newHash = await hashPassword(password)
        const client2 = await pool.connect()
        try {
          await client2.query("UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [newHash, row.id])
        } finally {
          client2.release()
        }
      }
    }
    if (!valid) {
      return NextResponse.json({ error: "Kullanıcı adı veya şifre hatalı." }, { status: 401 })
    }

    // Parse module_permissions from DB (JSONB column)
    const rawPerms = row.module_permissions
    const modulePermissions: Record<string, string> | undefined =
      rawPerms && typeof rawPerms === "object" && !Array.isArray(rawPerms)
        ? (rawPerms as Record<string, string>)
        : undefined

    // "Genel" users: site_id is null AND view_all_sites = "write" in module_permissions
    const viewAllSites =
      role === "super_admin" ||
      role === "admin" ||
      role === "manager" ||
      (modulePermissions?.view_all_sites === "write")

    const token = await createToken({
      id: row.id,
      username: row.username,
      role,
      siteId: row.site_id ?? null,
      secondarySiteId: row.secondary_site_id ?? null,
      mustChangePassword: row.must_change_password === true,
      modulePermissions,
      viewAllSites,
    })

    const forwardedProto = request.headers.get("x-forwarded-proto")
    const isSecureRequest =
      forwardedProto === "https" ||
      (typeof request.nextUrl?.protocol === "string" && request.nextUrl.protocol === "https:") ||
      (typeof request.url === "string" && request.url.startsWith("https://"))
    const response = NextResponse.json({
      success: true,
      user: {
        id: row.id,
        username: row.username,
        role,
        siteId: row.site_id ?? null,
        secondarySiteId: row.secondary_site_id ?? null,
        mustChangePassword: row.must_change_password === true,
        modulePermissions,
        viewAllSites,
      },
    })
    response.headers.set("Set-Cookie", setSessionCookie(token, isSecureRequest))
    return response
  } catch (e) {
    console.error("Login error:", e)
    return NextResponse.json({ error: "Giriş işlemi başarısız." }, { status: 500 })
  }
}
