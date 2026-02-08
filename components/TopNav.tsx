"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function TopNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        background: "var(--icsp-nav-bg)",
        borderBottom: "1px solid var(--icsp-nav-border)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "8px",
        minHeight: "48px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <Link
          href="/"
          style={{
            padding: "12px 16px",
            color: pathname === "/" ? "var(--icsp-lacivert)" : "#424242",
            fontWeight: pathname === "/" ? 600 : 500,
            textDecoration: "none",
            fontSize: "0.95rem",
          }}
        >
          Anasayfa
        </Link>
        <Link
          href="/reports"
          style={{
            padding: "12px 16px",
            color: pathname === "/reports" ? "var(--icsp-lacivert)" : "#424242",
            fontWeight: pathname === "/reports" ? 600 : 500,
            textDecoration: "none",
            fontSize: "0.95rem",
          }}
        >
          Şantiyeler
        </Link>
        <Link
          href="/form"
          style={{
            padding: "12px 16px",
            color: pathname === "/form" ? "var(--icsp-lacivert)" : "#424242",
            fontWeight: pathname === "/form" ? 600 : 500,
            textDecoration: "none",
            fontSize: "0.95rem",
          }}
        >
          Bilgi girişi
        </Link>
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link
          href="/admin"
          style={{
            padding: "8px 16px",
            background: "var(--icsp-lacivert)",
            color: "#fff",
            borderRadius: "6px",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: "0.9rem",
          }}
        >
          Yönetici Girişi
        </Link>
      </div>
    </nav>
  )
}
