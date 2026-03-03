import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/database"
import { hashPassword } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  const client = await pool.connect()
  try {
    const countResult = await client.query("SELECT COUNT(*) AS c FROM users")
    const count = parseInt(countResult.rows[0]?.c ?? "0", 10)
    if (count > 0) {
      client.release()
      return NextResponse.json({ message: "Zaten kullanici var. POST ile yeni admin ekleyemezsiniz.", count }, { status: 200 })
    }
    const username = process.env.SEED_ADMIN_USERNAME ?? "the_boss"
    const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!"
    const passwordHash = await hashPassword(password)
    await client.query(
      "INSERT INTO users (username, password_hash, role, email) VALUES ($1, $2, 'admin', NULL)",
      [username, passwordHash]
    )
    client.release()
    return NextResponse.json({ message: "Ilk admin olusturuldu. Kullanici adi: " + username + ", sifre: ***" })
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
    const countResult = await client.query("SELECT COUNT(*) AS c FROM users")
    const count = parseInt(countResult.rows[0]?.c ?? "0", 10)
    if (count > 0) {
      client.release()
      return NextResponse.json({ error: "Zaten kullanici var." }, { status: 400 })
    }
    let username = process.env.SEED_ADMIN_USERNAME ?? "the_boss"
    let password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!"
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
    const passwordHash = await hashPassword(password)
    await client.query(
      "INSERT INTO users (username, password_hash, role, email) VALUES ($1, $2, 'admin', NULL)",
      [username, passwordHash]
    )
    client.release()
    return NextResponse.json({ message: "Ilk admin olusturuldu.", username })
  } catch (error) {
    client.release()
    console.error("Seed admin error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seed basarisiz" },
      { status: 500 }
    )
  }
}
