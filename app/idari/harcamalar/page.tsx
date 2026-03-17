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
import { Add } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

interface SiteItem {
  id: number
  name: string
}

interface KategoriItem {
  id: number
  kod: string
  ad: string
}

interface IslemRow {
  id: number
  site_id: number
  kategori_id: number
  kategori_adi: string
  tutar: number
  islem_tarihi: string
  odeme_kaynagi: string
  aciklama?: string | null
  evrak_yolu?: string | null
}

export default function IdariHarcamalarPage() {
  const { user } = useAuth()
  const [sites, setSites] = useState<SiteItem[]>([])
  const [kategoriler, setKategoriler] = useState<KategoriItem[]>([])
  const [list, setList] = useState<IslemRow[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [baslangic, setBaslangic] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [bitis, setBitis] = useState(() => new Date().toISOString().slice(0, 10))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    siteId: "",
    kategoriId: "",
    tutar: "",
    islem_tarihi: new Date().toISOString().slice(0, 10),
    odeme_kaynagi: "Santiye_Kasa",
    aciklama: "",
  })
  const [saving, setSaving] = useState(false)

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "admin" || role === "manager"

  useEffect(() => {
    fetch("/api/sites").then((r) => (r.ok ? r.json() : [])).then(setSites).catch(() => setSites([]))
    fetch("/api/idari/harcama-kategorileri").then((r) => (r.ok ? r.json() : [])).then(setKategoriler).catch(() => setKategoriler([]))
  }, [])

  const loadList = () => {
    if (!siteId) return
    const params = new URLSearchParams({ siteId })
    if (baslangic) params.set("baslangic", baslangic)
    if (bitis) params.set("bitis", bitis)
    fetch(`/api/idari/islemler?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setList)
      .catch(() => setList([]))
  }

  useEffect(() => {
    loadList()
  }, [siteId, baslangic, bitis])

  const handleSave = async () => {
    const sid = parseInt(form.siteId, 10)
    const kid = parseInt(form.kategoriId, 10)
    const tutar = parseFloat(form.tutar)
    if (!sid || !kid || Number.isNaN(tutar) || !form.islem_tarihi) {
      alert("Şantiye, kategori, tutar ve tarih gerekli.")
      return
    }
    setSaving(true)
    const res = await fetch("/api/idari/islemler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: sid,
        kategoriId: kid,
        tutar,
        islem_tarihi: form.islem_tarihi.slice(0, 10),
        odeme_kaynagi: form.odeme_kaynagi,
        aciklama: form.aciklama || undefined,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setDialogOpen(false)
      setForm({ siteId: "", kategoriId: "", tutar: "", islem_tarihi: new Date().toISOString().slice(0, 10), odeme_kaynagi: "Santiye_Kasa", aciklama: "" })
      loadList()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Kaydedilemedi.")
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Harcamalar
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
          {canManage && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} sx={{ background: "var(--icsp-lacivert)" }}>
              Yeni harcama
            </Button>
          )}
        </Box>

        {!siteId ? (
          <Typography color="text.secondary">Şantiye seçin.</Typography>
        ) : list.length === 0 ? (
          <Typography color="text.secondary">Kayıt yok.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Tarih</strong></TableCell>
                <TableCell><strong>Kategori</strong></TableCell>
                <TableCell align="right"><strong>Tutar</strong></TableCell>
                <TableCell><strong>Ödeme</strong></TableCell>
                <TableCell><strong>Açıklama</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{String(row.islem_tarihi).slice(0, 10)}</TableCell>
                  <TableCell>{row.kategori_adi}</TableCell>
                  <TableCell align="right">{Number(row.tutar).toLocaleString("tr-TR")}</TableCell>
                  <TableCell>{row.odeme_kaynagi === "Merkez_Banka" ? "Merkez" : "Şantiye Kasası"}</TableCell>
                  <TableCell>{row.aciklama ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Yeni harcama</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Şantiye</InputLabel>
              <Select value={form.siteId} label="Şantiye" onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Kategori</InputLabel>
              <Select value={form.kategoriId} label="Kategori" onChange={(e) => setForm((f) => ({ ...f, kategoriId: e.target.value }))}>
                {kategoriler.map((k) => (
                  <MenuItem key={k.id} value={String(k.id)}>{k.ad}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Tutar" type="number" value={form.tutar} onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))} required fullWidth inputProps={{ step: 0.01 }} />
            <TextField label="Tarih" type="date" value={form.islem_tarihi} onChange={(e) => setForm((f) => ({ ...f, islem_tarihi: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            <FormControl fullWidth>
              <InputLabel>Ödeme kaynağı</InputLabel>
              <Select value={form.odeme_kaynagi} label="Ödeme kaynağı" onChange={(e) => setForm((f) => ({ ...f, odeme_kaynagi: e.target.value }))}>
                <MenuItem value="Santiye_Kasa">Şantiye Kasası</MenuItem>
                <MenuItem value="Merkez_Banka">Merkez Banka</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Açıklama" multiline value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>İptal</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.siteId || !form.kategoriId || !form.tutar} sx={{ background: "var(--icsp-lacivert)" }}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
