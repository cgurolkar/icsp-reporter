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
        background: "#f5f5f5",
        pb: 4,
      }}
    >
      <Box
        component="header"
        sx={{
          background: "#fff",
          borderBottom: "1px solid #e0e0e0",
          px: { xs: 2, sm: 3 },
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
              flexShrink: 0,
            }}
          >
            <Image
              src="/icsp-logo-auger.png"
              alt="ICS Piling"
              width={40}
              height={40}
              style={{ objectFit: "contain", display: "block", backgroundColor: "#ffffff" }}
              unoptimized
            />
          </Box>
          <Typography variant="subtitle1" sx={{ color: "#1a237e", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Yönetici Paneli
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/proje"
          variant="contained"
          size="small"
          startIcon={<Home />}
          sx={{
            background: "#4caf50",
            color: "#fff",
            fontWeight: 600,
            "&:hover": { background: "#43a047" },
            flexShrink: 0,
          }}
        >
          Ana sayfa
        </Button>
      </Box>
      <main>{children}</main>
    </Box>
  )
}
