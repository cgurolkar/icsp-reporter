"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  Box, Typography, Button, Paper, Card, CardContent, CardActionArea,
  FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, IconButton, InputAdornment,
  Chip, TablePagination, Table, TableHead, TableBody, TableRow, TableCell,
  ToggleButtonGroup, ToggleButton, Tooltip, Badge,
} from "@mui/material"
import {
  Add, Edit, Search, Inventory2, Download, Upload, Delete, SwapHoriz,
  GridView, ViewList, AddPhotoAlternate,
} from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"
import { SortableTh, type SortDir } from "@/components/idari/SortableTh"

const DURUM_OPTS = [
  { value: "aktif", label: "Aktif" },
  { value: "arizali", label: "ArÄ±zalÄ±" },
  { value: "tamirde", label: "Tamirde" },
  { value: "hurda", label: "Hurda" },
]

const SABIT_YERLER = ["BaÄŸdat Depo", "Erbil Depo 1", "Erbil Depo 2", "SatÄ±n AlÄ±nanlar"]

function durumBadge(durum: string, siteId: number | null | undefined) {
  if (!durum || durum === "aktif") {
    if (siteId) return { label: "KullanÄ±mda", bg: "#b71c1c", color: "#fff" }
    return { label: "HazÄ±r", bg: "#2e7d32", color: "#fff" }
  }
  if (durum === "arizali" || durum === "tamirde") return { label: durum === "arizali" ? "ArÄ±zalÄ±" : "Tamirde", bg: "#f57f17", color: "#fff" }
  return { label: "Hurda", bg: "#616161", color: "#fff" }
}

interface SiteItem { id: number; name: string; code: string }

interface EnvanterRow {
  id: number; kod: string; malzeme_adi: string; aciklama?: string | null
  adet: number; fotograf_yolu?: string | null; fiyat?: number | null
  yer?: string | null; site_id?: number | null; site_name?: string | null
  durum?: string | null
}

const emptyForm = {
  kod: "", malzeme_adi: "", aciklama: "", adet: "1", fiyat: "",
  yer: "", site_id: "", durum: "aktif", fotograf_base64: "",
}

