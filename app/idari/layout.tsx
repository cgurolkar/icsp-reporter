"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Box, Typography, Button, Paper } from "@mui/material"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { useAuth } from "@/contexts/auth-context"
import { Home, People, Assignment, AttachMoney, Description, BarChart, Inventory2 } from "@mui/icons-material"

const navItems = [
  { href: "/idari", label: "Dashboard", icon: BarChart },
  { href: "/idari/personel", label: "Personel", icon: People },
  { href: "/idari/envanter", label: "Envanter", icon: Inventory2 },
  { href: "/idari/puantaj", label: "Puantaj", icon: Assignment },
  { href: "/idari/puantaj-onay", label: "Puantaj onay", icon: Assignment },
  { href: "/idari/harcamalar", label: "Harcamalar", icon: AttachMoney },
  { href: "/idari/belgeler", label: "Belgeler", icon: Description },
  { href: "/idari/raporlar", label: "Raporlar", icon: BarChart },
]

export default function IdariLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canAccessIdari = ["admin", "manager", "user", "personel"].includes(role)

  useEffect(() => {
    if (user && !canAccessIdari) router.replace("/proje")
  }, [user, canAccessIdari, router])

  if (user && !canAccessIdari) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography>Yetkiniz yok.</Typography>
          <Button component={Link} href="/proje" sx={{ mt: 2 }}>Ana sayfaya dön</Button>
        </Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", background: "#f5f5f5", pb: 4 }}>
        <Paper
          elevation={0}
          sx={{
            borderBottom: "1px solid #e0e0e0",
            p: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
            background: "#fff",
          }}
        >
          <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 700 }}>
            İdari Yönetim
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {navItems.filter((item) => item.href !== "/idari/puantaj-onay" || role === "admin" || role === "manager").map(({ href, label, icon: Icon }) => (
              <Button
                key={href}
                component={Link}
                href={href}
                size="small"
                startIcon={<Icon />}
                sx={{
                  color: pathname === href ? "var(--icsp-lacivert)" : "#666",
                  fontWeight: pathname === href ? 600 : 500,
                }}
              >
                {label}
              </Button>
            ))}
            <Button component={Link} href="/proje" size="small" startIcon={<Home />} sx={{ color: "#666" }}>
              Ana menü
            </Button>
          </Box>
        </Paper>
        <Box sx={{ px: 2, py: 2, maxWidth: 1200, margin: "0 auto" }}>{children}</Box>
      </Box>
    </ThemeProvider>
  )
}
