"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  CardActionArea,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  InputAdornment,
  Chip,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { Add, Edit, Search, Visibility, Inventory2 } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

interface SiteItem {
  id: number
  name: string
  code: string
}

interface EnvanterRow {
  id: number
  kod: string
  malzeme_adi: string
  aciklama?: string | null
  adet: number
  fotograf_yolu?: string | null
  fiyat?: number | null
  yer?: string | null
  site_id?: number | null
  site_name?: string | null
}

export default function IdariEnvanterPage() {
  const { user } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const [list, setList] = useState<EnvanterRow[]>([])
  const [sites, setSites] = useState<SiteItem[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [yerFilter, setYerFilter] = useState<string>("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    kod: "",
    malzeme_adi: "",
    aciklama: "",
    adet: "1",
    fiyat: "",
    yer: "",
    site_id: "",
  })

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "admin" || role === "manager"

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SiteItem[]) => setSites(data))
      .catch(() => setSites([]))
  }, [])

  const loadList = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (siteId) params.set("siteId", siteId)
    if (yerFilter) params.set("yer", yerFilter)
    fetch(`/api/idari/envanter?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: EnvanterRow[]) => setList(data))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadList()
  }, [siteId, yerFilter])

  const yerler = Array.from(new Set(list.map((e) => e.yer).filter(Boolean))) as string[]

  const filteredList = search.trim()
    ? list.filter(
        (e) =>
          e.kod.toLowerCase().includes(search.toLowerCase()) ||
          e.malzeme_adi.toLowerCase().includes(search.toLowerCase()) ||
          (e.yer && e.yer.toLowerCase().includes(search.toLowerCase()))
      )
    : list

  const openAdd = () => {
    setEditingId(null)
    setForm({ kod: "", malzeme_adi: "", aciklama: "", adet: "1", fiyat: "", yer: "", site_id: "" })
    setDialogOpen(true)
  }

  const openEdit = (row: EnvanterRow) => {
    setEditingId(row.id)
    setForm({
      kod: row.kod,
      malzeme_adi: row.malzeme_adi,
      aciklama: row.aciklama ?? "",
      adet: String(row.adet ?? 1),
      fiyat: row.fiyat != null ? String(row.fiyat) : "",
      yer: row.yer ?? "",
      site_id: row.site_id ? String(row.site_id) : "",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.kod.trim() || !form.malzeme_adi.trim()) return
    const payload = {
      kod: form.kod.trim(),
      malzeme_adi: form.malzeme_adi.trim(),
      aciklama: form.aciklama || null,
      adet: parseInt(form.adet, 10) || 1,
      fiyat: form.fiyat ? parseFloat(form.fiyat) : null,
      yer: form.yer || null,
      site_id: form.site_id ? parseInt(form.site_id, 10) : null,
    }
    if (editingId != null) {
      const res = await fetch(`/api/idari/envanter/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setDialogOpen(false)
        loadList()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Güncellenemedi.")
      }
    } else {
      const res = await fetch("/api/idari/envanter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setDialogOpen(false)
        loadList()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Eklenemedi.")
      }
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Envanter
      </Typography>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <TextField
            size="small"
            placeholder="Kod, malzeme adı veya yer ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: isMobile ? "100%" : 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: isMobile ? "100%" : 180 }}>
            <InputLabel>Şantiye</InputLabel>
            <Select value={siteId} label="Şantiye" onChange={(e) => setSiteId(e.target.value)}>
              <MenuItem value="">Tümü</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: isMobile ? "100%" : 160 }}>
            <InputLabel>Yer</InputLabel>
            <Select value={yerFilter} label="Yer" onChange={(e) => setYerFilter(e.target.value)}>
              <MenuItem value="">Tümü</MenuItem>
              {yerler.map((y) => (
                <MenuItem key={y} value={y}>{y}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {canManage && (
            <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ background: "var(--icsp-lacivert)", ml: { xs: 0, sm: "auto" } }}>
              Yeni kayıt
            </Button>
          )}
        </Box>

        {loading ? (
          <Typography color="text.secondary">Yükleniyor...</Typography>
        ) : filteredList.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
            Kayıt bulunamadı.
          </Typography>
        ) : isMobile ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {filteredList.map((row) => (
              <Card key={row.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardActionArea component={Link} href={`/idari/envanter/${row.id}`}>
                  <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: "var(--icsp-lacivert)" }}>
                      {row.kod}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {row.malzeme_adi}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                      <Chip size="small" label={`Adet: ${row.adet}`} />
                      {row.yer && <Chip size="small" label={row.yer} variant="outlined" />}
                      {row.fiyat != null && <Chip size="small" label={`${row.fiyat} ₺`} />}
                    </Box>
                  </CardContent>
                </CardActionArea>
                {canManage && (
                  <Box sx={{ px: 2, pb: 1 }}>
                    <IconButton size="small" onClick={() => openEdit(row)} title="Düzenle">
                      <Edit fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Card>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2 }}>
            {filteredList.map((row) => (
              <Card key={row.id} variant="outlined" sx={{ borderRadius: 2, display: "flex", flexDirection: "column" }}>
                <CardActionArea component={Link} href={`/idari/envanter/${row.id}`} sx={{ flex: 1, display: "block" }}>
                  <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: "var(--icsp-lacivert)" }}>
                      {row.kod}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {row.malzeme_adi}
                    </Typography>
                    {row.aciklama && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }} noWrap>
                        {row.aciklama}
                      </Typography>
                    )}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1.5 }}>
                      <Chip size="small" label={`Adet: ${row.adet}`} />
                      {row.yer && <Chip size="small" label={row.yer} variant="outlined" />}
                      {row.fiyat != null && <Chip size="small" label={`${Number(row.fiyat).toLocaleString("tr-TR")} ₺`} />}
                    </Box>
                  </CardContent>
                </CardActionArea>
                {canManage && (
                  <Box sx={{ px: 2, pb: 1, pt: 0 }}>
                    <IconButton size="small" onClick={() => openEdit(row)} title="Düzenle">
                      <Edit fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Card>
            ))}
          </Box>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId != null ? "Envanter düzenle" : "Yeni envanter"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField label="Kod" value={form.kod} onChange={(e) => setForm((f) => ({ ...f, kod: e.target.value }))} required fullWidth />
            <TextField label="Malzeme adı" value={form.malzeme_adi} onChange={(e) => setForm((f) => ({ ...f, malzeme_adi: e.target.value }))} required fullWidth />
            <TextField label="Açıklama" value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} fullWidth multiline rows={2} />
            <TextField label="Adet" type="number" value={form.adet} onChange={(e) => setForm((f) => ({ ...f, adet: e.target.value }))} fullWidth inputProps={{ min: 1 }} />
            <TextField label="Fiyat" type="number" value={form.fiyat} onChange={(e) => setForm((f) => ({ ...f, fiyat: e.target.value }))} fullWidth />
            <TextField label="Yer" value={form.yer} onChange={(e) => setForm((f) => ({ ...f, yer: e.target.value }))} placeholder="Örn: Tünel, Şantiye, Merkez" fullWidth />
            <FormControl fullWidth>
              <InputLabel>Şantiye</InputLabel>
              <Select value={form.site_id} label="Şantiye" onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}>
                <MenuItem value="">Seçin</MenuItem>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>İptal</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.kod.trim() || !form.malzeme_adi.trim()} sx={{ background: "var(--icsp-lacivert)" }}>
            {editingId != null ? "Güncelle" : "Ekle"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
