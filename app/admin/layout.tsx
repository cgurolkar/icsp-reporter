"use client"

import Link from "next/link"
import Image from "next/image"
import { Box, Button, Typography } from "@mui/material"
import { Home } from "@mui/icons-material"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #1a237e 0%, #283593 24px, #2c2f36 120px)",
        pb: 4,
      }}
    >
      <header
        style={{
          background: "rgba(44, 47, 54, 0.98)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "12px 24px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              overflow: "hidden",
            }}
          >
            <Image
              src="/icsp-logo-auger.png"
              alt="ICS Piling"
              width={44}
              height={44}
              style={{ objectFit: "contain", display: "block", backgroundColor: "#ffffff" }}
              unoptimized
            />
          </Box>
        </Box>
        <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center" }}>
          Yönetici Paneli - ICSP Reporter
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1 }}>
          <Button
            component={Link}
            href="/"
            variant="contained"
            startIcon={<Home />}
            sx={{
              background: "#4caf50",
              color: "#fff",
              fontWeight: 600,
              "&:hover": { background: "#43a047" },
            }}
          >
            Ana sayfa
          </Button>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              overflow: "hidden",
            }}
          >
            <Image
              src="/icsp-logo-rt.png"
              alt="Rekäiz Al-Turba"
              width={44}
              height={44}
              style={{ objectFit: "contain", display: "block", backgroundColor: "#ffffff" }}
              unoptimized
            />
          </Box>
        </Box>
      </header>
      <main>{children}</main>
    </Box>
  )
}
