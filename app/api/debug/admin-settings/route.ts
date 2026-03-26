import { NextResponse } from "next/server"
import { getDatabase } from "@/lib/sqlite"

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }
  try {
    const db = await getDatabase()

    // Test database connection
    const testResult = await db.get("SELECT 1 as test")
    console.log("Database test result:", testResult)
    
    // Check if site_settings table exists
    const tableExists = await db.get(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='site_settings'
    `)
    console.log("Site settings table exists:", !!tableExists)
    
    // Get all settings for site 1
    const settings = await db.all(`
      SELECT setting_key, setting_value 
      FROM site_settings 
      WHERE site_id = ?
    `, [1])
    
    console.log("Settings from database:", settings)
    
    // Return default settings if none found
    const defaultSettings = {
      emails: ["admin@company.com", "manager@company.com"],
      users: ["admin", "manager"],
      customFields: ["Extra Field 1", "Extra Field 2"],
      machines: ["XCMG SR220", "SANY 285"],
      totalPiles: "100"
    }
    
    // Parse settings from database
    settings.forEach((row: any) => {
      if (row.setting_key === 'emails') {
        try {
          defaultSettings.emails = JSON.parse(row.setting_value)
        } catch (e) {
          console.log("Error parsing emails:", e)
        }
      } else if (row.setting_key === 'users') {
        try {
          defaultSettings.users = JSON.parse(row.setting_value)
        } catch (e) {
          console.log("Error parsing users:", e)
        }
      } else if (row.setting_key === 'customFields') {
        try {
          defaultSettings.customFields = JSON.parse(row.setting_value)
        } catch (e) {
          console.log("Error parsing customFields:", e)
        }
      } else if (row.setting_key === 'machines') {
        try {
          defaultSettings.machines = JSON.parse(row.setting_value)
        } catch (e) {
          console.log("Error parsing machines:", e)
        }
      } else if (row.setting_key === 'totalPiles') {
        defaultSettings.totalPiles = row.setting_value
      }
    })
    
    return NextResponse.json({
      success: true,
      databaseTest: testResult,
      tableExists: !!tableExists,
      settings: defaultSettings,
      rawSettings: settings
    })
    
  } catch (error) {
    console.error("Debug admin settings error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
} 