"use client"

import Link from "next/link"
import { useState } from "react"
import { Box, Container, Typography, Paper } from "@mui/material"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"

function LogoBox({ src, alt, fallbackText }: { src: string; alt: string; fallbackText: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <Box
      sx={{
        width: 72,
        height: 72,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
      }}
    >
      {failed ? (
        <Typography variant="body2" fontWeight={700} sx={{ color: "#1a237e" }}>
          {fallbackText}
        </Typography>
      ) : (
        <img
          src={src}
          alt={alt}
          width={72}
          height={72}
          style={{ display: "block", objectFit: "contain" }}
          onError={() => setFailed(true)}
        />
      )}
    </Box>
  )
}

export default function AnaGirisPage() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a237e 0%, #534bae 100%)",
          p: 2,
        }}
      >
        <Container maxWidth="sm">
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                mb: 2,
                flexWrap: "wrap",
              }}
            >
              <LogoBox src="/icsp-logo-auger.png" alt="ICSP" fallbackText="ICSP" />
              <LogoBox src="/icsp-logo-rt.png" alt="Rekäiz Al-Turba" fallbackText="RT" />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: "#fff", mb: 0.5 }}>
              ICSP Reporter
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
              Personel & Finans – Yönetim Paneli
            </Typography>
          </Box>

          <Paper
            elevation={4}
            sx={{
              p: 3,
              borderRadius: 3,
              background: "#fff",
              "& a": { textDecoration: "none" },
            }}
          >
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2, textAlign: "center" }}>
              Modül seçin
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Link
                href="/idari"
                style={{ display: "block" }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    border: "2px solid var(--icsp-lacivert)",
                    borderRadius: 2,
                    cursor: "pointer",
                    transition: "background 0.2s",
                    "&:hover": { background: "rgba(26, 35, 126, 0.06)" },
                  }}
                >
                  <Typography variant="h6" fontWeight={600} sx={{ color: "var(--icsp-lacivert)" }}>
                    İdari Yönetim
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Personel, finans ve idari işlemler
                  </Typography>
                </Paper>
              </Link>
              <Link
                href="/login"
                style={{ display: "block" }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    border: "2px solid var(--icsp-lacivert)",
                    borderRadius: 2,
                    cursor: "pointer",
                    transition: "background 0.2s",
                    "&:hover": { background: "rgba(26, 35, 126, 0.06)" },
                  }}
                >
                  <Typography variant="h6" fontWeight={600} sx={{ color: "var(--icsp-lacivert)" }}>
                    Proje Yönetimi
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Günlük çalışma raporu, şantiyeler ve raporlar
                  </Typography>
                </Paper>
              </Link>
            </Box>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  )
}
