"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  TablePagination,
  Chip,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Tooltip,
  Divider,
} from "@mui/material"
import {
  Add,
  Edit,
  Visibility,
  Download,
  Upload,
  Delete,
  BeachAccess,
  ViewList,
  GridView,
  Person,
  AddPhotoAlternate,
} from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"
import { SortableTh, type SortDir } from "@/components/idari/SortableTh"

const GOREVLER = [
  "İşçi", "Satın Alma", "Formen", "Operatör", "Mühendis",
  "Yağcı", "Şantiye Şefi", "Proje Müdürü",
]

const IZIN_TIPLERI = ["Yıllık", "Mazeret", "Sağlık", "Ücretsiz", "Diğer"]
const CALISTIGI_BOLUM_OPTIONS = ["Şantiye", "Merkez Ofis", "Depo", "Diğer"]

interface SiteItem {
  id: number
  name: string
  code: string
}

interface AtamaRow {
  id: number
  site_id: number
  site_name: string
  baslangic_tarihi: string
  bitis_tarihi: string | null
}

interface PersonelRow {
  id: number
  ad: string
  soyad: string
  gorev: string
  tc_kimlik?: string | null
  pasaport_no?: string | null
  ise_giris_tarihi?: string | null
  isten_cikis_tarihi?: string | null
  calistigi_bolum?: string | null
  gunluk_yevmiye?: number | null
  aylik_maas?: number | null
  foto_yolu?: string | null
  atamalar?: AtamaRow[] | null
}

function activeGorevYeri(row: PersonelRow): string {
  if (!row.atamalar || row.atamalar.length === 0) return "—"
  const active = row.atamalar.find((a) => !a.bitis_tarihi || new Date(a.bitis_tarihi) >= new Date())
  return active?.site_name ?? "—"
}

function activeSiteId(row: PersonelRow): number | null {
  if (!row.atamalar || row.atamalar.length === 0) return null
  const active = row.atamalar.find((a) => !a.bitis_tarihi || new Date(a.bitis_tarihi) >= new Date())
  return active?.site_id ?? null
}

/** Görev metninden öncelik seviyesi (veritabanı sıralaması ile uyumlu). */
function gorevOncelikLabel(g: string): string {
  const s = String(g || "").trim()
  if (!s) return "—"
  if (/proje/i.test(s) && /(müdür|mudur)/i.test(s)) return "1"
  if (/şantiye.*şef|santiye.*sef/i.test(s)) return "2"
  if (/mühendis|muhendis/i.test(s)) return "3"
  if (/formen|foreman/i.test(s)) return "4"
  if (/operatör|operator/i.test(s)) return "5"
  if (/satın.*alma|satin.*alma/i.test(s)) return "6"
  if (/yağcı|yagci/i.test(s)) return "7"
  if (/teknisyen/i.test(s)) return "8"
  if (/işçi|isci|işci/i.test(s)) return "9"
  return "•"
}

// Personal photo / avatar component
function PersonelAvatar({ foto_yolu, ad, soyad, size = 40 }: { foto_yolu?: string | null; ad: string; soyad: string; size?: number }) {
  if (foto_yolu) {
    return (
      <Avatar
        src={foto_yolu}
        sx={{ width: size, height: size }}
        alt={`${ad} ${soyad}`}
      />
    )
  }
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: "var(--icsp-lacivert)", fontSize: size * 0.4 }}>
      {ad[0]?.toUpperCase()}{soyad[0]?.toUpperCase()}
    </Avatar>
  )
}

