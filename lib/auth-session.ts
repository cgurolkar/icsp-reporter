/**
 * Edge-safe session helpers (jose only). Use in middleware.
 * Full auth (bcrypt, cookies) is in lib/auth.ts for API routes.
 */
import { type NextRequest } from "next/server"
import { SignJWT, jwtVerify } from "jose"

const COOKIE_NAME = "icsp_session"
const SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || "icsp-dev-secret-change-in-production"
const SECRET_BYTES = new TextEncoder().encode(SECRET)
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export type Role = "admin" | "manager" | "user" | "personel"

export interface SessionUser {
  id: number
  username: string
  role: Role
  siteId: number | null
}

export async function createToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET_BYTES)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_BYTES)
    return {
      id: Number(payload.id),
      username: String(payload.username),
      role: payload.role as Role,
      siteId: payload.siteId != null ? Number(payload.siteId) : null,
    }
  } catch {
    return null
  }
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return await verifyToken(token)
}

export function canAccessAdmin(role: Role): boolean {
  return role === "admin"
}
