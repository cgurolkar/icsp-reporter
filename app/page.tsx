"use client"

import { useState, useEffect } from "react"
import { Container, Paper, Typography, Box, Button, Grid } from "@mui/material"
import Link from "next/link"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { LanguageProvider, useLanguage } from "@/contexts/language-context"
import LanguageSelector from "@/components/language-selector"

interface SiteItem {
  id: number
  name: string
  code: string
  report_count?: number
}

function HomePage() {
  const [sites, setSites] = useState<SiteItem[]>([])
  const { t } = useLanguage()

  useEffect(() => {
    fetch("/api/sites?withReportCount=1")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: SiteItem[]) => setSites(list))
      .catch(() => setSites([]))
  }, [])

  return (
    <Container
      maxWidth="md"
      sx={{
        py: { xs: 2, sm: 4 },
        minHeight: "100vh",
        background: "#fafafa",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", mb: 2 }}>
        <LanguageSelector />
      </Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 3 }}>
        {t("daily_work_report")}
      </Typography>

      {sites.length > 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            background: "#ffffff",
            border: "1px solid var(--icsp-nav-border)",
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle1" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
            Şantiyeler
          </Typography>
          <Grid container spacing={2}>
            {sites.map((site) => (
              <Grid item xs={12} sm={6} key={site.id}>
                <Box
                  sx={{
                    p: 2,
                    border: "1px solid var(--icsp-nav-border)",
                    borderRadius: 2,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  <Typography fontWeight={600} sx={{ color: "var(--icsp-lacivert)" }}>
                    {site.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {site.code}
                    {site.report_count != null && (
                      <> · <strong>{site.report_count}</strong> rapor</>
                    )}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                    <Link href={`/reports?siteId=${site.id}`} style={{ textDecoration: "none" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        fullWidth
                        sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}
                      >
                        Raporları gör
                      </Button>
                    </Link>
                    <Link href={`/form?siteId=${site.id}`} style={{ textDecoration: "none" }}>
                      <Button
                        size="small"
                        variant="contained"
                        fullWidth
                        sx={{ backgroundColor: "var(--icsp-lacivert)" }}
                      >
                        Bilgi girişi
                      </Button>
                    </Link>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: 3, background: "#ffffff", border: "1px solid var(--icsp-nav-border)", borderRadius: 2 }}>
          <Typography color="text.secondary">
            Henüz şantiye tanımlı değil. Admin panelinden şantiye ekleyebilirsiniz.
          </Typography>
          <Link href="/form" style={{ textDecoration: "none", display: "inline-block", marginTop: 16 }}>
            <Button variant="contained" sx={{ backgroundColor: "var(--icsp-lacivert)" }}>
              Bilgi girişi sayfasına git
            </Button>
          </Link>
        </Paper>
      )}
    </Container>
  )
}

export default function Page() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider>
        <HomePage />
      </LanguageProvider>
    </ThemeProvider>
  )
}
