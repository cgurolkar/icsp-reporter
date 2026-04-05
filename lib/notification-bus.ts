/**
 * In-memory pub/sub for SSE notifications.
 * globalThis üzerinden tutulur — Next.js hot reload'da sıfırlanmaz.
 */

export interface AdminNotification {
  id: string
  type: "new_report" | "anomaly" | "info" | "operator_entry"
  title: string
  message: string
  siteName?: string
  siteCode?: string | null
  reportId?: number
  date?: string
  anomalyCount?: number
  /** Operatör makine girişi bildirimi */
  machineName?: string
  timestamp: number
}

type NotificationListener = (notification: AdminNotification) => void

// globalThis üzerinde tek bir bus nesnesi tut
const key = "__icsp_notification_bus__"

interface NotificationBus {
  listeners: Set<NotificationListener>
  recent: AdminNotification[]  // son 50 bildirim — yeni bağlanan istemcilere göndermek için
}

function getBus(): NotificationBus {
  const g = globalThis as Record<string, unknown>
  if (!g[key]) {
    g[key] = { listeners: new Set<NotificationListener>(), recent: [] }
  }
  return g[key] as NotificationBus
}

export function subscribeToNotifications(listener: NotificationListener): () => void {
  const bus = getBus()
  bus.listeners.add(listener)
  return () => bus.listeners.delete(listener)
}

export function publishNotification(notification: Omit<AdminNotification, "id" | "timestamp">): void {
  const bus = getBus()
  const full: AdminNotification = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
  }

  // Son 50 bildirimi tut
  bus.recent.push(full)
  if (bus.recent.length > 50) bus.recent.splice(0, bus.recent.length - 50)

  // Tüm aktif dinleyicilere gönder
  for (const listener of bus.listeners) {
    try {
      listener(full)
    } catch (e) {
      // Bağlantı kopmış olabilir — listener'ı kaldır
      bus.listeners.delete(listener)
    }
  }
}

export function getRecentNotifications(limit = 20): AdminNotification[] {
  return getBus().recent.slice(-limit).reverse()
}
