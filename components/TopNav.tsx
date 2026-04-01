"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export default function TopNav() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  const role = (user?.role != null ? String(user.role).toLowerCase() : null) || "user"
  const modulePerms = user?.modulePermissions ?? {}
  const hasModulePerm = (key: string) => modulePerms[key] === "view" || modulePerms[key] === "write"
  const canViewReports = role === "super_admin" || role === "admin" || role === "manager" || user?.viewAllSites
  const canDoDataEntry = role === "super_admin" || role === "admin" || role === "user" || role === "personel" || hasModulePerm("bilgi_giris")
  const canDoMachineEntry = role === "operator"
  const canAccessAdmin = role === "super_admin" || role === "admin"
  const idariModules = ["personel", "envanter", "harcamalar", "puantaj", "bilgi_giris", "makineler"]
  const canAccessIdari = role === "super_admin" || role === "admin" || role === "manager" || role === "user" || role === "personel" || idariModules.some(hasModulePerm)

  const navLinks = [
    !canDoMachineEntry && { href: "/proje", label: t("home") },
    canDoMachineEntry && { href: "/operator-form", label: t("operator_entry") },
    canViewReports && { href: "/reports", label: t("sites") },
    canDoDataEntry && { href: "/form", label: t("data_entry") },
    canAccessIdari && { href: "/idari", label: "İdari" },
  ].filter(Boolean) as { href: string; label: string }[]

  const isActive = (href: string) =>
    href === "/idari" ? pathname.startsWith("/idari") : pathname === href

  useEffect(() => {
    if (typeof window === "undefined") return

    const media = window.matchMedia("(display-mode: standalone)")
    const updateInstalled = () => setIsInstalled(media.matches)
    updateInstalled()

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onAppInstalled)
    media.addEventListener("change", updateInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onAppInstalled)
      media.removeEventListener("change", updateInstalled)
    }
  }, [])

  const canShowInstall = !isInstalled && !!installPrompt

  const handleInstallClick = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted") {
      setInstallPrompt(null)
    }
  }

  const linkStyle = (href: string): React.CSSProperties => ({
    padding: "10px 14px",
    color: isActive(href) ? "var(--icsp-lacivert)" : "#424242",
    fontWeight: isActive(href) ? 600 : 500,
    textDecoration: "none",
    fontSize: "0.92rem",
    display: "block",
    borderRadius: 4,
    whiteSpace: "nowrap",
  })

  return (
    <nav
      style={{
        background: "var(--icsp-nav-bg)",
        borderBottom: "1px solid var(--icsp-nav-border)",
        padding: "0 12px",
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Ana bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: "48px",
        }}
      >
        {/* Masaüstü linkler */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            flexWrap: "nowrap",
          }}
          className="desktop-nav"
        >
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} style={linkStyle(link.href)}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Sağ taraf: admin paneli + çıkış + hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Masaüstünde yönetici paneli ve çıkış */}
          {canAccessAdmin && (
            <Link
              href="/admin"
              className="desktop-only"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "7px 14px",
                background: "#1a237e",
                color: "#fff",
                borderRadius: 6,
                fontWeight: 600,
                textDecoration: "none",
                fontSize: "0.88rem",
                whiteSpace: "nowrap",
              }}
            >
              Yönetici Paneli
            </Link>
          )}
          {canShowInstall && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="desktop-only"
              style={{
                padding: "6px 12px",
                background: "transparent",
                color: "var(--icsp-lacivert)",
                border: "1px solid var(--icsp-lacivert)",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Uygulamayı Yükle
            </button>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="desktop-only"
            style={{
              padding: "6px 12px",
              background: "transparent",
              color: "#666",
              border: "1px solid #ccc",
              borderRadius: 6,
              fontWeight: 500,
              fontSize: "0.88rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Çıkış
          </button>

          {/* Hamburger butonu (sadece mobil) */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="hamburger-btn"
            aria-label="Menüyü aç/kapat"
            style={{
              display: "none",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 5,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              borderRadius: 6,
            }}
          >
            <span
              style={{
                display: "block",
                width: 22,
                height: 2,
                background: menuOpen ? "var(--icsp-lacivert)" : "#424242",
                borderRadius: 2,
                transition: "transform 0.2s, opacity 0.2s",
                transform: menuOpen ? "translateY(7px) rotate(45deg)" : "none",
              }}
            />
            <span
              style={{
                display: "block",
                width: 22,
                height: 2,
                background: "#424242",
                borderRadius: 2,
                opacity: menuOpen ? 0 : 1,
                transition: "opacity 0.2s",
              }}
            />
            <span
              style={{
                display: "block",
                width: 22,
                height: 2,
                background: menuOpen ? "var(--icsp-lacivert)" : "#424242",
                borderRadius: 2,
                transition: "transform 0.2s",
                transform: menuOpen ? "translateY(-7px) rotate(-45deg)" : "none",
              }}
            />
          </button>
        </div>
      </div>

      {/* Mobil açılır menü */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            borderBottom: "1px solid var(--icsp-nav-border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 200,
            padding: "8px 12px 12px",
          }}
          className="mobile-menu"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                ...linkStyle(link.href),
                padding: "12px 8px",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              {link.label}
            </Link>
          ))}
          {canAccessAdmin && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block",
                padding: "12px 8px",
                color: "#fff",
                background: "var(--icsp-lacivert)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.92rem",
                borderRadius: 6,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Yönetici Paneli
            </Link>
          )}
          {canShowInstall && (
            <button
              type="button"
              onClick={async () => {
                await handleInstallClick()
                setMenuOpen(false)
              }}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "12px 8px",
                background: "transparent",
                color: "var(--icsp-lacivert)",
                border: "1px solid var(--icsp-lacivert)",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: "0.92rem",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Uygulamayı Yükle
            </button>
          )}
          <button
            type="button"
            onClick={() => { setMenuOpen(false); logout() }}
            style={{
              width: "100%",
              marginTop: 8,
              padding: "12px 8px",
              background: "transparent",
              color: "#666",
              border: "1px solid #ccc",
              borderRadius: 6,
              fontWeight: 500,
              fontSize: "0.92rem",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            Çıkış
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .desktop-only { display: none !important; }
          .hamburger-btn { display: flex !important; }
        }
        @media (min-width: 641px) {
          .mobile-menu { display: none !important; }
        }
      `}</style>
    </nav>
  )
}
