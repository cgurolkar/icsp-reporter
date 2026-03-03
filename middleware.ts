import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionFromRequest, canAccessAdmin } from "@/lib/auth-session"

const LOGIN_PATH = "/login"
const ADMIN_PREFIX = "/admin"
const PROJE_HOME = "/proje"

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  if (pathname === "/idari") return true
  if (pathname === LOGIN_PATH) return true
  if (pathname.startsWith("/api/auth/login")) return true
  return false
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    const session = await getSessionFromRequest(request)
    if (session && pathname === LOGIN_PATH) {
      return NextResponse.redirect(new URL(PROJE_HOME, request.url))
    }
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(request)
  if (!session) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith(ADMIN_PREFIX) && !canAccessAdmin(session.role)) {
    return NextResponse.redirect(new URL(PROJE_HOME, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js).*)"],
}
