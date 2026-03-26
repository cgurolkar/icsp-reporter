import { NextResponse } from "next/server"
import mysql from 'mysql2/promise'

export const dynamic = "force-dynamic"

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }
  try {
    // MySQL bağlantısını test et
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      port: 3306
    })

    // Veritabanlarını listele
    const [databases] = await connection.execute('SHOW DATABASES')
    
    // work_report_app veritabanını kontrol et
    const [dbExists] = await connection.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'work_report_app'")
    
    let tables: any[] = []
    if (Array.isArray(dbExists) && dbExists.length > 0) {
      await connection.execute('USE work_report_app')
      const [tablesResult] = await connection.execute('SHOW TABLES')
      tables = Array.isArray(tablesResult) ? tablesResult : []
    }

    await connection.end()

    return NextResponse.json({
      success: true,
      databases,
      workReportAppExists: Array.isArray(dbExists) && dbExists.length > 0,
      tables
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