"use client"

import { useEffect } from "react"

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    window.navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("PWA: Service Worker registered", reg.scope)
      })
      .catch((err) => {
        console.warn("PWA: Service Worker registration failed", err)
      })
  }, [])
  return null
}
