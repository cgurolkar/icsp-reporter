"use client"

import Link from "next/link"
import { useState } from "react"
import { Box, Container, Typography, Paper, Button } from "@mui/material"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { Construction } from "@mui/icons-material"

function LogoBox({ src, alt, fallbackText }: { src: string; alt: string; fallbackText: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <Box
      sx={{
        width: 80,
        height: 80,
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
          width={80}
          height={80}
          style={{ display: "block", objectFit: "contain" }}
          onError={() => setFailed(true)}
        />
      )}
    </Box>
  )
}

export default function IdariPage() {
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
          <Paper
            elevation={4}
            sx={{
              p: 4,
              borderRadius: 3,
              background: "#fff",
              textAlign: "center",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                mb: 3,
                flexWrap: "wrap",
              }}
            >
              <LogoBox src="/icsp-logo-auger.png" alt="ICSP" fallbackText="ICSP" />
              <LogoBox src="/icsp-logo-rt.png" alt="Rekäiz Al-Turba" fallbackText="RT" />
            </Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: "var(--icsp-lacivert)", mb: 1 }}>
              İdari Yönetim
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Personel & Finans
            </Typography>
            <Construction sx={{ fontSize: 48, color: "var(--icsp-lacivert)", opacity: 0.7, mb: 2 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              Hazırlık aşamasında
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Bu modül şu an geliştirme aşamasındadır. Kısa süre içinde hizmete açılacaktır.
            </Typography>
            <Link href="/" style={{ textDecoration: "none" }}>
              <Button variant="contained" sx={{ backgroundColor: "var(--icsp-lacivert)", "&:hover": { backgroundColor: "var(--icsp-lacivert-dark)" } }}>
                Ana menüye dön
              </Button>
            </Link>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  )
}
