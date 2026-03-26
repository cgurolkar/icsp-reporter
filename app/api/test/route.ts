import { NextResponse } from "next/server"

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }
  return NextResponse.json({
    message: "API çalışıyor!",
    timestamp: new Date().toISOString()
  })
} 