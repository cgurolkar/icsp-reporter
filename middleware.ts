import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionFromRequest, canAccessAdmin } from "@/lib/auth-session"

const LOGIN_PATH = "/login"
const ADMIN_PREFIX = "/admin"
const IDARI_PREFIX = "/idari"
const REPORTS_PREFIX = "/reports"
const FORM_PREFIX = "/form"
const CHANGE_PASSWORD_PATH = "/change-password"
const PROJE_HOME = "/proje"
const OPERATOR_HOME = "/operator-form"

function isPublicPath(pathname: string): boolean {
  if (pathname === LOGIN_PATH) return true
  if (pathname.startsWith("/api/auth/login")) return true
  return false
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(request)

  // Kök path: giriş yapmışsa rolüne göre yönlendir, yapmamışsa login
  if (pathname === "/") {
    if (session) {
      const dest = session.mustChangePassword ? CHANGE_PASSWORD_PATH : (session.role === "operator" ? OPERATOR_HOME : PROJE_HOME)
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }

  if (isPublicPath(pathname)) {
    if (session && pathname === LOGIN_PATH) {
      const dest = session.mustChangePassword ? CHANGE_PASSWORD_PATH : (session.role === "operator" ? OPERATOR_HOME : PROJE_HOME)
      return NextResponse.redirect(new URL(dest, request.url))
    }
    return NextResponse.next()
  }

  if (!session) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (session.mustChangePassword && pathname !== CHANGE_PASSWORD_PATH) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url))
  }

  if (!session.mustChangePassword && pathname === CHANGE_PASSWORD_PATH) {
    const dest = session.role === "operator" ? OPERATOR_HOME : PROJE_HOME
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Operator rolü yalnızca /operator-form'a erişebilir
  if (session.role === "operator" && !pathname.startsWith(OPERATOR_HOME)) {
    return NextResponse.redirect(new URL(OPERATOR_HOME, request.url))
  }

  const role = String(session.role || "").toLowerCase()
  const modulePerms = session.modulePermissions || {}
  const hasModulePerm = (key: string) => modulePerms[key] === "view" || modulePerms[key] === "write"
  const canViewReports = role === "super_admin" || role === "admin" || role === "manager" || role === "user" || role === "personel" || role === "engineer" || session.viewAllSites === true
  const canDoDataEntry = role === "super_admin" || role === "admin" || role === "user" || role === "personel" || role === "engineer" || hasModulePerm("bilgi_giris")

  if (pathname.startsWith(ADMIN_PREFIX) && !canAccessAdmin(session.role)) {
    return NextResponse.redirect(new URL(PROJE_HOME, request.url))
  }

  // /idari sadece admin/manager/user/personel; operator engellenmiş (yukarıda)
  if (pathname.startsWith(IDARI_PREFIX) && session.role === "operator") {
    return NextResponse.redirect(new URL(OPERATOR_HOME, request.url))
  }

  // Raporlar erişimi role göre
  if (pathname.startsWith(REPORTS_PREFIX) && !canViewReports) {
    return NextResponse.redirect(new URL(PROJE_HOME, request.url))
  }

  // Bilgi girişi erişimi role göre
  if (pathname.startsWith(FORM_PREFIX) && !canDoDataEntry) {
    return NextResponse.redirect(new URL(PROJE_HOME, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|sw.js).*)"],
}
