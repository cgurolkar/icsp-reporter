import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessAdmin } from "@/lib/auth"
import { getGlobalAdminPanelSettings, saveGlobalAdminPanelSettings } from "@/lib/database"

/* ------------------------------------------------------------------ */
/*  GET  /api/admin/settings                                          */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 })
  }
  try {
    const settings = await getGlobalAdminPanelSettings()
    return NextResponse.json(settings, { status: 200 })
  } catch (err) {
    console.error("GET /api/admin/settings failed:", err)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/admin/settings                                          */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || !canAccessAdmin(session.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 })
  }
  try {
    const body = await req.json()

    if (!Array.isArray(body.emails) || !Array.isArray(body.users) || !Array.isArray(body.customFields)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const prev = await getGlobalAdminPanelSettings()
    const saved = await saveGlobalAdminPanelSettings({
      emails: body.emails.filter((e: string) => !!e?.trim()),
      users: body.users.filter((u: string) => !!u?.trim()),
      customFields: body.customFields.filter((f: string) => !!f?.trim()),
      totalPiles: String(body.totalPiles ?? prev.totalPiles),
    })

    console.log("Settings saved:", saved)
    return NextResponse.json({ success: true, settings: saved }, { status: 200 })
  } catch (err) {
    console.error("POST /api/admin/settings failed:", err)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
