"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"

export default function TopNav() {
  const pathname = usePathname()
  const { t } = useLanguage()
  const { user, logout } = useAuth()
  const role = (user?.role != null ? String(user.role).toLowerCase() : null) || "user"
  const canViewReports = role === "admin" || role === "manager"
  const canDoDataEntry = role === "admin" || role === "user" || role === "personel"
  const canDoMachineEntry = role === "operator"
  const canAccessAdmin = role === "admin"

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
        {!canDoMachineEntry && (
          <Link
            href="/proje"
            style={{
              padding: "10px 12px",
              color: pathname === "/proje" ? "var(--icsp-lacivert)" : "#424242",
              fontWeight: pathname === "/proje" ? 600 : 500,
              textDecoration: "none",
              fontSize: "clamp(0.8rem, 2.5vw, 0.95rem)",
            }}
          >
            {t("home")}
          </Link>
        )}
        {canDoMachineEntry && (
          <Link
            href="/operator-form"
            style={{
              padding: "10px 12px",
              color: pathname === "/operator-form" ? "var(--icsp-lacivert)" : "#424242",
              fontWeight: pathname === "/operator-form" ? 600 : 500,
              textDecoration: "none",
              fontSize: "clamp(0.8rem, 2.5vw, 0.95rem)",
            }}
          >
            {t("operator_entry")}
          </Link>
        )}
        {canViewReports && (
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
        )}
        {canDoDataEntry && (
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
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, minWidth: 0 }}>
        {canAccessAdmin && (
          <Link
            href="/admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 14px",
              background: "#1a237e",
              color: "#fff",
              borderRadius: "6px",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: "0.9rem",
              whiteSpace: "nowrap",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            Yönetici Paneli
          </Link>
        )}
        <button
          type="button"
          onClick={() => logout()}
          style={{
            padding: "6px 12px",
            background: "transparent",
            color: "#666",
            border: "1px solid #ccc",
            borderRadius: "6px",
            fontWeight: 500,
            fontSize: "clamp(0.75rem, 2vw, 0.9rem)",
            cursor: "pointer",
          }}
        >
          Çıkış
        </button>
      </div>
    </nav>
  )
}
