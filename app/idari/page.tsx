"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Box, Typography, Button, Paper, Alert, Card, CardContent, Skeleton } from "@mui/material"
import { People, Assignment, AttachMoney, Description, BarChart, Warning, Inventory2, TodayOutlined, ErrorOutline, Construction } from "@mui/icons-material"
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

interface DashboardStats {
  personelSayisi: number
  bugunGelen: number
  buAyHarcama: number
  envanterSayisi: number
  uyariSayisi: number
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  loading,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color: string
  loading?: boolean
}) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderLeft: `4px solid ${color}`, flex: "1 1 160px", minWidth: 140 }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Box sx={{ color }}>{icon}</Box>
        </Box>
        {loading ? (
          <Skeleton variant="text" width={60} height={36} />
        ) : (
          <Typography variant="h5" fontWeight={700} sx={{ color: "text.primary" }}>
            {value}
          </Typography>
        )}
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default function IdariDashboardPage() {
  const { user } = useAuth()
  const [uyarilar, setUyarilar] = useState<UyariRow[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const isUserRole = role === "user" || role === "personel"

  useEffect(() => {
    const params = new URLSearchParams()
    if (isUserRole && user?.siteId != null) params.set("siteId", String(user.siteId))
    fetch(`/api/idari/uyarilar?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setUyarilar)
      .catch(() => setUyarilar([]))
  }, [role, user?.siteId])

  useEffect(() => {
    setStatsLoading(true)
    const params = new URLSearchParams()
    if (isUserRole && user?.siteId != null) params.set("siteId", String(user.siteId))
    fetch(`/api/idari/dashboard?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DashboardStats | null) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false))
  }, [role, user?.siteId])

  const isGecikmis = (tarih: string | null) => tarih && new Date(tarih) < new Date()

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Dashboard
      </Typography>

      {/* Özet Kartları */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <StatCard
          title="Aktif Personel"
          value={stats?.personelSayisi ?? "—"}
          icon={<People fontSize="small" />}
          color="#1565c0"
          loading={statsLoading}
        />
        <StatCard
          title="Bugün Gelen"
          value={stats?.bugunGelen ?? "—"}
          subtitle="puantaj kayıtlı"
          icon={<TodayOutlined fontSize="small" />}
          color="#2e7d32"
          loading={statsLoading}
        />
        <StatCard
          title="Bu Ay Harcama"
          value={stats ? `$${stats.buAyHarcama.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}` : "—"}
          icon={<AttachMoney fontSize="small" />}
          color="#e65100"
          loading={statsLoading}
        />
        <StatCard
          title="Envanter Kalem"
          value={stats?.envanterSayisi ?? "—"}
          icon={<Inventory2 fontSize="small" />}
          color="#6a1b9a"
          loading={statsLoading}
        />
        {(stats?.uyariSayisi ?? 0) > 0 && (
          <StatCard
            title="Belge Uyarısı"
            value={stats?.uyariSayisi ?? 0}
            subtitle="sona yakın / geçmiş"
            icon={<ErrorOutline fontSize="small" />}
            color="#c62828"
            loading={statsLoading}
          />
        )}
      </Box>

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
          {!isUserRole && (
            <>
              <Button component={Link} href="/idari/puantaj" variant="outlined" startIcon={<Assignment />}>
                Puantaj
              </Button>
              <Button component={Link} href="/idari/belgeler" variant="outlined" startIcon={<Description />}>
                Belgeler
              </Button>
              <Button component={Link} href="/idari/raporlar" variant="outlined" startIcon={<BarChart />}>
                Raporlar
              </Button>
            </>
          )}
          <Button component={Link} href="/idari/makineler" variant="outlined" startIcon={<Construction />}>
            Makineler
          </Button>
          <Button component={Link} href="/idari/harcamalar" variant="outlined" startIcon={<AttachMoney />}>
            Harcamalar
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