export default function IdariPersonelPage() {
  const { user } = useAuth()
  const [list, setList] = useState<PersonelRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25
  const [search, setSearch] = useState("")
  const [sites, setSites] = useState<SiteItem[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [gorev, setGorev] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [tabValue, setTabValue] = useState<"aktif" | "arsiv">("aktif")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [sortBy, setSortBy] = useState("ad_soyad")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const siteIdPrevForSortRef = useRef<string>("")

  // İzin dialog state
  const [izinDialogOpen, setIzinDialogOpen] = useState(false)
  const [izinPersonelId, setIzinPersonelId] = useState<number | null>(null)
  const [izinPersonelAd, setIzinPersonelAd] = useState("")
  const [izinSaving, setIzinSaving] = useState(false)
  const [izinForm, setIzinForm] = useState({
    izin_tipi: "Yıllık",
    baslangic_tarihi: "",
    bitis_tarihi: "",
    notlar: "",
  })

  const [form, setForm] = useState({
    ad: "",
    soyad: "",
    gorev: "İşçi",
    tc_kimlik: "",
    pasaport_no: "",
    calistigi_bolum: "",
    dogum_tarihi: "",
    kan_grubu: "",
    acil_iletisim: "",
    acil_telefon: "",
    ise_giris_tarihi: "",
    isten_cikis_tarihi: "",
    sigorta_durumu: "",
    iban: "",
    banka_adi: "",
    gunluk_yevmiye: "",
    aylik_maas: "",
    site_id: "",
    foto_base64: "" as string,
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "super_admin" || role === "admin" || role === "manager"

  const handleListSort = (k: string, d: SortDir) => {
    setSortBy(k)
    setSortDir(d)
    setPage(0)
  }

  const loadSites = () => {
    fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SiteItem[]) => setSites(data))
      .catch(() => setSites([]))
  }

  const loadList = (p = page) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (siteId) params.set("siteId", siteId)
    if (gorev) params.set("gorev", gorev)
    if (search.trim()) params.set("search", search.trim())
    params.set("arsiv", tabValue === "arsiv" ? "true" : "false")
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(p * PAGE_SIZE))
    params.set("sortBy", sortBy)
    params.set("sortDir", sortDir)
    fetch(`/api/idari/personel?${params}`)
      .then((r) => (r.ok ? r.json() : { data: [], total: 0 }))
      .then((res: { data: PersonelRow[]; total: number } | PersonelRow[]) => {
        if (Array.isArray(res)) { setList(res); setTotal(res.length) }
        else { setList(res.data ?? []); setTotal(res.total ?? 0) }
      })
      .catch(() => { setList([]); setTotal(0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSites() }, [])

  /** Şantiye filtresi ilk seçildiğinde: görev hiyerarşisine göre sırala (proje müdürü → … → işçi). */
  useEffect(() => {
    const prev = siteIdPrevForSortRef.current
    if (siteId && !prev) {
      setSortBy("gorev_oncelik")
      setSortDir("asc")
    }
    siteIdPrevForSortRef.current = siteId
  }, [siteId])

  useEffect(() => { setPage(0); loadList(0) }, [siteId, gorev, search, tabValue, sortBy, sortDir])
  useEffect(() => { loadList(page) }, [page])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, foto_base64: (ev.target?.result as string) || "" }))
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const openAdd = () => {
    setEditingId(null)
    setForm({
      ad: "", soyad: "", gorev: "İşçi", tc_kimlik: "", pasaport_no: "",
      calistigi_bolum: "", dogum_tarihi: "", kan_grubu: "", acil_iletisim: "",
      acil_telefon: "", ise_giris_tarihi: "", isten_cikis_tarihi: "",
      sigorta_durumu: "", iban: "", banka_adi: "", gunluk_yevmiye: "", aylik_maas: "",
      site_id: "",
      foto_base64: "",
    })
    setDialogOpen(true)
  }

  const openEdit = (row: PersonelRow) => {
    setEditingId(row.id)
    setForm({
      ad: row.ad,
      soyad: row.soyad,
      gorev: row.gorev || "İşçi",
      tc_kimlik: row.tc_kimlik ?? "",
      pasaport_no: row.pasaport_no ?? "",
      calistigi_bolum: row.calistigi_bolum ?? "",
      dogum_tarihi: "",
      kan_grubu: "",
      acil_iletisim: "",
      acil_telefon: "",
      ise_giris_tarihi: row.ise_giris_tarihi ? String(row.ise_giris_tarihi).slice(0, 10) : "",
      isten_cikis_tarihi: row.isten_cikis_tarihi ? String(row.isten_cikis_tarihi).slice(0, 10) : "",
      sigorta_durumu: "",
      iban: "",
      banka_adi: "",
      gunluk_yevmiye: row.gunluk_yevmiye != null ? String(row.gunluk_yevmiye) : "",
      aylik_maas: row.aylik_maas != null ? String(row.aylik_maas) : "",
      site_id: activeSiteId(row) != null ? String(activeSiteId(row)) : "",
      foto_base64: row.foto_yolu ?? "",
    })
    setDialogOpen(true)
  }

  const openIzin = (row: PersonelRow) => {
    setIzinPersonelId(row.id)
    setIzinPersonelAd(`${row.ad} ${row.soyad}`)
    setIzinForm({ izin_tipi: "Yıllık", baslangic_tarihi: "", bitis_tarihi: "", notlar: "" })
    setIzinDialogOpen(true)
  }

  const handleIzinSave = async () => {
    if (!izinPersonelId || !izinForm.baslangic_tarihi || !izinForm.bitis_tarihi) return
    setIzinSaving(true)
    try {
      const res = await fetch("/api/idari/personel/izin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personel_id: izinPersonelId,
          izin_tipi: izinForm.izin_tipi,
          baslangic_tarihi: izinForm.baslangic_tarihi,
          bitis_tarihi: izinForm.bitis_tarihi,
          notlar: izinForm.notlar || null,
        }),
      })
      if (res.ok) {
        setIzinDialogOpen(false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "İzin kaydedilemedi.")
      }
    } catch {
      alert("Bağlantı hatası.")
    } finally {
      setIzinSaving(false)
    }
  }

  const handleDelete = async () => {
    if (confirmDeleteId == null) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/idari/personel/${confirmDeleteId}`, { method: "DELETE" })
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
    if (!form.ad.trim() || !form.soyad.trim()) return
    const payload = {
      ad: form.ad.trim(),
      soyad: form.soyad.trim(),
      gorev: form.gorev,
      tc_kimlik: form.tc_kimlik || null,
      pasaport_no: form.pasaport_no || null,
      calistigi_bolum: form.calistigi_bolum || null,
      dogum_tarihi: form.dogum_tarihi || null,
      kan_grubu: form.kan_grubu || null,
      acil_iletisim: form.acil_iletisim || null,
      acil_telefon: form.acil_telefon || null,
      ise_giris_tarihi: form.ise_giris_tarihi || null,
      isten_cikis_tarihi: form.isten_cikis_tarihi || null,
      sigorta_durumu: form.sigorta_durumu || null,
      iban: form.iban || null,
      banka_adi: form.banka_adi || null,
      gunluk_yevmiye: form.gunluk_yevmiye ? parseFloat(form.gunluk_yevmiye) : null,
      aylik_maas: form.aylik_maas ? parseFloat(form.aylik_maas) : null,
      foto_yolu: form.foto_base64 || null,
      site_id: form.site_id ? parseInt(form.site_id, 10) : null,
    }
    const url = editingId != null ? `/api/idari/personel/${editingId}` : "/api/idari/personel"
    const method = editingId != null ? "PUT" : "POST"
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    if (res.ok) {
      setDialogOpen(false)
      loadList()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || (editingId != null ? "Güncellenemedi." : "Eklenemedi."))
    }
  }

  const renderActions = (row: PersonelRow) => (
    <>
      <IconButton size="small" component={Link} href={`/idari/personel/${row.id}`} title="Detay">
        <Visibility fontSize="small" />
      </IconButton>
      {canManage && (
        <>
          <IconButton size="small" onClick={() => openEdit(row)} title="Düzenle">
            <Edit fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => openIzin(row)} title="İzin Ekle" sx={{ color: "info.main" }}>
            <BeachAccess fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setConfirmDeleteId(row.id)} title="Sil" sx={{ color: "error.main" }}>
            <Delete fontSize="small" />
          </IconButton>
        </>
      )}
    </>
  )

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600 }}>
          Personel
        </Typography>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => { if (v) setViewMode(v) }}
          size="small"
        >
          <ToggleButton value="list" title="Liste">
            <ViewList fontSize="small" />
          </ToggleButton>
          <ToggleButton value="grid" title="Grid">
            <GridView fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Aktif / Arşiv Tabs */}
      <Tabs
        value={tabValue}
        onChange={(_, v) => { setTabValue(v); setPage(0) }}
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Aktif Personel" value="aktif" />
        <Tab label="Arşiv (Ayrılanlar)" value="arsiv" />
      </Tabs>

      <Paper sx={{ p: 2, mb: 2 }}>
        {/* Filters row */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <TextField
            size="small" label="Ara" placeholder="Ad, soyad veya görev..."
            value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Şantiye</InputLabel>
            <Select value={siteId} label="Şantiye" onChange={(e) => setSiteId(e.target.value)}>
              <MenuItem value="">Tümü</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {siteId ? (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center", maxWidth: 280 }}>
              Şantiye seçili: liste varsayılan olarak görev önem sırasına göre (Proje Müdürü → Şantiye Şefi → Mühendis → …) gelir; tablodan başka sıralama da seçebilirsiniz.
            </Typography>
          ) : null}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Görev</InputLabel>
            <Select value={gorev} label="Görev" onChange={(e) => setGorev(e.target.value)}>
              <MenuItem value="">Tümü</MenuItem>
              {GOREVLER.map((g) => (
                <MenuItem key={g} value={g}>{g}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {canManage && (
            <>
              <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ background: "var(--icsp-lacivert)" }}>
                Yeni personel
              </Button>
              <Button variant="outlined" startIcon={<Download />} href="/api/idari/personel/template" download="personel_sablonu.xlsx" sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}>
                Şablon indir
              </Button>
              <Button variant="outlined" component="label" startIcon={<Upload />} disabled={importing} sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}>
                {importing ? "Yükleniyor…" : "Excel'den içe aktar"}
                <input type="file" accept=".xlsx,.xls" hidden onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file || !canManage) return
                  setImporting(true)
                  try {
                    const fd = new FormData()
                    fd.set("file", file)
                    const res = await fetch("/api/idari/personel/import", { method: "POST", body: fd })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      loadList()
                      alert(`${data.inserted ?? 0} personel eklendi.${(data.failed ?? 0) > 0 ? ` ${data.failed} satır atlandı.` : ""}`)
                    } else alert(data.error || "İçe aktarma başarısız.")
                  } finally {
                    setImporting(false)
                    e.target.value = ""
                  }
                }} />
              </Button>
            </>
          )}
        </Box>

        {loading ? (
          <Typography color="text.secondary">Yükleniyor...</Typography>
        ) : viewMode === "list" ? (
          /* ——— LIST VIEW ——— */
          <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }}></TableCell>
                  <SortableTh label="Ad Soyad" sortKey="ad_soyad" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="Görev" sortKey="gorev" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="Öncelik" sortKey="gorev_oncelik" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="TC / Pasaport" sortKey="kimlik" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="Görev Yeri" sortKey="gorev_yeri" sortBy={sortBy} sortDir={sortDir} onSort={handleListSort} />
                  <SortableTh label="Günlük / Aylık" sortKey="ucret" sortBy={sortBy} sortDir={sortDir} align="right" onSort={handleListSort} />
                  <TableCell align="right">İşlem</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3 }}>Kayıt yok</TableCell>
                  </TableRow>
                ) : (
                  list.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ py: 0.5 }}>
                        <PersonelAvatar foto_yolu={row.foto_yolu} ad={row.ad} soyad={row.soyad} size={32} />
                      </TableCell>
                      <TableCell>{row.ad} {row.soyad}</TableCell>
                      <TableCell>{row.gorev}</TableCell>
                      <TableCell sx={{ color: "text.secondary", fontSize: "0.85rem", fontWeight: 600 }} title="Görev hiyerarşisindeki sıra (düşük = üst kademe)">
                        {gorevOncelikLabel(row.gorev)}
                      </TableCell>
                      <TableCell>{row.tc_kimlik ? `TC: ${row.tc_kimlik}` : row.pasaport_no ? `Pasaport: ${row.pasaport_no}` : "—"}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color={activeGorevYeri(row) !== "—" ? "primary" : "text.secondary"}>
                          {activeGorevYeri(row)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {row.gunluk_yevmiye != null ? row.gunluk_yevmiye : row.aylik_maas != null ? row.aylik_maas : "—"}
                      </TableCell>
                      <TableCell align="right">
                        {renderActions(row)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {total > PAGE_SIZE && (
              <TablePagination
                component="div" count={total} page={page}
                onPageChange={(_, p) => setPage(p)} rowsPerPage={PAGE_SIZE}
                rowsPerPageOptions={[PAGE_SIZE]}
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
              />
            )}
          </Box>
        ) : (
          /* ——— GRID VIEW ——— */
          <>
            {list.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>Kayıt yok</Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }, gap: 2 }}>
                {list.map((row) => (
                  <Card key={row.id} variant="outlined" sx={{ borderRadius: 2, display: "flex", flexDirection: "column" }}>
                    {/* Photo */}
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 2, pb: 1 }}>
                      <PersonelAvatar foto_yolu={row.foto_yolu} ad={row.ad} soyad={row.soyad} size={72} />
                    </Box>
                    <CardContent sx={{ pt: 0.5, pb: 0.5, flexGrow: 1, textAlign: "center" }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                        {row.ad} {row.soyad}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.gorev}
                      </Typography>
                      {activeGorevYeri(row) !== "—" && (
                        <Chip
                          label={activeGorevYeri(row)}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mt: 0.5, fontSize: 10 }}
                        />
                      )}
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ justifyContent: "center", py: 0.5, gap: 0 }}>
                      {renderActions(row)}
                    </CardActions>
                  </Card>
                ))}
              </Box>
            )}
            {total > PAGE_SIZE && (
              <TablePagination
                component="div" count={total} page={page}
                onPageChange={(_, p) => setPage(p)} rowsPerPage={PAGE_SIZE}
                rowsPerPageOptions={[PAGE_SIZE]}
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
              />
            )}
          </>
        )}

        {!loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, pt: 1 }}>
            <Chip label={`Toplam: ${total}`} size="small" variant="outlined" />
          </Box>
        )}
      </Paper>

      {/* ——— Personel Ekle / Düzenle Dialog ——— */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId != null ? "Personel düzenle" : "Yeni personel"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {/* Photo upload */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>Fotoğraf</Typography>
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: "100%", height: 120, border: "2px dashed #ccc", borderRadius: 2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", bgcolor: "#fafafa", overflow: "hidden", position: "relative",
                  "&:hover": { borderColor: "var(--icsp-lacivert)" },
                }}
              >
                {form.foto_base64 ? (
                  <Box
                    component="img"
                    src={form.foto_base64}
                    alt="Önizleme"
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Box sx={{ textAlign: "center", color: "text.secondary" }}>
                    <AddPhotoAlternate sx={{ fontSize: 36, mb: 0.5 }} />
                    <Typography variant="caption" display="block">Fotoğraf ekle</Typography>
                  </Box>
                )}
              </Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhotoSelect}
              />
              {form.foto_base64 && (
                <Button size="small" color="error" onClick={() => setForm((f) => ({ ...f, foto_base64: "" }))} sx={{ mt: 0.5 }}>
                  Fotoğrafı kaldır
                </Button>
              )}
            </Box>

            <TextField label="Ad" value={form.ad} onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))} required fullWidth />
            <TextField label="Soyad" value={form.soyad} onChange={(e) => setForm((f) => ({ ...f, soyad: e.target.value }))} required fullWidth />
            <FormControl fullWidth required>
              <InputLabel>Görev Yeri (Şantiye)</InputLabel>
              <Select
                value={form.site_id}
                label="Görev Yeri (Şantiye)"
                onChange={(e) => setForm((f) => ({ ...f, site_id: e.target.value }))}
              >
                <MenuItem value="">Seçin</MenuItem>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Görev</InputLabel>
              <Select value={form.gorev} label="Görev" onChange={(e) => setForm((f) => ({ ...f, gorev: e.target.value }))}>
                {GOREVLER.map((g) => (
                  <MenuItem key={g} value={g}>{g}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="TC Kimlik (T.C. vatandaşı)" value={form.tc_kimlik} onChange={(e) => setForm((f) => ({ ...f, tc_kimlik: e.target.value }))} fullWidth />
            <TextField label="Pasaport No (yabancı uyruklu)" value={form.pasaport_no} onChange={(e) => setForm((f) => ({ ...f, pasaport_no: e.target.value }))} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Çalıştığı bölüm</InputLabel>
              <Select value={form.calistigi_bolum} label="Çalıştığı bölüm" onChange={(e) => setForm((f) => ({ ...f, calistigi_bolum: e.target.value }))}>
                <MenuItem value="">Seçin</MenuItem>
                {CALISTIGI_BOLUM_OPTIONS.map((b) => (
                  <MenuItem key={b} value={b}>{b}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="İşe giriş tarihi" type="date" value={form.ise_giris_tarihi} onChange={(e) => setForm((f) => ({ ...f, ise_giris_tarihi: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="İşten çıkış tarihi" type="date" value={form.isten_cikis_tarihi} onChange={(e) => setForm((f) => ({ ...f, isten_cikis_tarihi: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="Günlük yevmiye" type="number" value={form.gunluk_yevmiye} onChange={(e) => setForm((f) => ({ ...f, gunluk_yevmiye: e.target.value }))} fullWidth />
            <TextField label="Aylık maaş" type="number" value={form.aylik_maas} onChange={(e) => setForm((f) => ({ ...f, aylik_maas: e.target.value }))} fullWidth />
            <TextField label="Acil iletişim" value={form.acil_iletisim} onChange={(e) => setForm((f) => ({ ...f, acil_iletisim: e.target.value }))} fullWidth />
            <TextField label="Acil telefon" value={form.acil_telefon} onChange={(e) => setForm((f) => ({ ...f, acil_telefon: e.target.value }))} fullWidth />
            <TextField label="IBAN" value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))} fullWidth />
            <TextField label="Banka adı" value={form.banka_adi} onChange={(e) => setForm((f) => ({ ...f, banka_adi: e.target.value }))} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>İptal</Button>
          <Tooltip title={!form.site_id ? "Görev yeri (şantiye) seçimi zorunludur" : ""}>
            <span>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!form.ad.trim() || !form.soyad.trim() || !form.site_id}
                sx={{ background: "var(--icsp-lacivert)" }}
              >
                {editingId != null ? "Güncelle" : "Ekle"}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      {/* İzin Ekle Dialog */}
      <Dialog open={izinDialogOpen} onClose={() => setIzinDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>İzin Ekle — {izinPersonelAd}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>İzin Türü</InputLabel>
              <Select
                value={izinForm.izin_tipi} label="İzin Türü"
                onChange={(e) => setIzinForm((f) => ({ ...f, izin_tipi: e.target.value }))}
              >
                {IZIN_TIPLERI.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Başlangıç Tarihi" type="date" fullWidth
              value={izinForm.baslangic_tarihi}
              onChange={(e) => setIzinForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))}
              InputLabelProps={{ shrink: true }} required
            />
            <TextField
              label="Bitiş Tarihi" type="date" fullWidth
              value={izinForm.bitis_tarihi}
              onChange={(e) => setIzinForm((f) => ({ ...f, bitis_tarihi: e.target.value }))}
              InputLabelProps={{ shrink: true }} required
            />
            <TextField
              label="Not" multiline minRows={2} fullWidth
              value={izinForm.notlar}
              onChange={(e) => setIzinForm((f) => ({ ...f, notlar: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIzinDialogOpen(false)} disabled={izinSaving}>İptal</Button>
          <Button
            variant="contained" onClick={handleIzinSave}
            disabled={izinSaving || !izinForm.baslangic_tarihi || !izinForm.bitis_tarihi}
            sx={{ background: "var(--icsp-lacivert)" }}
          >
            {izinSaving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Silme onay dialogu */}
      <Dialog open={confirmDeleteId != null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Personel Sil</DialogTitle>
        <DialogContent>
          <Typography>Bu personel kaydı kalıcı olarak silinecek. Emin misiniz?</Typography>
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

