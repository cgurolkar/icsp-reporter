import { NextResponse } from "next/server"
import pool from "@/lib/db"

export async function GET() {
  try {
    // Veritabanı bağlantısını test et
    const connection = await pool.getConnection()
    
    // Basit bir sorgu çalıştır
    const [rows] = await connection.execute("SELECT 1 as test")
    
    // Bağlantıyı serbest bırak
    connection.release()
    
    return NextResponse.json({
      success: true,
      message: "Veritabanı bağlantısı başarılı",
      test: rows
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