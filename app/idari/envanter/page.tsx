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
  TablePagination,
} from "@mui/material"
import { Add, Edit, Search, Inventory2, Download, Upload, Delete, SwapHoriz } from "@mui/icons-material"
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
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 24
  const [sites, setSites] = useState<SiteItem[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [yerFilter, setYerFilter] = useState<string>("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Hareket dialog state
  const [hareketDialogOpen, setHareketDialogOpen] = useState(false)
  const [hareketEnvanterId, setHareketEnvanterId] = useState<number | null>(null)
  const [hareketEnvanterAdi, setHareketEnvanterAdi] = useState("")
  const [hareketSaving, setHareketSaving] = useState(false)
  const [hareketForm, setHareketForm] = useState({
    hareket_tipi: "gelen" as "gelen" | "giden",
    kaynak_yer: "",
    hedef_yer: "",
    site_id: "",
    tarih: new Date().toISOString().slice(0, 10),
    adet: "1",
    notlar: "",
  })

  const SABIT_YERLER = ["Erbil Depo", "Bağdat Depo", "Satın alındı"]

  const openHareket = (row: EnvanterRow) => {
    setHareketEnvanterId(row.id)
    setHareketEnvanterAdi(row.malzeme_adi)
    setHareketForm({ hareket_tipi: "gelen", kaynak_yer: "", hedef_yer: "", site_id: "", tarih: new Date().toISOString().slice(0, 10), adet: "1", notlar: "" })
    setHareketDialogOpen(true)
  }

  const handleHareketSave = async () => {
    if (!hareketEnvanterId) return
    setHareketSaving(true)
    const res = await fetch("/api/idari/envanter/hareket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        envanter_id: hareketEnvanterId,
        hareket_tipi: hareketForm.hareket_tipi,
        kaynak_yer: hareketForm.kaynak_yer || null,
        hedef_yer: hareketForm.hedef_yer || null,
        site_id: hareketForm.site_id ? parseInt(hareketForm.site_id, 10) : null,
        tarih: hareketForm.tarih,
        adet: parseInt(hareketForm.adet, 10) || 1,
        notlar: hareketForm.notlar || null,
      }),
    })
    setHareketSaving(false)
    if (res.ok) {
      setHareketDialogOpen(false)
      loadList()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Kaydedilemedi.")
    }
  }

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

  const loadList = (p = page) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (siteId) params.set("siteId", siteId)
    if (yerFilter) params.set("yer", yerFilter)
    if (search.trim()) params.set("search", search.trim())
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(p * PAGE_SIZE))
    fetch(`/api/idari/envanter?${params}`)
      .then((r) => (r.ok ? r.json() : { data: [], total: 0 }))
      .then((res: { data: EnvanterRow[]; total: number } | EnvanterRow[]) => {
        if (Array.isArray(res)) { setList(res); setTotal(res.length) }
        else { setList(res.data ?? []); setTotal(res.total ?? 0) }
      })
      .catch(() => { setList([]); setTotal(0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(0); loadList(0) }, [siteId, yerFilter, search])
  useEffect(() => { loadList(page) }, [page])

  const yerler = Array.from(new Set(list.map((e) => e.yer).filter(Boolean))) as string[]
  const filteredList = list  // filtering now done server-side

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

  const handleDelete = async () => {
    if (confirmDeleteId == null) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/idari/envanter/${confirmDeleteId}`, { method: "DELETE" })
      if (res.ok) {
        setConfirmDeleteId(null)
        loadList()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Silinemedi.")
      }
    } catch {
      alert("Bağlantı hatası.")
    } finally {
      setDeleting(false)
    }
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
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", ml: { xs: 0, sm: "auto" } }}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                href="/api/idari/envanter/template"
                download="envanter_sablonu.xlsx"
                sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}
              >
                Şablon
              </Button>
              <Button
                variant="outlined"
                component="label"
                startIcon={<Upload />}
                disabled={importing}
                sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}
              >
                {importing ? "Yükleniyor…" : "Excel'den aktar"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setImporting(true)
                    try {
                      const fd = new FormData()
                      fd.append("file", file)
                      const res = await fetch("/api/idari/envanter/import", { method: "POST", body: fd })
                      const data = await res.json().catch(() => ({}))
                      if (res.ok) {
                        alert(`${data.inserted} kayıt eklendi.${data.failed > 0 ? ` ${data.failed} satır atlandı.` : ""}`)
                        loadList()
                      } else {
                        alert(data.error || "İçe aktarma hatası.")
                      }
                    } catch {
                      alert("Bağlantı hatası.")
                    } finally {
                      setImporting(false)
                      e.target.value = ""
                    }
                  }}
                />
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ background: "var(--icsp-lacivert)" }}>
                Yeni kayıt
              </Button>
            </Box>
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
                  <CardContent sx={{ "&:last-child": { pb: 2 }, display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                    {row.fotograf_yolu ? (
                      <Box
                        component="img"
                        src={row.fotograf_yolu}
                        alt={row.malzeme_adi}
                        sx={{ width: 56, height: 56, objectFit: "cover", borderRadius: 1, flexShrink: 0, bgcolor: "grey.100" }}
                      />
                    ) : (
                      <Box sx={{ width: 56, height: 56, borderRadius: 1, bgcolor: "grey.100", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Inventory2 sx={{ fontSize: 28, color: "grey.400" }} />
                      </Box>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" fontWeight={600} sx={{ color: "var(--icsp-lacivert)", lineHeight: 1.2 }} noWrap>
                        {row.malzeme_adi}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {row.kod}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                        <Chip size="small" label={`Adet: ${row.adet}`} />
                        {row.yer && <Chip size="small" label={row.yer} variant="outlined" />}
                        {row.fiyat != null && <Chip size="small" label={`${Number(row.fiyat).toLocaleString("tr-TR")} ₺`} />}
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
                {canManage && (
                  <Box sx={{ px: 2, pb: 1, display: "flex", gap: 0.5 }}>
                    <IconButton size="small" onClick={() => openHareket(row)} title="Hareket ekle" sx={{ color: "primary.main" }}>
                      <SwapHoriz fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => openEdit(row)} title="Düzenle">
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setConfirmDeleteId(row.id)} title="Sil" sx={{ color: "error.main" }}>
                      <Delete fontSize="small" />
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
                  {row.fotograf_yolu ? (
                    <Box
                      component="img"
                      src={row.fotograf_yolu}
                      alt={row.malzeme_adi}
                      sx={{ width: "100%", height: 140, objectFit: "cover", bgcolor: "grey.100" }}
                    />
                  ) : (
                    <Box sx={{ width: "100%", height: 80, bgcolor: "grey.50", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Inventory2 sx={{ fontSize: 36, color: "grey.300" }} />
                    </Box>
                  )}
                  <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: "var(--icsp-lacivert)", lineHeight: 1.3 }}>
                      {row.malzeme_adi}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {row.kod}
                    </Typography>
                    {row.aciklama && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} noWrap>
                        {row.aciklama}
                      </Typography>
                    )}
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                      <Chip size="small" label={`Adet: ${row.adet}`} />
                      {row.yer && <Chip size="small" label={row.yer} variant="outlined" />}
                      {row.fiyat != null && <Chip size="small" label={`${Number(row.fiyat).toLocaleString("tr-TR")} ₺`} />}
                    </Box>
                  </CardContent>
                </CardActionArea>
                {canManage && (
                  <Box sx={{ px: 2, pb: 1, pt: 0, display: "flex", gap: 0.5 }}>
                    <IconButton size="small" onClick={() => openHareket(row)} title="Hareket ekle" sx={{ color: "primary.main" }}>
                      <SwapHoriz fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => openEdit(row)} title="Düzenle">
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setConfirmDeleteId(row.id)} title="Sil" sx={{ color: "error.main" }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Card>
            ))}
          </Box>
        )}

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
            sx={{ borderTop: "1px solid", borderColor: "divider" }}
          />
        )}
        {!loading && (
          <Box sx={{ px: 2, pb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <Chip label={`Toplam: ${total} malzeme`} size="small" variant="outlined" />
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

      {/* Hareket diyaloğu */}
      <Dialog open={hareketDialogOpen} onClose={() => setHareketDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Hareket Ekle</Typography>
            <Typography variant="body2" color="text.secondary">{hareketEnvanterAdi}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Hareket Türü</InputLabel>
              <Select
                value={hareketForm.hareket_tipi}
                label="Hareket Türü"
                onChange={(e) => setHareketForm((f) => ({ ...f, hareket_tipi: e.target.value as "gelen" | "giden" }))}
              >
                <MenuItem value="gelen">⬇️ Gelen (Depo/satın alındı → Şantiye)</MenuItem>
                <MenuItem value="giden">⬆️ Giden (Şantiye → Depo veya başka şantiye)</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Nereden</InputLabel>
              <Select
                value={hareketForm.kaynak_yer}
                label="Nereden"
                onChange={(e) => setHareketForm((f) => ({ ...f, kaynak_yer: e.target.value }))}
              >
                <MenuItem value="">— Seçin —</MenuItem>
                {hareketForm.hareket_tipi === "gelen" && <MenuItem value="Satın alındı">Satın alındı</MenuItem>}
                <MenuItem value="Erbil Depo">Erbil Depo</MenuItem>
                <MenuItem value="Bağdat Depo">Bağdat Depo</MenuItem>
                {sites.map((s) => <MenuItem key={s.id} value={s.name}>{s.name} (Şantiye)</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Nereye / Hedef Şantiye</InputLabel>
              <Select
                value={hareketForm.hedef_yer}
                label="Nereye / Hedef Şantiye"
                onChange={(e) => {
                  const val = e.target.value
                  const matchSite = sites.find((s) => s.name === val)
                  setHareketForm((f) => ({
                    ...f,
                    hedef_yer: val,
                    site_id: matchSite ? String(matchSite.id) : f.site_id,
                  }))
                }}
              >
                <MenuItem value="">— Seçin —</MenuItem>
                <MenuItem value="Erbil Depo">Erbil Depo</MenuItem>
                <MenuItem value="Bağdat Depo">Bağdat Depo</MenuItem>
                {sites.map((s) => <MenuItem key={s.id} value={s.name}>{s.name} (Şantiye)</MenuItem>)}
              </Select>
            </FormControl>

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Adet"
                type="number"
                value={hareketForm.adet}
                onChange={(e) => setHareketForm((f) => ({ ...f, adet: e.target.value }))}
                inputProps={{ min: 1 }}
                sx={{ width: 120 }}
              />
              <TextField
                label="Tarih"
                type="date"
                value={hareketForm.tarih}
                onChange={(e) => setHareketForm((f) => ({ ...f, tarih: e.target.value.slice(0, 10) }))}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
            </Box>

            <TextField
              label="Not"
              value={hareketForm.notlar}
              onChange={(e) => setHareketForm((f) => ({ ...f, notlar: e.target.value }))}
              fullWidth
              multiline
              rows={2}
              placeholder="Fatura no, teslim eden kişi vb."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHareketDialogOpen(false)} disabled={hareketSaving}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleHareketSave}
            disabled={hareketSaving || !hareketForm.tarih || parseInt(hareketForm.adet, 10) < 1}
            sx={{ background: "var(--icsp-lacivert)" }}
          >
            {hareketSaving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Silme onay dialogu */}
      <Dialog open={confirmDeleteId != null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Envanter Kaydı Sil</DialogTitle>
        <DialogContent>
          <Typography>Bu kayıt kalıcı olarak silinecek. Emin misiniz?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)} disabled={deleting}>İptal</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Siliniyor…" : "Evet, Sil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
