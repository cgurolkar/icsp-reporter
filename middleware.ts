import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionFromRequest, canAccessAdmin } from "@/lib/auth-session"

const LOGIN_PATH = "/login"
const ADMIN_PREFIX = "/admin"
const IDARI_PREFIX = "/idari"
const PROJE_HOME = "/proje"
const OPERATOR_HOME = "/operator-form"

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  // /idari public path'ten kaldırıldı — giriş gerektirmeli
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
      const dest = session.role === "operator" ? OPERATOR_HOME : PROJE_HOME
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(request)
  if (!session) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Operator rolü yalnızca /operator-form'a erişebilir
  if (session.role === "operator" && !pathname.startsWith(OPERATOR_HOME)) {
    return NextResponse.redirect(new URL(OPERATOR_HOME, request.url))
  }

  if (pathname.startsWith(ADMIN_PREFIX) && !canAccessAdmin(session.role)) {
    return NextResponse.redirect(new URL(PROJE_HOME, request.url))
  }

  // /idari sadece admin/manager/user/personel; operator engellenmiş (yukarıda)
  if (pathname.startsWith(IDARI_PREFIX) && session.role === "operator") {
    return NextResponse.redirect(new URL(OPERATOR_HOME, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js).*)"],
}
