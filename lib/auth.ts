import { type NextRequest } from "next/server"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import {
  createToken,
  verifyToken,
  getSessionFromRequest as getSessionFromRequestEdge,
  type Role,
  type SessionUser,
} from "./auth-session"

export type { Role, SessionUser }
const COOKIE_NAME = "icsp_session"
const MAX_AGE = 60 * 60 * 24 * 7

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export { createToken }

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return await verifyToken(token)
}

/** API route'da request'ten session oku */
export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  return getSessionFromRequestEdge(request)
}

/** secure: true only over HTTPS, so cookie is stored on HTTP (e.g. http://server:3001) */
export function setSessionCookie(token: string, secure?: boolean): string {
  const isSecure = secure ?? (process.env.NODE_ENV === "production" && process.env.VERCEL === "1")
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${isSecure ? "; Secure" : ""}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/** Rol yetkileri */
export function canAccessAdmin(role: Role): boolean {
  return role === "super_admin" || role === "admin"
}

export function canViewReports(role: Role): boolean {
  // admin ve manager tüm şantiyeleri görebilir; user ve personel kendi şantiyelerini görebilir
  return role === "super_admin" || role === "admin" || role === "manager" || role === "user" || role === "personel" || role === "engineer"
}

export function canDoDataEntry(role: Role, session?: SessionUser | null): boolean {
  if (role === "super_admin" || role === "admin" || role === "user" || role === "personel" || role === "engineer") return true
  if (session) return canAccessModule(session, "bilgi_giris", "write")
  return false
}

/** Sadece makine bilgisi girişi (operatör) */
export function canDoMachineEntry(role: Role): boolean {
  return role === "operator"
}

/**
 * Check if user can view all sites.
 * Pass the full session object when available so "Genel" users are also included.
 */
export function canViewAllSites(role: Role, session?: SessionUser | null): boolean {
  if (role === "super_admin" || role === "admin" || role === "manager") return true
  return session?.viewAllSites === true
}

/**
 * Check if user has access to a specific module at the given level.
 * "write" implies "view". Used for module-permission-gated features.
 */
export function canAccessModule(session: SessionUser, moduleKey: string, level: "view" | "write" = "view"): boolean {
  const perms = session.modulePermissions
  if (!perms) return false
  const perm = perms[moduleKey]
  if (level === "view") return perm === "view" || perm === "write"
  return perm === "write"
}

/** İdari modüle erişim (operator hariç) — extended by module permissions */
export function canAccessIdari(role: Role, session?: SessionUser | null): boolean {
  if (role === "super_admin" || role === "admin" || role === "manager" || role === "user" || role === "personel" || role === "engineer") return true
  // A user with any idari module permission (view or write) can access the idari area
  if (session) {
    const idariModules = ["personel", "envanter", "harcamalar", "puantaj", "bilgi_giris", "makineler"]
    return idariModules.some((m) => canAccessModule(session, m, "view"))
  }
  return false
}

/** Personel/özlük/finans girişi (merkez İK/idari) */
export function canManageIdariCentral(role: Role): boolean {
  return role === "super_admin" || role === "admin" || role === "manager"
}

/** Modül bazlı yazma izni (role write yetkileriyle birlikte). */
export function canWriteIdariModule(session: SessionUser, moduleKey: string): boolean {
  if (canManageIdariCentral(session.role)) return true
  return canAccessModule(session, moduleKey, "write")
}

/** Puantaj girişi: sadece o şantiyenin sorumlusu veya admin */
export function canEnterTimesheet(role: Role, sessionSiteId: number | null | undefined, targetSiteId: number): boolean {
  if (role === "super_admin" || role === "admin") return true
  return sessionSiteId != null && sessionSiteId === targetSiteId
}

/** Puantaj onaylama: merkez (admin/manager) */
export function canApproveTimesheet(role: Role): boolean {
  return role === "super_admin" || role === "admin" || role === "manager"
}
