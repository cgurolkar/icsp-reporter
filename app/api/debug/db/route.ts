import { NextResponse } from "next/server"
import pool from "@/lib/database"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const result = await pool.query("SELECT 1 as test")
    return NextResponse.json({
      success: true,
      message: "Veritabanı bağlantısı başarılı",
      test: result.rows
    })

  } catch (error) {
    console.error("Database connection error:", error)
    return NextResponse.json({ 
      success: false,
      error: "Veritabanı bağlantı hatası", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 