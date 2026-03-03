"use client"

import { useState } from "react"

function LogoBox({ src, alt, fallbackText }: { src: string; alt: string; fallbackText: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
        borderRadius: "6px",
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        overflow: "hidden",
        flexShrink: 0,
        width: 48,
        height: 48,
      }}
    >
      {failed ? (
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--icsp-lacivert)" }}>{fallbackText}</span>
      ) : (
        <img
          src={src}
          alt={alt}
          width={48}
          height={48}
          style={{ objectFit: "contain", display: "block" }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

export default function AppHeader() {
  return (
    <header
      style={{
        background: "var(--icsp-banner-bg)",
        borderBottom: "1px solid var(--icsp-nav-border)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <LogoBox src="/icsp-logo-auger.png" alt="ICS Piling" fallbackText="ICSP" />
      <h1
        style={{
          margin: 0,
          fontSize: "clamp(0.95rem, 4vw, 1.5rem)",
          fontWeight: 700,
          color: "var(--icsp-lacivert)",
          letterSpacing: "-0.02em",
          minWidth: 0,
          flex: "1 1 auto",
        }}
      >
        ICSP Reporter
      </h1>
      <LogoBox src="/icsp-logo-rt.png" alt="Rekäiz Al-Turba" fallbackText="RT" />
    </header>
  )
}
