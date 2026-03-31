"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Container, Paper, Typography, Box, Button, Table, TableHead, TableBody, TableRow, TableCell } from "@mui/material"
import Link from "next/link"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { LanguageProvider, useLanguage } from "@/contexts/language-context"
import LanguageSelector from "@/components/language-selector"
import { useAuth } from "@/contexts/auth-context"

interface SiteItem {
  id: number
  name: string
  code: string
  report_count?: number
  total_piles?: number | null
  authorized_person?: string | null
  employer?: string | null
  region?: string | null
  city?: string | null
}

function ProjeHomePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [sites, setSites] = useState<SiteItem[]>([])
  const { t } = useLanguage()
  const role = String(user?.role ?? "").toLowerCase()
  const canViewReports = role === "super_admin" || role === "admin" || role === "manager"
  const canDoDataEntry = role === "super_admin" || role === "admin" || role === "user" || role === "personel"

  useEffect(() => {
    if ((user?.role ?? "").toLowerCase() === "operator") {
      router.replace("/operator-form")
      return
    }
    fetch("/api/sites?withReportCount=1")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: SiteItem[]) => setSites(list))
      .catch(() => setSites([]))
  }, [user?.role, router])

  return (
    <Container
      maxWidth="md"
      sx={{
        py: { xs: 2, sm: 4 },
        px: { xs: 1.5, sm: 2 },
        minHeight: "100vh",
        background: "#fafafa",
        maxWidth: "100%",
        overflow: "hidden",
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
          <Box sx={{ overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
            <Table size="small" sx={{ minWidth: 560, "& th, & td": { borderColor: "var(--icsp-nav-border)" } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Şantiye Adı</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">Kazık Sayısı</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">İşlem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell>
                      <Typography fontWeight={600} sx={{ color: "var(--icsp-lacivert)" }}>{site.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{site.code}</Typography>
                      {site.report_count != null && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {site.report_count} rapor
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{site.total_piles != null ? site.total_piles : "—"}</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                      {canViewReports && (
                        <Link href={`/reports?siteId=${site.id}`} style={{ textDecoration: "none" }}>
                          <Button size="small" variant="outlined" sx={{ mr: 0.5, borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}>
                            Raporlar
                          </Button>
                        </Link>
                      )}
                      {canDoDataEntry && (
                        <Link href={`/form?siteId=${site.id}`} style={{ textDecoration: "none" }}>
                          <Button size="small" variant="contained" sx={{ backgroundColor: "var(--icsp-lacivert)" }}>
                            Bilgi girişi
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ p: 3, background: "#ffffff", border: "1px solid var(--icsp-nav-border)", borderRadius: 2 }}>
          <Typography color="text.secondary">
            Henüz şantiye tanımlı değil. Admin panelinden şantiye ekleyebilirsiniz.
          </Typography>
          {canDoDataEntry && (
            <Link href="/form" style={{ textDecoration: "none", display: "inline-block", marginTop: 16 }}>
              <Button variant="contained" sx={{ backgroundColor: "var(--icsp-lacivert)" }}>
                Bilgi girişi sayfasına git
              </Button>
            </Link>
          )}
        </Paper>
      )}
    </Container>
  )
}

export default function ProjePage() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider>
        <ProjeHomePage />
      </LanguageProvider>
    </ThemeProvider>
  )
}
