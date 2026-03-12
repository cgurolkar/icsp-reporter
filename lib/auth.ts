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
  return role === "admin"
}

export function canViewReports(role: Role): boolean {
  return role === "admin" || role === "manager"
}

export function canDoDataEntry(role: Role): boolean {
  return role === "admin" || role === "user" || role === "personel"
}

/** Sadece makine bilgisi girişi (operatör) */
export function canDoMachineEntry(role: Role): boolean {
  return role === "operator"
}

export function canViewAllSites(role: Role): boolean {
  return role === "admin" || role === "manager"
}

/** İdari modüle erişim (operator hariç) */
export function canAccessIdari(role: Role): boolean {
  return role === "admin" || role === "manager" || role === "user" || role === "personel"
}

/** Personel/özlük/finans girişi (merkez İK/idari) */
export function canManageIdariCentral(role: Role): boolean {
  return role === "admin" || role === "manager"
}
