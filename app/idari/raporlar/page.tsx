"use client"

import { useState, useEffect } from "react"
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
} from "@mui/material"
import { useAuth } from "@/contexts/auth-context"

interface SiteItem {
  id: number
  name: string
}

interface ButceRaporu {
  site_id: number
  site_name: string
  budget: number | null
  toplam: number
  fark: number | null
}

interface IsGucuRow {
  tarih: string
  kisi_sayi: string
  adam_gun: string
  toplam_mesai: string
}

export default function IdariRaporlarPage() {
  const { user } = useAuth()
  const [sites, setSites] = useState<SiteItem[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [baslangic, setBaslangic] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [bitis, setBitis] = useState(() => new Date().toISOString().slice(0, 10))
  const [butce, setButce] = useState<ButceRaporu | null>(null)
  const [isGucu, setIsGucu] = useState<IsGucuRow[]>([])
  const [activeTab, setActiveTab] = useState<"butce" | "isgucu">("butce")

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  useEffect(() => {
    fetch("/api/sites").then((r) => (r.ok ? r.json() : [])).then(setSites).catch(() => setSites([]))
  }, [])

  useEffect(() => {
    if (!siteId) {
      setButce(null)
      setIsGucu([])
      return
    }
    const sid = parseInt(siteId, 10)
    if (activeTab === "butce") {
      const params = new URLSearchParams({ siteId: siteId })
      if (baslangic) params.set("baslangic", baslangic)
      if (bitis) params.set("bitis", bitis)
      fetch(`/api/idari/raporlar/butce?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then(setButce)
        .catch(() => setButce(null))
    } else {
      if (!baslangic || !bitis) return
      fetch(`/api/idari/raporlar/is-gucu?siteId=${sid}&baslangic=${baslangic}&bitis=${bitis}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setIsGucu)
        .catch(() => setIsGucu([]))
    }
  }, [siteId, baslangic, bitis, activeTab])

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Raporlar
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Şantiye</InputLabel>
            <Select value={siteId} label="Şantiye" onChange={(e) => setSiteId(e.target.value)}>
              <MenuItem value="">Seçin</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Başlangıç" type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value.slice(0, 10))} size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="Bitiş" type="date" value={bitis} onChange={(e) => setBitis(e.target.value.slice(0, 10))} size="small" InputLabelProps={{ shrink: true }} />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant={activeTab === "butce" ? "contained" : "outlined"} size="small" onClick={() => setActiveTab("butce")} sx={activeTab === "butce" ? { background: "var(--icsp-lacivert)" } : {}}>Bütçe</Button>
            <Button variant={activeTab === "isgucu" ? "contained" : "outlined"} size="small" onClick={() => setActiveTab("isgucu")} sx={activeTab === "isgucu" ? { background: "var(--icsp-lacivert)" } : {}}>İş gücü</Button>
          </Box>
        </Box>

        {!siteId ? (
          <Typography color="text.secondary">Şantiye seçin.</Typography>
        ) : activeTab === "butce" ? (
          butce && (
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>Bütçe takibi: {butce.site_name}</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 2, mt: 2 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Hedef bütçe</Typography>
                  <Typography variant="h6">{butce.budget != null ? Number(butce.budget).toLocaleString("tr-TR") : "—"}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Gerçekleşen</Typography>
                  <Typography variant="h6">{Number(butce.toplam).toLocaleString("tr-TR")}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">Kalan</Typography>
                  <Typography variant="h6">{butce.fark != null ? Number(butce.fark).toLocaleString("tr-TR") : "—"}</Typography>
                </Paper>
              </Box>
            </Box>
          )
        ) : (
          <>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>İş gücü (onaylı puantaj)</Typography>
            {isGucu.length === 0 ? (
              <Typography color="text.secondary">Kayıt yok.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Tarih</strong></TableCell>
                    <TableCell align="right"><strong>Kişi sayısı</strong></TableCell>
                    <TableCell align="right"><strong>Adam/gün</strong></TableCell>
                    <TableCell align="right"><strong>Mesai (saat)</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isGucu.map((row) => (
                    <TableRow key={row.tarih}>
                      <TableCell>{String(row.tarih).slice(0, 10)}</TableCell>
                      <TableCell align="right">{row.kisi_sayi}</TableCell>
                      <TableCell align="right">{Number(row.adam_gun).toLocaleString("tr-TR")}</TableCell>
                      <TableCell align="right">{Number(row.toplam_mesai).toLocaleString("tr-TR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </Paper>
    </Box>
  )
}
