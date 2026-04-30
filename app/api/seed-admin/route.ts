import { NextRequest, NextResponse } from "next/server"
import pool, { initializeDatabase } from "@/lib/database"
import { hashPassword } from "@/lib/auth"

export const dynamic = "force-dynamic"

const DEFAULT_SEED_USER = "the_boss"
const DEFAULT_SEED_PASS = "Admin123!"

function allowDevEnsureExtraAdmin(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_SEED_DEV_EXTRA === "true"
}

async function insertBcryptAdmin(client: import("pg").PoolClient, username: string, password: string) {
  const passwordHash = await hashPassword(password)
  await client.query(
    "INSERT INTO users (username, password_hash, role, email) VALUES ($1, $2, 'admin', NULL)",
    [username, passwordHash]
  )
}

export async function GET() {
  const client = await pool.connect()
  try {
    await initializeDatabase()
    const countResult = await client.query("SELECT COUNT(*) AS c FROM users")
    const count = parseInt(countResult.rows[0]?.c ?? "0", 10)
    const username = process.env.SEED_ADMIN_USERNAME ?? DEFAULT_SEED_USER
    const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_PASS

    if (count === 0) {
      await insertBcryptAdmin(client, username, password)
      client.release()
      return NextResponse.json({
        message: "Ilk admin olusturuldu.",
        username,
        passwordHint: "Varsayilan sifre ortam degiskeninde; yoksa Admin123!",
      })
    }

    // DB'de baska kullanicilar varken the_boss hic eklenmemisse (cogu lokal sorun), gelistirmede tamamla
    if (allowDevEnsureExtraAdmin()) {
      const exists = await client.query("SELECT 1 FROM users WHERE username = $1", [username])
      if (exists.rowCount === 0) {
        await insertBcryptAdmin(client, username, password)
        client.release()
        return NextResponse.json({
          message: "Var olan kullanicilara ek olarak gelistirme hesabi eklendi.",
          username,
          note: "Sifre: SEED_ADMIN_PASSWORD veya varsayilan Admin123! (sondaki unlem dahil)",
        })
      }
    }

    const names = await client.query("SELECT username FROM users ORDER BY id ASC LIMIT 20")
    client.release()
    return NextResponse.json({
      message:
        "Veritabaninda zaten kullanici var; ilk-seed atlandi. the_boss yoksa ve NODE_ENV=production degilse bu URL'yi tekrar acin — eksik hesap eklenir.",
      count,
      sampleUsernames: names.rows.map((r: { username: string }) => r.username),
      hint: "Eski seed ile admin/admin veya user1/user1 de deneyebilirsiniz.",
    })
  } catch (error) {
    client.release()
    console.error("Seed admin GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed basarisiz" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect()
  try {
    await initializeDatabase()
    const countResult = await client.query("SELECT COUNT(*) AS c FROM users")
    const count = parseInt(countResult.rows[0]?.c ?? "0", 10)
    let username = process.env.SEED_ADMIN_USERNAME ?? DEFAULT_SEED_USER
    let password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_PASS
    try {
      const body = await request.json().catch(() => ({}))
      if (body.username) username = String(body.username).trim()
      if (body.password) password = String(body.password)
    } catch {
      // env
    }
    if (!username || !password) {
      client.release()
      return NextResponse.json({ error: "username ve password gerekli" }, { status: 400 })
    }

    if (count === 0) {
      await insertBcryptAdmin(client, username, password)
      client.release()
      return NextResponse.json({ message: "Ilk admin olusturuldu.", username })
    }

    if (allowDevEnsureExtraAdmin()) {
      const exists = await client.query("SELECT 1 FROM users WHERE username = $1", [username])
      if (exists.rowCount === 0) {
        await insertBcryptAdmin(client, username, password)
        client.release()
        return NextResponse.json({ message: "Gelistirme hesabi eklendi.", username })
      }
    }

    client.release()
    return NextResponse.json(
      { error: "Zaten kullanici var ve bu kullanici adi da mevcut (veya production ortaminda ek izin yok)." },
      { status: 400 }
    )
  } catch (error) {
    client.release()
    console.error("Seed admin error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed basarisiz" },
      { status: 500 }
    )
  }
}
