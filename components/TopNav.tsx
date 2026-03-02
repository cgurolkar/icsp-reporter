"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"

export default function TopNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  return (
    <nav
      style={{
        background: "var(--icsp-nav-bg)",
        borderBottom: "1px solid var(--icsp-nav-border)",
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "4px",
        minHeight: "44px",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap", minWidth: 0 }}>
        <Link
          href="/"
          style={{
            padding: "10px 12px",
            color: pathname === "/" ? "var(--icsp-lacivert)" : "#424242",
            fontWeight: pathname === "/" ? 600 : 500,
            textDecoration: "none",
            fontSize: "clamp(0.8rem, 2.5vw, 0.95rem)",
          }}
        >
          {t("home")}
        </Link>
        <Link
          href="/reports"
          style={{
            padding: "10px 12px",
            color: pathname === "/reports" ? "var(--icsp-lacivert)" : "#424242",
            fontWeight: pathname === "/reports" ? 600 : 500,
            textDecoration: "none",
            fontSize: "clamp(0.8rem, 2.5vw, 0.95rem)",
          }}
        >
          {t("sites")}
        </Link>
        <Link
          href="/form"
          style={{
            padding: "10px 12px",
            color: pathname === "/form" ? "var(--icsp-lacivert)" : "#424242",
            fontWeight: pathname === "/form" ? 600 : 500,
            textDecoration: "none",
            fontSize: "clamp(0.8rem, 2.5vw, 0.95rem)",
          }}
        >
          {t("data_entry")}
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <Link
          href="/admin"
          style={{
            padding: "6px 12px",
            background: "var(--icsp-lacivert)",
            color: "#fff",
            borderRadius: "6px",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "clamp(0.75rem, 2vw, 0.9rem)",
          }}
        >
          Yönetici Girişi
        </Link>
      </div>
    </nav>
  )
}
