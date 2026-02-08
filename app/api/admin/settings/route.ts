import { type NextRequest, NextResponse } from "next/server"

/**
 * NOTE: In a real project you would read/write this data
 * from a database.  For the MVP we keep it in-memory.
 */
let settings: {
  emails: string[]
  users: string[]
  customFields: string[]
  totalPiles: string
} = {
  emails: ["admin@company.com", "manager@company.com"],
  users: ["admin", "manager"],
  customFields: ["Extra Field 1", "Extra Field 2"],
  totalPiles: "100", // default total pile count for the project
}

/* ------------------------------------------------------------------ */
/*  GET  /api/admin/settings                                          */
/* ------------------------------------------------------------------ */
export async function GET() {
  try {
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
  try {
    const body = await req.json()

    // Validate incoming data
    if (!Array.isArray(body.emails) || !Array.isArray(body.users) || !Array.isArray(body.customFields)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    settings = {
      emails: body.emails.filter((e: string) => !!e?.trim()),
      users: body.users.filter((u: string) => !!u?.trim()),
      customFields: body.customFields.filter((f: string) => !!f?.trim()),
      totalPiles: String(body.totalPiles ?? settings.totalPiles),
    }

    console.log("Settings saved:", settings)
    return NextResponse.json({ success: true, settings }, { status: 200 })
  } catch (err) {
    console.error("POST /api/admin/settings failed:", err)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
