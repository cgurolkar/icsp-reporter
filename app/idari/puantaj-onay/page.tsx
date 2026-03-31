"use client"

import { useState, useEffect } from "react"
import {
  Box,
  Typography,
  Button,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"

interface SiteItem {
  id: number
  name: string
}

interface TaslakGroup {
  site_id: number
  site_name: string
  tarih: string
  adet: string
}

export default function IdariPuantajOnayPage() {
  const { user } = useAuth()
  const [sites, setSites] = useState<SiteItem[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [baslangic, setBaslangic] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [bitis, setBitis] = useState(() => new Date().toISOString().slice(0, 10))
  const [list, setList] = useState<TaslakGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [approveDialog, setApproveDialog] = useState<{ siteId: number; siteName: string; baslangic: string; bitis: string } | null>(null)
  const [approving, setApproving] = useState(false)

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canApprove = role === "super_admin" || role === "admin" || role === "manager"

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SiteItem[]) => setSites(data))
      .catch(() => setSites([]))
  }, [])

  const loadList = () => {
    if (!canApprove) return
    setLoading(true)
    const params = new URLSearchParams()
    if (siteId) params.set("siteId", siteId)
    if (baslangic) params.set("baslangic", baslangic)
    if (bitis) params.set("bitis", bitis)
    fetch(`/api/idari/puantaj/onay?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TaslakGroup[]) => setList(data))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadList()
  }, [siteId, baslangic, bitis, canApprove])

  const openApprove = (row: TaslakGroup) => {
    setApproveDialog({
      siteId: row.site_id,
      siteName: row.site_name,
      baslangic: String(row.tarih).slice(0, 10),
      bitis: String(row.tarih).slice(0, 10),
    })
  }

  const handleApprove = async () => {
    if (!approveDialog) return
    setApproving(true)
    const res = await fetch("/api/idari/puantaj/onay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: approveDialog.siteId,
        baslangicTarih: approveDialog.baslangic,
        bitisTarih: approveDialog.bitis,
      }),
    })
    setApproving(false)
    if (res.ok) {
      setApproveDialog(null)
      loadList()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "OnaylanamadÄ±.")
    }
  }

  if (!canApprove) {
    return (
      <Box>
        <Typography color="text.secondary">Puantaj onaylama yetkiniz yok. Sadece merkez (admin/manager) onaylayabilir.</Typography>
        <Button component={Link} href="/idari/puantaj" sx={{ mt: 2 }}>Puantaj giriÅŸine dÃ¶n</Button>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Puantaj onay
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Åžantiye</InputLabel>
            <Select value={siteId} label="Åžantiye" onChange={(e) => setSiteId(e.target.value)}>
              <MenuItem value="">TÃ¼mÃ¼</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="BaÅŸlangÄ±Ã§" type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value.slice(0, 10))} size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="BitiÅŸ" type="date" value={bitis} onChange={(e) => setBitis(e.target.value.slice(0, 10))} size="small" InputLabelProps={{ shrink: true }} />
          <Button variant="outlined" onClick={loadList}>Yenile</Button>
        </Box>

        {loading ? (
          <Typography color="text.secondary">YÃ¼kleniyor...</Typography>
        ) : list.length === 0 ? (
          <Typography color="text.secondary">Onay bekleyen (taslak) puantaj yok.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Åžantiye</strong></TableCell>
                <TableCell><strong>Tarih</strong></TableCell>
                <TableCell><strong>KayÄ±t sayÄ±sÄ±</strong></TableCell>
                <TableCell align="right"><strong>Ä°ÅŸlem</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((row, idx) => (
                <TableRow key={`${row.site_id}-${row.tarih}-${idx}`}>
                  <TableCell>{row.site_name}</TableCell>
                  <TableCell>{String(row.tarih).slice(0, 10)}</TableCell>
                  <TableCell>{row.adet}</TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="contained" onClick={() => openApprove(row)} sx={{ background: "var(--icsp-lacivert)" }}>
                      Onayla
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Button component={Link} href="/idari/puantaj">Puantaj giriÅŸine dÃ¶n</Button>

      <Dialog open={!!approveDialog} onClose={() => setApproveDialog(null)}>
        <DialogTitle>Puantaj onayla</DialogTitle>
        <DialogContent>
          {approveDialog && (
            <Typography>
              <strong>{approveDialog.siteName}</strong> â€” {approveDialog.baslangic} tarihli taslak puantaj onaylanacak. Onaydan sonra deÄŸiÅŸtirilemez.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveDialog(null)}>Ä°ptal</Button>
          <Button variant="contained" onClick={handleApprove} disabled={approving} sx={{ background: "var(--icsp-lacivert)" }}>
            {approving ? "OnaylanÄ±yor..." : "Onayla"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

