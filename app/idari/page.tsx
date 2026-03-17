"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Box, Typography, Button, Paper, Alert } from "@mui/material"
import { People, Assignment, AttachMoney, Description, BarChart, Warning, Inventory2 } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

interface UyariRow {
  id: number
  personel_id: number
  belge_tipi: string
  gecerlilik_tarihi: string | null
  ad: string
  soyad: string
  gorev: string
}

export default function IdariDashboardPage() {
  const { user } = useAuth()
  const [uyarilar, setUyarilar] = useState<UyariRow[]>([])
  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""

  useEffect(() => {
    const params = new URLSearchParams()
    if (role === "user" || role === "personel") {
      if (user?.siteId != null) params.set("siteId", String(user.siteId))
    }
    fetch(`/api/idari/uyarilar?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setUyarilar)
      .catch(() => setUyarilar([]))
  }, [role, user?.siteId])

  const isGecikmis = (tarih: string | null) => tarih && new Date(tarih) < new Date()

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Dashboard
      </Typography>

      {uyarilar.length > 0 && (
        <Paper sx={{ p: 2, mb: 2, borderLeft: "4px solid", borderColor: "warning.main" }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Warning color="warning" /> Süresi dolan / yaklaşan belgeler
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {uyarilar.slice(0, 10).map((u) => (
              <li key={u.id}>
                <Typography variant="body2">
                  {u.ad} {u.soyad} — {u.belge_tipi}
                  {u.gecerlilik_tarihi && (
                    <Typography component="span" variant="body2" color={isGecikmis(u.gecerlilik_tarihi) ? "error" : "text.secondary"} sx={{ ml: 1 }}>
                      ({String(u.gecerlilik_tarihi).slice(0, 10)})
                    </Typography>
                  )}
                </Typography>
              </li>
            ))}
          </Box>
          {uyarilar.length > 10 && <Typography variant="body2" color="text.secondary">+{uyarilar.length - 10} daha</Typography>}
          <Button component={Link} href="/idari/belgeler" size="small" sx={{ mt: 1 }}>Belgelere git</Button>
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          İdari modüle hoş geldiniz. Personel, puantaj, finans ve belgeleri menüden yönetebilirsiniz.
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Button component={Link} href="/idari/personel" variant="contained" startIcon={<People />} sx={{ background: "var(--icsp-lacivert)" }}>
            Personel
          </Button>
          <Button component={Link} href="/idari/envanter" variant="outlined" startIcon={<Inventory2 />}>
            Envanter
          </Button>
          <Button component={Link} href="/idari/puantaj" variant="outlined" startIcon={<Assignment />}>
            Puantaj
          </Button>
          <Button component={Link} href="/idari/harcamalar" variant="outlined" startIcon={<AttachMoney />}>
            Harcamalar
          </Button>
          <Button component={Link} href="/idari/belgeler" variant="outlined" startIcon={<Description />}>
            Belgeler
          </Button>
          <Button component={Link} href="/idari/raporlar" variant="outlined" startIcon={<BarChart />}>
            Raporlar
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
