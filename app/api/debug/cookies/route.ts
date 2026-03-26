import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 })
  }
  try {
    const cookieStore = cookies()
    const authToken = cookieStore.get('auth-token')
    
    // Request header'larından da cookie'leri al
    const requestCookies = request.headers.get('cookie')
    
    return NextResponse.json({
      success: true,
      cookieStore: {
        authToken: authToken ? {
          name: authToken.name,
          value: authToken.value.substring(0, 50) + "...",
          exists: true
        } : null
      },
      requestHeaders: {
        cookie: requestCookies
      },
      allCookies: Array.from(cookieStore.getAll()).map(cookie => ({
        name: cookie.name,
        value: cookie.value.substring(0, 20) + "..."
      }))
    })

  } catch (error) {
    console.error("Cookie debug error:", error)
    return NextResponse.json({ 
      success: false,
      error: "Cookie debug failed", 
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 