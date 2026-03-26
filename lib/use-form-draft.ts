/**
 * Form taslak kaydetme hook'u.
 * Otomatik olarak her 30 saniyede bir localStorage'a kaydeder.
 * Sayfa yenilendiğinde veya kazara kapatıldığında veri kaybolmaz.
 */

"use client"

import { useEffect, useRef, useCallback } from "react"

const DRAFT_KEY_PREFIX = "icsp_form_draft_"
const AUTOSAVE_INTERVAL = 30_000  // 30 saniye

export interface DraftMeta {
  savedAt: number        // timestamp
  siteId?: number | null
  siteName?: string
  date?: string
}

export interface DraftData<T> {
  meta: DraftMeta
  formData: T
}

/**
 * Belirli bir siteId için taslak anahtarını döner.
 * siteId yoksa "global" kullanılır.
 */
function draftKey(siteId?: number | null): string {
  return `${DRAFT_KEY_PREFIX}${siteId ?? "global"}`
}

export function saveDraft<T>(formData: T, siteId?: number | null, siteName?: string, date?: string): void {
  if (typeof window === "undefined") return
  try {
    const draft: DraftData<T> = {
      meta: { savedAt: Date.now(), siteId, siteName, date },
      formData,
    }
    localStorage.setItem(draftKey(siteId), JSON.stringify(draft))
  } catch (e) {
    console.warn("Draft save failed:", e)
  }
}

export function loadDraft<T>(siteId?: number | null): DraftData<T> | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(draftKey(siteId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftData<T>
    // 24 saatten eski taslakları yoksay
    if (Date.now() - parsed.meta.savedAt > 24 * 60 * 60 * 1000) {
      clearDraft(siteId)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearDraft(siteId?: number | null): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(draftKey(siteId))
  } catch {}
}

export function hasDraft(siteId?: number | null): boolean {
  return loadDraft(siteId) !== null
}

/**
 * React hook — formData'yı otomatik olarak 30s'de bir kaydeder.
 * Temizlemek için clearFn çağrılır (başarılı submit'ten sonra).
 */
export function useFormDraft<T>(
  formData: T,
  siteId?: number | null,
  siteName?: string,
  date?: string,
  enabled = true,
): {
  forceSave: () => void
  clear: () => void
} {
  const formDataRef = useRef(formData)
  formDataRef.current = formData

  const forceSave = useCallback(() => {
    if (!enabled) return
    saveDraft(formDataRef.current, siteId, siteName, date)
  }, [siteId, siteName, date, enabled])

  const clear = useCallback(() => {
    clearDraft(siteId)
  }, [siteId])

  // Otomatik kayıt
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      saveDraft(formDataRef.current, siteId, siteName, date)
    }, AUTOSAVE_INTERVAL)
    return () => clearInterval(timer)
  }, [siteId, siteName, date, enabled])

  // Sayfa kapatılırken de kaydet
  useEffect(() => {
    if (!enabled) return
    const onUnload = () => saveDraft(formDataRef.current, siteId, siteName, date)
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [siteId, siteName, date, enabled])

  return { forceSave, clear }
}
