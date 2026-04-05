/**
 * SSE endpoint — admin dashboard için gerçek zamanlı rapor bildirimleri.
 * GET /api/notifications/stream
 *
 * İstemci bağlandığında:
 * 1. Son bildirimleri hemen gönderir (catch-up)
 * 2. Yeni bildirimler geldiğinde push yapar
 * 3. Her 25 saniyede heartbeat gönderir (proxy timeout engeli)
 */

import { type NextRequest, NextResponse } from "next/server"
import { getSessionFromRequest, canAccessIdari } from "@/lib/auth"
import { subscribeToNotifications, getRecentNotifications } from "@/lib/notification-bus"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: "Giriş yapmalısınız." }, { status: 401 })
  if (!canAccessIdari(session.role)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Bağlantı kuruldu mesajı
      controller.enqueue(encoder.encode("data: {\"type\":\"connected\"}\n\n"))

      // Catch-up: son bildirimleri gönder
      const recent = getRecentNotifications(10)
      for (const n of recent.reverse()) {
        const data = `data: ${JSON.stringify({ ...n, _replay: true })}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // Yeni bildirimlere abone ol
      const unsubscribe = subscribeToNotifications((notification) => {
        try {
          const data = `data: ${JSON.stringify(notification)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch {
          unsubscribe()
        }
      })

      // Heartbeat — 25s'de bir keep-alive gönder
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"))
        } catch {
          clearInterval(heartbeat)
          unsubscribe()
        }
      }, 25_000)

      // İstemci bağlantıyı kestiğinde temizle
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat)
        unsubscribe()
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",  // Nginx proxy buffering'i kapat
    },
  })
}
