"use client"

import { useState, useEffect } from "react"
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
} from "@mui/material"
import { Add, Edit, Visibility, Download, Upload, Delete } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

const GOREVLER = ["İşçi", "Kalfa", "Usta", "Mühendis", "Operatör", "Proje Müdürü", "Şantiye Şefi"]

interface SiteItem {
  id: number
  name: string
  code: string
}

const CALISTIGI_BOLUM_OPTIONS = ["Şantiye", "Merkez Ofis", "Depo", "Diğer"]

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
  })

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "admin" || role === "manager"

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
    params.set("limit", String(PAGE_SIZE))
    params.set("offset", String(p * PAGE_SIZE))
    fetch(`/api/idari/personel?${params}`)
      .then((r) => (r.ok ? r.json() : { data: [], total: 0 }))
      .then((res: { data: PersonelRow[]; total: number } | PersonelRow[]) => {
        // Backward compat: eski format düz array olabilir
        if (Array.isArray(res)) { setList(res); setTotal(res.length) }
        else { setList(res.data ?? []); setTotal(res.total ?? 0) }
      })
      .catch(() => { setList([]); setTotal(0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadSites() }, [])
  useEffect(() => { setPage(0); loadList(0) }, [siteId, gorev, search])
  useEffect(() => { loadList(page) }, [page])

  const openAdd = () => {
    setEditingId(null)
    setForm({
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
    })
    setDialogOpen(true)
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
    if (editingId != null) {
      const res = await fetch(`/api/idari/personel/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      })
      if (res.ok) {
        setDialogOpen(false)
        loadList()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Güncellenemedi.")
      }
    } else {
      const res = await fetch("/api/idari/personel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
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
        Personel
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <TextField
            size="small"
            label="Ara"
            placeholder="Ad, soyad veya görev..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
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
        ) : (
          <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <Table size="small" sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell><strong>Ad Soyad</strong></TableCell>
                <TableCell><strong>Görev</strong></TableCell>
                <TableCell><strong>TC / Pasaport</strong></TableCell>
            <TableCell><strong>Çalıştığı bölüm</strong></TableCell>
                <TableCell><strong>İşe giriş / çıkış</strong></TableCell>
                <TableCell align="right"><strong>Günlük / Aylık</strong></TableCell>
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
                    <TableCell>{row.ad} {row.soyad}</TableCell>
                    <TableCell>{row.gorev}</TableCell>
                    <TableCell>{row.tc_kimlik ? `TC: ${row.tc_kimlik}` : row.pasaport_no ? `Pasaport: ${row.pasaport_no}` : "—"}</TableCell>
                    <TableCell>{row.calistigi_bolum ?? "—"}</TableCell>
                    <TableCell>{row.ise_giris_tarihi ? String(row.ise_giris_tarihi).slice(0, 10) : "—"}{row.isten_cikis_tarihi ? ` → ${String(row.isten_cikis_tarihi).slice(0, 10)}` : ""}</TableCell>
                    <TableCell align="right">
                      {row.gunluk_yevmiye != null ? row.gunluk_yevmiye : row.aylik_maas != null ? row.aylik_maas : "—"}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" component={Link} href={`/idari/personel/${row.id}`} title="Detay">
                        <Visibility fontSize="small" />
                      </IconButton>
                      {canManage && (
                        <>
                          <IconButton size="small" onClick={() => openEdit(row)} title="Düzenle">
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => setConfirmDeleteId(row.id)} title="Sil" sx={{ color: "error.main" }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {total > PAGE_SIZE && (
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
              labelDisplayedRows={({ from, to, count }) => `${from}–${to} / ${count}`}
            />
          )}
          </Box>
        )}
        {!loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, pb: 1 }}>
            <Chip label={`Toplam: ${total}`} size="small" variant="outlined" />
          </Box>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId != null ? "Personel düzenle" : "Yeni personel"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField label="Ad" value={form.ad} onChange={(e) => setForm((f) => ({ ...f, ad: e.target.value }))} required fullWidth />
            <TextField label="Soyad" value={form.soyad} onChange={(e) => setForm((f) => ({ ...f, soyad: e.target.value }))} required fullWidth />
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
          <Button variant="contained" onClick={handleSave} disabled={!form.ad.trim() || !form.soyad.trim()} sx={{ background: "var(--icsp-lacivert)" }}>
            {editingId != null ? "Güncelle" : "Ekle"}
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
