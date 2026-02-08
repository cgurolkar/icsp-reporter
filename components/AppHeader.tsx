"use client"

import Image from "next/image"

export default function AppHeader() {
  return (
    <header
      style={{
        background: "var(--icsp-banner-bg)",
        borderBottom: "1px solid var(--icsp-nav-border)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px",
          borderRadius: "8px",
          backgroundColor: "#ffffff",
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <Image
          src="/icsp-logo-auger.png"
          alt="ICS Piling"
          width={56}
          height={56}
          style={{ objectFit: "contain", display: "block", backgroundColor: "#ffffff" }}
          unoptimized
        />
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)",
          fontWeight: 700,
          color: "var(--icsp-lacivert)",
          letterSpacing: "-0.02em",
        }}
      >
        ICSP Reporter
      </h1>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px",
          borderRadius: "8px",
          backgroundColor: "#ffffff",
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <Image
          src="/icsp-logo-rt.png"
          alt="Rekäiz Al-Turba"
          width={56}
          height={56}
          style={{ objectFit: "contain", display: "block", backgroundColor: "#ffffff" }}
          unoptimized
        />
      </div>
    </header>
  )
}
