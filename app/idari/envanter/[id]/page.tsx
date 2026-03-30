"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  Chip,
  Skeleton,
  useTheme,
  useMediaQuery,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material"
import { ArrowBack, Inventory2, ArrowDownward, ArrowUpward } from "@mui/icons-material"

interface HareketRow {
  id: number
  hareket_tipi: "gelen" | "giden"
  kaynak_yer?: string | null
  hedef_yer?: string | null
  site_name?: string | null
  tarih: string
  adet: number
  notlar?: string | null
  olusturan?: string | null
}

interface EnvanterDetail {
  id: number
  kod: string
  malzeme_adi: string
  aciklama?: string | null
  adet: number
  durum?: string | null
  fotograf_yolu?: string | null
  fiyat?: number | null
  yer?: string | null
  site_id?: number | null
  site_name?: string | null
  created_at?: string
  updated_at?: string
  hareketler?: HareketRow[]
}

const DURUM_RENK: Record<string, "success"|"default"|"warning"|"error"> = {
  aktif: "success", depoda: "default", yolda: "warning", bakimda: "warning", hurda: "error",
}
const DURUM_LABEL: Record<string, string> = {
  aktif: "Aktif", depoda: "Depoda", yolda: "Yolda", bakimda: "Bakımda", hurda: "Hurda",
}

export default function IdariEnvanterDetailPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const params = useParams()
  const id = typeof params?.id === "string" ? parseInt(params.id, 10) : NaN
  const [item, setItem] = useState<EnvanterDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (Number.isNaN(id)) return
    setLoading(true)
    fetch(`/api/idari/envanter/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: EnvanterDetail | null) => setItem(data))
      .catch(() => setItem(null))
      .finally(() => setLoading(false))
  }, [id])

  if (Number.isNaN(id)) {
    return (
      <Box>
        <Typography color="error">Geçersiz kayıt.</Typography>
        <Button component={Link} href="/idari/envanter" startIcon={<ArrowBack />} sx={{ mt: 2 }}>Listeye dön</Button>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />
        <Paper sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
          <Box sx={{ mt: 2 }}>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </Box>
        </Paper>
      </Box>
    )
  }

  if (!item) {
    return (
      <Box>
        <Typography color="text.secondary">Kayıt bulunamadı.</Typography>
        <Button component={Link} href="/idari/envanter" startIcon={<ArrowBack />} sx={{ mt: 2 }}>Listeye dön</Button>
      </Box>
    )
  }

  const hareketler = item.hareketler ?? []
  const durumKod = item.durum ?? "aktif"

  return (
    <Box>
      <Button component={Link} href="/idari/envanter" startIcon={<ArrowBack />} sx={{ mb: 2 }}>
        Listeye dön
      </Button>

      <Card variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", mb: 2 }}>
        <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "stretch" }}>
          {item.fotograf_yolu ? (
            <Box
              component="img"
              src={item.fotograf_yolu}
              alt={item.malzeme_adi}
              sx={{ width: isMobile ? "100%" : 220, height: isMobile ? 200 : 220, objectFit: "cover", bgcolor: "grey.100" }}
            />
          ) : (
            <Box
              sx={{ width: isMobile ? "100%" : 220, height: isMobile ? 160 : 220, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "grey.100", color: "grey.400" }}
            >
              <Inventory2 sx={{ fontSize: 64 }} />
            </Box>
          )}
          <CardContent sx={{ flex: 1, p: 3 }}>
            <Typography variant="overline" color="text.secondary">{item.kod}</Typography>
            <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mt: 0.5 }}>
              {item.malzeme_adi}
            </Typography>
            {item.aciklama && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{item.aciklama}</Typography>
            )}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
              <Chip label={`Adet: ${item.adet}`} color="primary" variant="outlined" />
              <Chip label={DURUM_LABEL[durumKod] ?? durumKod} color={DURUM_RENK[durumKod] ?? "default"} size="small" />
              {item.yer && <Chip label={item.yer} variant="outlined" />}
              {item.fiyat != null && <Chip label={`${Number(item.fiyat).toLocaleString("tr-TR")} ₺`} variant="outlined" />}
              {item.site_name && <Chip label={item.site_name} size="small" variant="outlined" />}
            </Box>
          </CardContent>
        </Box>
      </Card>

      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Detay</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <Box><Typography variant="caption" color="text.secondary">Kod</Typography><Typography variant="body2">{item.kod}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Durum</Typography><Typography variant="body2">{DURUM_LABEL[durumKod] ?? durumKod}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Yer</Typography><Typography variant="body2">{item.yer ?? "—"}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Adet</Typography><Typography variant="body2">{item.adet}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Fiyat</Typography><Typography variant="body2">{item.fiyat != null ? `${Number(item.fiyat).toLocaleString("tr-TR")} ₺` : "—"}</Typography></Box>
          <Box><Typography variant="caption" color="text.secondary">Şantiye</Typography><Typography variant="body2">{item.site_name ?? "—"}</Typography></Box>
        </Box>
      </Paper>

      {/* Hareket Geçmişi */}
      <Paper sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "var(--icsp-lacivert)", mb: 2 }}>
          Hareket Geçmişi
          <Chip label={hareketler.length} size="small" sx={{ ml: 1 }} />
        </Typography>
        {hareketler.length === 0 ? (
          <Typography color="text.secondary" variant="body2">Henüz hareket kaydı yok.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Tarih</strong></TableCell>
                  <TableCell><strong>Tür</strong></TableCell>
                  <TableCell><strong>Nereden</strong></TableCell>
                  <TableCell><strong>Nereye</strong></TableCell>
                  <TableCell align="right"><strong>Adet</strong></TableCell>
                  <TableCell><strong>Not</strong></TableCell>
                  <TableCell><strong>Giren</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {hareketler.map((h) => (
                  <TableRow
                    key={h.id}
                    sx={{ backgroundColor: h.hareket_tipi === "gelen" ? "#e8f5e9" : "#fff3e0" }}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{String(h.tarih).slice(0, 10)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {h.hareket_tipi === "gelen"
                          ? <ArrowDownward sx={{ color: "success.main", fontSize: 16 }} />
                          : <ArrowUpward sx={{ color: "warning.dark", fontSize: 16 }} />
                        }
                        <Typography variant="body2" sx={{ fontWeight: 500, color: h.hareket_tipi === "gelen" ? "success.dark" : "warning.dark" }}>
                          {h.hareket_tipi === "gelen" ? "Gelen" : "Giden"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{h.kaynak_yer ?? "—"}</TableCell>
                    <TableCell>{h.hedef_yer ?? h.site_name ?? "—"}</TableCell>
                    <TableCell align="right">{h.adet}</TableCell>
                    <TableCell>{h.notlar ?? "—"}</TableCell>
                    <TableCell>{h.olusturan ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