export default function IdariEnvanterPage() {
  const { user } = useAuth()
  const [list, setList] = useState<EnvanterRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 24
  const [sites, setSites] = useState<SiteItem[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [yerFilter, setYerFilter] = useState<string>("")
  const [durumFilter, setDurumFilter] = useState<string>("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState("kod")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const imgInputRef = useRef<HTMLInputElement>(null)
  const [imgPreview, setImgPreview] = useState<string>("")

  // Hareket dialog
  const [hareketDialogOpen, setHareketDialogOpen] = useState(false)
  const [hareketEnvanterId, setHareketEnvanterId] = useState<number | null>(null)
  const [hareketEnvanterAdi, setHareketEnvanterAdi] = useState("")
  const [hareketSaving, setHareketSaving] = useState(false)
  const [hareketForm, setHareketForm] = useState({
    hareket_tipi: "gelen" as "gelen" | "giden",
    kaynak_yer: "", hedef_yer: "", site_id: "",
    tarih: new Date().toISOString().slice(0, 10),
    adet: "1", notlar: "",
  })

  const [form, setForm] = useState(emptyForm)
  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "super_admin" || role === "admin" || role === "manager"

  const handleListSort = (k: string, d: SortDir) => {
    setSortBy(k)
    setSortDir(d)
    setPage(0)
  }

  useEffect(() => {
    fetch("/api/sites").then((r) => (r.ok ? r.json() : [])).then(setSites).catch(() => setSites([]))
  }, [])

  const loadList = (p = page) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (siteId) params.set("siteId", siteId)
    if (yerFilter) params.set("yer", yerFilter)
    if (durumFilter) params.set("durum", durumFilter)
    if (search.trim()) params.set("search", search.trim())
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(p * PAGE_SIZE))
    params.set("sortBy", sortBy)
    params.set("sortDir", sortDir)
    fetch(`/api/idari/envanter?${params}`)
      .then((r) => (r.ok ? r.json() : { data: [], total: 0 }))
      .then((res: { data: EnvanterRow[]; total: number } | EnvanterRow[]) => {
        if (Array.isArray(res)) { setList(res); setTotal(res.length) }
        else { setList(res.data ?? []); setTotal(res.total ?? 0) }
      })
      .catch(() => { setList([]); setTotal(0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(0); loadList(0) }, [siteId, yerFilter, durumFilter, search, sortBy, sortDir])
  useEffect(() => { loadList(page) }, [page])

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setImgPreview("")
    setDialogOpen(true)
  }
  const openEdit = (row: EnvanterRow) => {
    setEditingId(row.id)
    setForm({
      kod: row.kod, malzeme_adi: row.malzeme_adi, aciklama: row.aciklama ?? "",
      adet: String(row.adet ?? 1), fiyat: row.fiyat != null ? String(row.fiyat) : "",
      yer: row.yer ?? "", site_id: row.site_id ? String(row.site_id) : "",
      durum: row.durum ?? "aktif", fotograf_base64: "",
    })
    setImgPreview(row.fotograf_yolu ?? "")
    setDialogOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) { alert("Resim 4MB'dan kÃ¼Ã§Ã¼k olmalÄ±."); return }
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      setImgPreview(b64)
      setForm((f) => ({ ...f, fotograf_base64: b64 }))
    }
    reader.readAsDataURL(file)
  }

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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        envanter_id: hareketEnvanterId, hareket_tipi: hareketForm.hareket_tipi,
        kaynak_yer: hareketForm.kaynak_yer || null, hedef_yer: hareketForm.hedef_yer || null,
        site_id: hareketForm.site_id ? parseInt(hareketForm.site_id, 10) : null,
        tarih: hareketForm.tarih, adet: parseInt(hareketForm.adet, 10) || 1,
        notlar: hareketForm.notlar || null,
      }),
    })
    setHareketSaving(false)
    if (res.ok) { setHareketDialogOpen(false); loadList() }
    else { const err = await res.json().catch(() => ({})); alert(err.error || "Kaydedilemedi.") }
  }

  const handleDelete = async () => {
    if (confirmDeleteId == null) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/idari/envanter/${confirmDeleteId}`, { method: "DELETE" })
      if (res.ok) { setConfirmDeleteId(null); loadList() }
      else { const err = await res.json().catch(() => ({})); alert(err.error || "Silinemedi.") }
    } finally { setDeleting(false) }
  }

  const handleSave = async () => {
    if (!form.kod.trim() || !form.malzeme_adi.trim()) return
    const yerFinal = form.yer === "Åžantiye" && form.site_id
      ? sites.find((s) => String(s.id) === form.site_id)?.name ?? form.yer
      : form.yer
    const payload = {
      kod: form.kod.trim(), malzeme_adi: form.malzeme_adi.trim(),
      aciklama: form.aciklama || null, adet: parseInt(form.adet, 10) || 1,
      fiyat: form.fiyat ? parseFloat(form.fiyat) : null,
      yer: yerFinal || null,
      site_id: form.site_id ? parseInt(form.site_id, 10) : null,
      durum: form.durum || "aktif",
      fotograf_yolu: form.fotograf_base64 || (editingId != null ? imgPreview : null),
    }
    const url = editingId != null ? `/api/idari/envanter/${editingId}` : "/api/idari/envanter"
    const method = editingId != null ? "PUT" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    if (res.ok) { setDialogOpen(false); loadList() }
    else { const err = await res.json().catch(() => ({})); alert(err.error || "Kaydedilemedi.") }
  }

  function DurumBadge({ row }: { row: EnvanterRow }) {
    const b = durumBadge(row.durum ?? "aktif", row.site_id)
    return (
      <Box component="span" sx={{
        display: "inline-block", px: 1, py: 0.25, borderRadius: 1,
        fontSize: 11, fontWeight: 700, background: b.bg, color: b.color, lineHeight: 1.6,
      }}>
        {b.label}
      </Box>
    )
  }

  function CardImgArea({ row }: { row: EnvanterRow }) {
    const b = durumBadge(row.durum ?? "aktif", row.site_id)
    return (
      <Box sx={{ position: "relative" }}>
        {row.fotograf_yolu ? (
          <Box component="img" src={row.fotograf_yolu} alt={row.malzeme_adi}
            sx={{ width: "100%", height: 120, objectFit: "cover", bgcolor: "grey.100", display: "block" }} />
        ) : (
          <Box sx={{ width: "100%", height: 72, bgcolor: "grey.50", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Inventory2 sx={{ fontSize: 32, color: "grey.300" }} />
          </Box>
        )}
        <Box sx={{ position: "absolute", top: 6, right: 6,
          px: 0.75, py: 0.25, borderRadius: 1, fontSize: 10, fontWeight: 700,
          background: b.bg, color: b.color, lineHeight: 1.6, boxShadow: 1 }}>
          {b.label}
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Envanter
      </Typography>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        {/* Filtreler */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
          <TextField
            size="small" placeholder="Kod veya malzeme ara..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Yer</InputLabel>
            <Select value={yerFilter} label="Yer" onChange={(e) => setYerFilter(e.target.value)}>
              <MenuItem value="">TÃ¼mÃ¼</MenuItem>
              {SABIT_YERLER.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              <MenuItem value="Åžantiye">Åžantiye</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Durum</InputLabel>
            <Select value={durumFilter} label="Durum" onChange={(e) => setDurumFilter(e.target.value)}>
              <MenuItem value="">TÃ¼mÃ¼</MenuItem>
              {DURUM_OPTS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Åžantiye</InputLabel>
            <Select value={siteId} label="Åžantiye" onChange={(e) => setSiteId(e.target.value)}>
              <MenuItem value="">TÃ¼mÃ¼</MenuItem>
              {sites.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>

          <Box sx={{ ml: "auto", display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <ToggleButtonGroup
              value={viewMode} exclusive size="small"
              onChange={(_, v) => { if (v) setViewMode(v) }}
            >
              <ToggleButton value="grid"><GridView fontSize="small" /></ToggleButton>
              <ToggleButton value="list"><ViewList fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
            {canManage && (
              <>
                <Button variant="outlined" size="small" startIcon={<Download />}
                  href="/api/idari/envanter/template" download="envanter_sablonu.xlsx"
                  sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}>
                  Åžablon
                </Button>
                <Button variant="outlined" size="small" component="label" startIcon={<Upload />} disabled={importing}
                  sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}>
                  {importing ? "YÃ¼kleniyorâ€¦" : "Excel aktar"}
                  <input type="file" accept=".xlsx,.xls" hidden onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return
                    setImporting(true)
                    try {
                      const fd = new FormData(); fd.append("file", file)
                      const res = await fetch("/api/idari/envanter/import", { method: "POST", body: fd })
                      const data = await res.json().catch(() => ({}))
                      if (res.ok) {
                        const parts = [
                          data.inserted > 0 ? `${data.inserted} yeni` : "",
                          data.updated > 0 ? `${data.updated} gÃ¼ncellendi` : "",
                          data.skipped > 0 ? `${data.skipped} deÄŸiÅŸiklik yok (aynÄ± kod, boÅŸ satÄ±r)` : "",
                        ].filter(Boolean)
                        alert(
                          (parts.length ? parts.join(", ") : "Ä°ÅŸlem tamamlandÄ±") +
                            (data.failed > 0 ? ` Â· ${data.failed} hata` : ""),
                        )
                        loadList()
                      }
                      else alert(data.error || "Aktarma hatasÄ±.")
                    } finally { setImporting(false); e.target.value = "" }
                  }} />
                </Button>
                <Button variant="contained" size="small" startIcon={<Add />} onClick={openAdd} sx={{ background: "var(--icsp-lacivert)" }}>
                  Yeni
                </Button>
              </>
            )}
          </Box>
        </Box>

        {loading ? (
          <Typography color="text.secondary">YÃ¼kleniyor...</Typography>
        ) : list.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>KayÄ±t bulunamadÄ±.</Typography>
        ) : viewMode === "list" ? (
          /* â”€â”€ Liste gÃ¶rÃ¼nÃ¼mÃ¼ â”€â”€ */
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <SortableTh label="Malzeme" sortKey="malzeme_adi" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="Kod" sortKey="kod" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="Adet" sortKey="adet" sortBy={sortBy} sortDir={sortDir} align="center" onSort={handleListSort} />
                  <SortableTh label="Yer" sortKey="yer" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="Durum" sortKey="durum" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="Fiyat" sortKey="fiyat" sortBy={sortBy} sortDir={sortDir} align="right" onSort={handleListSort} />
                  <TableCell align="right">Ä°ÅŸlem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        {row.fotograf_yolu
                          ? <Box component="img" src={row.fotograf_yolu} sx={{ width: 36, height: 36, objectFit: "cover", borderRadius: 1 }} />
                          : <Box sx={{ width: 36, height: 36, bgcolor: "grey.100", borderRadius: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><Inventory2 sx={{ fontSize: 18, color: "grey.400" }} /></Box>
                        }
                        <Link href={`/idari/envanter/${row.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                          <Typography variant="body2" fontWeight={600}>{row.malzeme_adi}</Typography>
                        </Link>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="caption">{row.kod}</Typography></TableCell>
                    <TableCell align="center">{row.adet}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.yer ?? "â€”"}</Typography>
                      {row.site_name && <Typography variant="caption" color="primary">{row.site_name}</Typography>}
                    </TableCell>
                    <TableCell>
                      {(() => { const b = durumBadge(row.durum ?? "aktif", row.site_id); return (
                        <Box component="span" sx={{ px: 0.75, py: 0.25, borderRadius: 1, fontSize: 11, fontWeight: 700, background: b.bg, color: b.color }}>
                          {b.label}
                        </Box>
                      )})()}
                    </TableCell>
                    <TableCell align="right">
                      {row.fiyat != null ? `${Number(row.fiyat).toLocaleString("tr-TR")} â‚º` : "â€”"}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {canManage && (
                        <>
                          <Tooltip title="Hareket"><IconButton size="small" onClick={() => openHareket(row)} sx={{ color: "primary.main" }}><SwapHoriz fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="DÃ¼zenle"><IconButton size="small" onClick={() => openEdit(row)}><Edit fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Sil"><IconButton size="small" onClick={() => setConfirmDeleteId(row.id)} sx={{ color: "error.main" }}><Delete fontSize="small" /></IconButton></Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          /* â”€â”€ Grid gÃ¶rÃ¼nÃ¼mÃ¼ â”€â”€ */
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3,1fr)", md: "repeat(4,1fr)" }, gap: 1.5 }}>
            {list.map((row) => (
              <Card key={row.id} variant="outlined" sx={{ borderRadius: 2, display: "flex", flexDirection: "column" }}>
                <CardActionArea component={Link} href={`/idari/envanter/${row.id}`} sx={{ flex: 1 }}>
                  <CardImgArea row={row} />
                  <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="body2" fontWeight={700} sx={{ color: "var(--icsp-lacivert)", lineHeight: 1.3 }} noWrap>
                      {row.malzeme_adi}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{row.kod}</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.4, mt: 0.75 }}>
                      <Chip size="small" label={`${row.adet} adet`} sx={{ fontSize: 10, height: 20 }} />
                      {row.yer && <Chip size="small" label={row.yer} variant="outlined" sx={{ fontSize: 10, height: 20 }} />}
                    </Box>
                  </CardContent>
                </CardActionArea>
                {canManage && (
                  <Box sx={{ px: 1, pb: 0.75, display: "flex", gap: 0.25 }}>
                    <IconButton size="small" onClick={() => openHareket(row)} sx={{ color: "primary.main" }}><SwapHoriz sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => openEdit(row)}><Edit sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={() => setConfirmDeleteId(row.id)} sx={{ color: "error.main" }}><Delete sx={{ fontSize: 16 }} /></IconButton>
                  </Box>
                )}
              </Card>
            ))}
          </Box>
        )}

        {!loading && total > PAGE_SIZE && (
          <TablePagination component="div" count={total} page={page}
            onPageChange={(_, p) => setPage(p)} rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            labelDisplayedRows={({ from, to, count }) => `${from}â€“${to} / ${count}`}
            sx={{ borderTop: "1px solid", borderColor: "divider" }}
          />
        )}
        {!loading && (
          <Box sx={{ px: 1, pb: 1, mt: 1 }}>
            <Chip label={`Toplam: ${total} malzeme`} size="small" variant="outlined" />
          </Box>
        )}
      </Paper>

      {/* â”€â”€ Ekle / DÃ¼zenle Dialog â”€â”€ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId != null ? "Envanter dÃ¼zenle" : "Yeni envanter"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {/* Resim */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <Box
                onClick={() => imgInputRef.current?.click()}
                sx={{ width: "100%", height: 140, bgcolor: "grey.100", borderRadius: 2, border: "2px dashed #bbb",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", overflow: "hidden", position: "relative", "&:hover": { borderColor: "primary.main" } }}
              >
                {imgPreview ? (
                  <Box component="img" src={imgPreview} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <>
                    <AddPhotoAlternate sx={{ fontSize: 36, color: "grey.400" }} />
                    <Typography variant="caption" color="text.secondary">Resim ekle (max 4MB)</Typography>
                  </>
                )}
              </Box>
              <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={handleImageChange} />
              {imgPreview && (
                <Button size="small" color="error" onClick={() => { setImgPreview(""); setForm((f) => ({ ...f, fotograf_base64: "" })) }}>
                  Resmi kaldÄ±r
                </Button>
              )}
            </Box>

            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Kod" value={form.kod} onChange={(e) => setForm((f) => ({ ...f, kod: e.target.value }))} required fullWidth />
              <TextField label="Adet" type="number" value={form.adet} onChange={(e) => setForm((f) => ({ ...f, adet: e.target.value }))} fullWidth inputProps={{ min: 0 }} sx={{ maxWidth: 100 }} />
            </Box>
            <TextField label="Malzeme adÄ±" value={form.malzeme_adi} onChange={(e) => setForm((f) => ({ ...f, malzeme_adi: e.target.value }))} required fullWidth />
            <TextField label="AÃ§Ä±klama" value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} fullWidth multiline rows={2} />
            <TextField label="Fiyat" type="number" value={form.fiyat} onChange={(e) => setForm((f) => ({ ...f, fiyat: e.target.value }))} fullWidth />

            {/* Durum */}
            <FormControl fullWidth>
              <InputLabel>Durum</InputLabel>
              <Select value={form.durum} label="Durum" onChange={(e) => setForm((f) => ({ ...f, durum: e.target.value }))}>
                {DURUM_OPTS.map((d) => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
              </Select>
            </FormControl>

            {/* Yer (konum) */}
            <FormControl fullWidth>
              <InputLabel>Konum / Yer</InputLabel>
              <Select value={form.yer} label="Konum / Yer"
                onChange={(e) => setForm((f) => ({ ...f, yer: e.target.value, site_id: e.target.value !== "Åžantiye" ? "" : f.site_id }))}>
                <MenuItem value="">â€” SeÃ§in â€”</MenuItem>
                {SABIT_YERLER.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                <MenuItem value="Åžantiye">ðŸ“ Åžantiye</MenuItem>
              </Select>
            </FormControl>

            {/* Åžantiye seÃ§imi â€“ sadece "Åžantiye" seÃ§ilince */}
            {form.yer === "Åžantiye" && (
              <FormControl fullWidth required>
                <InputLabel>Åžantiye SeÃ§</InputLabel>
                <Select value={form.site_id} label="Åžantiye SeÃ§"
                  onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}>
                  <MenuItem value="">â€” SeÃ§in â€”</MenuItem>
                  {sites.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Ä°ptal</Button>
          <Button variant="contained" onClick={handleSave}
            disabled={!form.kod.trim() || !form.malzeme_adi.trim() || (form.yer === "Åžantiye" && !form.site_id)}
            sx={{ background: "var(--icsp-lacivert)" }}>
            {editingId != null ? "GÃ¼ncelle" : "Ekle"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* â”€â”€ Hareket Dialog â”€â”€ */}
      <Dialog open={hareketDialogOpen} onClose={() => setHareketDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="subtitle1" fontWeight={600}>Hareket Ekle</Typography>
          <Typography variant="body2" color="text.secondary">{hareketEnvanterAdi}</Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Hareket TÃ¼rÃ¼</InputLabel>
              <Select value={hareketForm.hareket_tipi} label="Hareket TÃ¼rÃ¼"
                onChange={(e) => setHareketForm((f) => ({ ...f, hareket_tipi: e.target.value as "gelen" | "giden" }))}>
                <MenuItem value="gelen">â¬‡ï¸ Gelen (Depo / SatÄ±n alÄ±ndÄ± â†’ Åžantiye)</MenuItem>
                <MenuItem value="giden">â¬†ï¸ Giden (Åžantiye â†’ Depo veya baÅŸka ÅŸantiye)</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Nereden</InputLabel>
              <Select value={hareketForm.kaynak_yer} label="Nereden"
                onChange={(e) => setHareketForm((f) => ({ ...f, kaynak_yer: e.target.value }))}>
                <MenuItem value="">â€” SeÃ§in â€”</MenuItem>
                {hareketForm.hareket_tipi === "gelen" && <MenuItem value="SatÄ±n alÄ±ndÄ±">SatÄ±n alÄ±ndÄ±</MenuItem>}
                {SABIT_YERLER.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                {sites.map((s) => <MenuItem key={s.id} value={s.name}>{s.name} (Åžantiye)</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Nereye</InputLabel>
              <Select value={hareketForm.hedef_yer} label="Nereye"
                onChange={(e) => {
                  const val = e.target.value
                  const matchSite = sites.find((s) => s.name === val)
                  setHareketForm((f) => ({ ...f, hedef_yer: val, site_id: matchSite ? String(matchSite.id) : f.site_id }))
                }}>
                <MenuItem value="">â€” SeÃ§in â€”</MenuItem>
                {SABIT_YERLER.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                {sites.map((s) => <MenuItem key={s.id} value={s.name}>{s.name} (Åžantiye)</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Adet" type="number" value={hareketForm.adet}
                onChange={(e) => setHareketForm((f) => ({ ...f, adet: e.target.value }))}
                inputProps={{ min: 1 }} sx={{ width: 110 }} />
              <TextField label="Tarih" type="date" value={hareketForm.tarih}
                onChange={(e) => setHareketForm((f) => ({ ...f, tarih: e.target.value.slice(0, 10) }))}
                InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
            </Box>
            <TextField label="Not" value={hareketForm.notlar}
              onChange={(e) => setHareketForm((f) => ({ ...f, notlar: e.target.value }))}
              fullWidth multiline rows={2} placeholder="Fatura no, teslim eden vb." />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHareketDialogOpen(false)} disabled={hareketSaving}>Ä°ptal</Button>
          <Button variant="contained" onClick={handleHareketSave}
            disabled={hareketSaving || !hareketForm.tarih || parseInt(hareketForm.adet, 10) < 1}
            sx={{ background: "var(--icsp-lacivert)" }}>
            {hareketSaving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* â”€â”€ Silme Onay â”€â”€ */}
      <Dialog open={confirmDeleteId != null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Envanter KaydÄ± Sil</DialogTitle>
        <DialogContent><Typography>Bu kayÄ±t kalÄ±cÄ± olarak silinecek. Emin misiniz?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Ä°ptal</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Siliniyorâ€¦" : "Evet, Sil"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

