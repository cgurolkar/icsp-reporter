"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
  Alert,
  Chip,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
} from "@mui/material"
import { Add, FileUpload, CheckCircle, Download, Settings, Edit, Delete } from "@mui/icons-material"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"

interface SiteItem {
  id: number
  name: string
}

interface KalemItem {
  id: number
  kod: string
  ad: string
}

interface AltKalemItem {
  id: number
  kalem_id: number
  ad: string
  kalem_kod?: string
  kalem_ad?: string
}

interface MasrafItem {
  id: number
  ad: string
  tip: string
}

interface IslemRow {
  id: number
  site_id: number
  kategori_id: number
  kategori_adi: string
  kalem_id?: number | null
  kalem_kod?: string | null
  kalem_adi?: string | null
  alt_kalem_id?: number | null
  alt_kalem_adi?: string | null
  masraf_yeri_id?: number | null
  masraf_yeri_adi?: string | null
  masraf_yeri_tip?: string | null
  fis_fatura_no?: string | null
  tutar: number
  islem_tarihi: string
  odeme_kaynagi: string
  aciklama?: string | null
  para_birimi?: string | null
  tutar_usd?: number | string | null
  tutar_iqd?: number | string | null
}

interface PreviewRow {
  tarih: string
  kalemKod?: string
  altKalem?: string
  masrafYeri?: string
  fisFaturaNo?: string
  aciklama: string
  tutar: number
  parabirimi: string
  kategoriKod: string
  kategoriAdi: string
  matched?: boolean
  format?: string
}

type FormState = {
  id?: number
  siteId: string
  kalemId: string
  altKalemId: string
  masrafYeriId: string
  fisFaturaNo: string
  tutar: string
  para_birimi: "IQD" | "USD"
  islem_tarihi: string
  odeme_kaynagi: string
  aciklama: string
}

const emptyForm = (): FormState => ({
  siteId: "",
  kalemId: "",
  altKalemId: "",
  masrafYeriId: "",
  fisFaturaNo: "",
  tutar: "",
  para_birimi: "IQD",
  islem_tarihi: new Date().toISOString().slice(0, 10),
  odeme_kaynagi: "Santiye_Kasa",
  aciklama: "",
})

const KATEGORI_RENK: Record<string, string> = {
  yemek: "#e8f5e9",
  akaryakit: "#fff3e0",
  maas: "#e3f2fd",
  tason: "#f3e5f5",
  sarf: "#fce4ec",
  diger: "#f5f5f5",
}

export default function IdariHarcamalarPage() {
  const { user } = useAuth()
  const [sites, setSites] = useState<SiteItem[]>([])
  const [kalemler, setKalemler] = useState<KalemItem[]>([])
  const [altKalemler, setAltKalemler] = useState<AltKalemItem[]>([])
  const [masrafYerleri, setMasrafYerleri] = useState<MasrafItem[]>([])
  const [list, setList] = useState<IslemRow[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [filterKalemId, setFilterKalemId] = useState("")
  const [filterAltKalemId, setFilterAltKalemId] = useState("")
  const [eksikKalem, setEksikKalem] = useState(false)
  const [baslangic, setBaslangic] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [bitis, setBitis] = useState(() => new Date().toISOString().slice(0, 10))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // Excel import
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState(0)
  const [importSiteId, setImportSiteId] = useState<string>("")
  const [importParabirimi, setImportParabirimi] = useState<string>("USD")
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importPreview, setImportPreview] = useState<PreviewRow[]>([])
  const [importTotal, setImportTotal] = useState(0)
  const [importResult, setImportResult] = useState<{
    created: number
    failed: number
    totalParsed?: number
    matchedRows?: number
    unmatchedRows?: number
    errors?: string[]
  } | null>(null)
  const [importError, setImportError] = useState<string>("")
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "super_admin" || role === "admin" || role === "manager"

  useEffect(() => {
    fetch("/api/sites").then((r) => (r.ok ? r.json() : [])).then(setSites).catch(() => setSites([]))
    fetch("/api/idari/harcama-tanimlar")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setKalemler(d.kalemler || [])
        setAltKalemler(d.altKalemler || [])
        setMasrafYerleri(d.masrafYerleri || [])
      })
      .catch(() => {})
  }, [])

  const loadList = useCallback(() => {
    if (!siteId) {
      setList([])
      setSelected(new Set())
      return
    }
    const params = new URLSearchParams({ siteId })
    if (baslangic) params.set("baslangic", baslangic)
    if (bitis) params.set("bitis", bitis)
    if (filterKalemId && !eksikKalem) params.set("kalemId", filterKalemId)
    if (filterAltKalemId && !eksikKalem) params.set("altKalemId", filterAltKalemId)
    if (eksikKalem) params.set("eksikKalem", "1")
    fetch(`/api/idari/islemler?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: IslemRow[]) => {
        setList(rows)
        setSelected(new Set())
      })
      .catch(() => setList([]))
  }, [siteId, baslangic, bitis, filterKalemId, filterAltKalemId, eksikKalem])

  useEffect(() => {
    loadList()
  }, [loadList])

  const filterAltOptions = filterKalemId
    ? altKalemler.filter((a) => String(a.kalem_id) === filterKalemId)
    : altKalemler

  const formAltOptions = form.kalemId
    ? altKalemler.filter((a) => String(a.kalem_id) === form.kalemId)
    : altKalemler

  const openCreate = () => {
    setForm({ ...emptyForm(), siteId: siteId || "" })
    setDialogOpen(true)
  }

  const openEdit = (row: IslemRow) => {
    setForm({
      id: row.id,
      siteId: String(row.site_id),
      kalemId: row.kalem_id != null ? String(row.kalem_id) : "",
      altKalemId: row.alt_kalem_id != null ? String(row.alt_kalem_id) : "",
      masrafYeriId: row.masraf_yeri_id != null ? String(row.masraf_yeri_id) : "",
      fisFaturaNo: row.fis_fatura_no || "",
      tutar: String(row.tutar ?? ""),
      para_birimi: row.para_birimi === "USD" ? "USD" : "IQD",
      islem_tarihi: String(row.islem_tarihi).slice(0, 10),
      odeme_kaynagi: row.odeme_kaynagi || "Santiye_Kasa",
      aciklama: row.aciklama || "",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const sid = parseInt(form.siteId, 10)
    const altId = parseInt(form.altKalemId, 10)
    const masrafId = form.masrafYeriId ? parseInt(form.masrafYeriId, 10) : null
    const tutar = parseFloat(form.tutar)
    if (!sid || !altId || Number.isNaN(tutar) || !form.islem_tarihi) {
      alert("Şantiye, alt kalem, tutar ve tarih gerekli.")
      return
    }
    setSaving(true)
    const payload = {
      siteId: sid,
      altKalemId: altId,
      masrafYeriId: masrafId && !Number.isNaN(masrafId) ? masrafId : null,
      fisFaturaNo: form.fisFaturaNo.trim() || null,
      tutar,
      para_birimi: form.para_birimi,
      islem_tarihi: form.islem_tarihi.slice(0, 10),
      odeme_kaynagi: form.odeme_kaynagi === "rapor" ? "rapor" : form.odeme_kaynagi,
      aciklama: form.aciklama || undefined,
    }
    const res = form.id
      ? await fetch(`/api/idari/islemler/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/idari/islemler", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
    setSaving(false)
    if (res.ok) {
      setDialogOpen(false)
      setForm(emptyForm())
      loadList()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Kaydedilemedi.")
    }
  }

  const handleDeleteOne = async (id: number) => {
    if (!confirm("Bu harcama kaydı silinsin mi?")) return
    setDeleting(true)
    const res = await fetch(`/api/idari/islemler/${id}`, { method: "DELETE" })
    setDeleting(false)
    if (res.ok) loadList()
    else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Silinemedi.")
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selected)
    if (!ids.length) return
    if (!confirm(`${ids.length} kayıt silinecek. Emin misiniz?`)) return
    setDeleting(true)
    const res = await fetch("/api/idari/islemler/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    setDeleting(false)
    if (res.ok) loadList()
    else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Toplu silme başarısız.")
    }
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === list.length) setSelected(new Set())
    else setSelected(new Set(list.map((r) => r.id)))
  }

  const openImport = () => {
    setImportOpen(true)
    setImportStep(0)
    setImportFile(null)
    setImportPreview([])
    setImportTotal(0)
    setImportResult(null)
    setImportError("")
    setImportWarnings([])
    setImportSiteId(siteId || "")
  }

  const closeImport = () => {
    setImportOpen(false)
    if (importResult && importResult.created > 0) loadList()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportFile(e.target.files?.[0] ?? null)
    setImportError("")
  }

  const handlePreview = async () => {
    if (!importFile || !importSiteId) {
      setImportError("Dosya ve şantiye seçimi zorunludur.")
      return
    }
    setImportLoading(true)
    setImportError("")
    try {
      const fd = new FormData()
      fd.append("file", importFile)
      fd.append("siteId", importSiteId)
      fd.append("parabirimi", importParabirimi)
      fd.append("previewOnly", "true")
      const res = await fetch("/api/idari/islemler/import", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Dosya okunamadı.")
      setImportPreview(data.preview || [])
      setImportTotal(data.totalRows || 0)
      setImportWarnings(Array.isArray(data.errors) ? data.errors : [])
      setImportStep(1)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Hata oluştu.")
    } finally {
      setImportLoading(false)
    }
  }

  const handleDoImport = async () => {
    if (!importFile || !importSiteId) return
    setImportLoading(true)
    setImportError("")
    try {
      const fd = new FormData()
      fd.append("file", importFile)
      fd.append("siteId", importSiteId)
      fd.append("parabirimi", importParabirimi)
      fd.append("previewOnly", "false")
      const res = await fetch("/api/idari/islemler/import", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Import başarısız.")
      setImportResult({
        created: data.created,
        failed: data.failed,
        totalParsed: data.totalParsed,
        matchedRows: data.matchedRows,
        unmatchedRows: data.unmatchedRows,
        errors: data.errors,
      })
      setImportStep(2)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Hata oluştu.")
    } finally {
      setImportLoading(false)
    }
  }

  const siteName = (id: string) => sites.find((s) => String(s.id) === id)?.name ?? ""
  const listSumUsd = list.reduce((s, r) => s + (r.tutar_usd != null ? Number(r.tutar_usd) : 0), 0)
  const listSumIqd = list.reduce((s, r) => s + (r.tutar_iqd != null ? Number(r.tutar_iqd) : Number(r.tutar)), 0)
  const eksikCount = list.filter((r) => !r.alt_kalem_id).length

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600 }}>
          Harcamalar
        </Typography>
        <Button component={Link} href="/idari/harcama-tanimlar" size="small" startIcon={<Settings />} sx={{ color: "var(--icsp-lacivert)" }}>
          Kalem / masraf yeri tanımları
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
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
          <FormControl size="small" sx={{ minWidth: 180 }} disabled={eksikKalem}>
            <InputLabel>Ana kalem</InputLabel>
            <Select
              value={filterKalemId}
              label="Ana kalem"
              onChange={(e) => {
                setFilterKalemId(e.target.value)
                setFilterAltKalemId("")
              }}
            >
              <MenuItem value="">Tümü</MenuItem>
              {kalemler.map((k) => (
                <MenuItem key={k.id} value={String(k.id)}>{k.kod} — {k.ad}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }} disabled={eksikKalem}>
            <InputLabel>Alt kalem</InputLabel>
            <Select value={filterAltKalemId} label="Alt kalem" onChange={(e) => setFilterAltKalemId(e.target.value)}>
              <MenuItem value="">Tümü</MenuItem>
              {filterAltOptions.map((a) => (
                <MenuItem key={a.id} value={String(a.id)}>{a.ad}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={eksikKalem}
                onChange={(e) => {
                  setEksikKalem(e.target.checked)
                  if (e.target.checked) {
                    setFilterKalemId("")
                    setFilterAltKalemId("")
                  }
                }}
              />
            }
            label="Sadece eksik kalem"
          />
          {canManage && (
            <Box sx={{ display: "flex", gap: 1, ml: "auto", flexWrap: "wrap" }}>
              {selected.size > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={handleBulkDelete}
                  disabled={deleting}
                >
                  Seçilenleri sil ({selected.size})
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<Download />}
                href="/api/idari/islemler/template"
                download="harcama_sablonu.xlsx"
                sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}
              >
                Şablon indir
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileUpload />}
                onClick={openImport}
                sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}
              >
                Excel&apos;den aktar
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={openCreate} sx={{ background: "var(--icsp-lacivert)" }}>
                Yeni harcama
              </Button>
            </Box>
          )}
        </Box>

        {siteId && eksikCount > 0 && !eksikKalem && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Bu listede {eksikCount} kaydın alt kalemi yok. Eski kayıtları tamamlamak için &quot;Sadece eksik kalem&quot; filtresini kullanın.
          </Alert>
        )}

        {!siteId ? (
          <Typography color="text.secondary">Şantiye seçin.</Typography>
        ) : list.length === 0 ? (
          <Typography color="text.secondary">Kayıt yok.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {canManage && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={list.length > 0 && selected.size === list.length}
                        indeterminate={selected.size > 0 && selected.size < list.length}
                        onChange={toggleSelectAll}
                      />
                    </TableCell>
                  )}
                  <TableCell><strong>Tarih</strong></TableCell>
                  <TableCell><strong>Kalem</strong></TableCell>
                  <TableCell><strong>Alt kalem</strong></TableCell>
                  <TableCell><strong>Masraf yeri</strong></TableCell>
                  <TableCell><strong>Fiş/Fatura</strong></TableCell>
                  <TableCell align="center"><strong>PB</strong></TableCell>
                  <TableCell align="right"><strong>Tutar</strong></TableCell>
                  <TableCell align="right"><strong>USD</strong></TableCell>
                  <TableCell align="right"><strong>IQD</strong></TableCell>
                  <TableCell><strong>Ödeme</strong></TableCell>
                  <TableCell><strong>Açıklama</strong></TableCell>
                  {canManage && <TableCell align="right"><strong>İşlem</strong></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((row) => {
                  const missing = !row.alt_kalem_id
                  return (
                    <TableRow key={row.id} sx={{ backgroundColor: missing ? "#fff8e1" : undefined }}>
                      {canManage && (
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} />
                        </TableCell>
                      )}
                      <TableCell>{String(row.islem_tarihi).slice(0, 10)}</TableCell>
                      <TableCell>
                        {row.kalem_kod
                          ? `${row.kalem_kod} ${row.kalem_adi || ""}`
                          : (
                            <Chip size="small" label={row.kategori_adi || "Eksik"} color="warning" variant="outlined" />
                          )}
                      </TableCell>
                      <TableCell>{row.alt_kalem_adi || "—"}</TableCell>
                      <TableCell>
                        {row.masraf_yeri_adi
                          ? `${row.masraf_yeri_adi}${row.masraf_yeri_tip ? ` (${row.masraf_yeri_tip})` : ""}`
                          : "—"}
                      </TableCell>
                      <TableCell>{row.fis_fatura_no || "—"}</TableCell>
                      <TableCell align="center">{row.para_birimi === "USD" ? "USD" : "IQD"}</TableCell>
                      <TableCell align="right">{Number(row.tutar).toLocaleString("tr-TR")}</TableCell>
                      <TableCell align="right">{row.tutar_usd != null ? Number(row.tutar_usd).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—"}</TableCell>
                      <TableCell align="right">{row.tutar_iqd != null ? Number(row.tutar_iqd).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) : "—"}</TableCell>
                      <TableCell>
                        {row.odeme_kaynagi === "Merkez_Banka" ? "Merkez" : row.odeme_kaynagi === "rapor" ? "Günlük Rapor" : "Şantiye Kasası"}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.aciklama ?? "—"}
                      </TableCell>
                      {canManage && (
                        <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                          <Tooltip title="Düzenle">
                            <IconButton size="small" onClick={() => openEdit(row)} color="primary">
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Sil">
                            <IconButton size="small" onClick={() => handleDeleteOne(row.id)} color="error" disabled={deleting}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell colSpan={canManage ? 8 : 7}><strong>Toplam (USD / IQD)</strong></TableCell>
                  <TableCell align="right"><strong>{listSumUsd.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</strong></TableCell>
                  <TableCell align="right"><strong>{listSumIqd.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</strong></TableCell>
                  <TableCell colSpan={canManage ? 3 : 2} />
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{form.id ? "Harcama düzenle" : "Yeni harcama"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {form.odeme_kaynagi === "rapor" && (
              <Alert severity="info" sx={{ fontSize: 13 }}>
                Bu kayıt günlük rapordan geldi. Alt kalem / masraf yeri düzenlenebilir; rapor yeniden gönderilirse satır yeniden yazılabilir.
              </Alert>
            )}
            <FormControl fullWidth required>
              <InputLabel>Şantiye</InputLabel>
              <Select value={form.siteId} label="Şantiye" onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Ana kalem</InputLabel>
              <Select
                value={form.kalemId}
                label="Ana kalem"
                onChange={(e) => setForm((f) => ({ ...f, kalemId: e.target.value, altKalemId: "" }))}
              >
                {kalemler.map((k) => (
                  <MenuItem key={k.id} value={String(k.id)}>{k.kod} — {k.ad}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>Alt kalem</InputLabel>
              <Select value={form.altKalemId} label="Alt kalem" onChange={(e) => setForm((f) => ({ ...f, altKalemId: e.target.value }))}>
                {formAltOptions.map((a) => (
                  <MenuItem key={a.id} value={String(a.id)}>{a.ad}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Masraf yeri</InputLabel>
              <Select value={form.masrafYeriId} label="Masraf yeri" onChange={(e) => setForm((f) => ({ ...f, masrafYeriId: e.target.value }))}>
                <MenuItem value="">—</MenuItem>
                {masrafYerleri.map((m) => (
                  <MenuItem key={m.id} value={String(m.id)}>{m.ad} ({m.tip})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Fiş / Fatura No"
              value={form.fisFaturaNo}
              onChange={(e) => setForm((f) => ({ ...f, fisFaturaNo: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Para birimi</InputLabel>
              <Select value={form.para_birimi} label="Para birimi" onChange={(e) => setForm((f) => ({ ...f, para_birimi: e.target.value as "IQD" | "USD" }))}>
                <MenuItem value="IQD">IQD</MenuItem>
                <MenuItem value="USD">USD</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={form.para_birimi === "USD" ? "Tutar (USD)" : "Tutar (IQD)"}
              type="number"
              value={form.tutar}
              onChange={(e) => setForm((f) => ({ ...f, tutar: e.target.value }))}
              required
              fullWidth
              inputProps={{ step: 0.01 }}
            />
            <TextField
              label="Tarih"
              type="date"
              value={form.islem_tarihi}
              onChange={(e) => setForm((f) => ({ ...f, islem_tarihi: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth>
              <InputLabel>Ödeme kaynağı</InputLabel>
              <Select
                value={form.odeme_kaynagi === "rapor" ? "rapor" : form.odeme_kaynagi}
                label="Ödeme kaynağı"
                onChange={(e) => setForm((f) => ({ ...f, odeme_kaynagi: e.target.value }))}
                disabled={form.odeme_kaynagi === "rapor"}
              >
                <MenuItem value="Santiye_Kasa">Şantiye Kasası</MenuItem>
                <MenuItem value="Merkez_Banka">Merkez Banka</MenuItem>
                {form.odeme_kaynagi === "rapor" && <MenuItem value="rapor">Günlük Rapor</MenuItem>}
              </Select>
            </FormControl>
            <TextField label="Açıklama" multiline value={form.aciklama} onChange={(e) => setForm((f) => ({ ...f, aciklama: e.target.value }))} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.siteId || !form.altKalemId || !form.tutar}
            sx={{ background: "var(--icsp-lacivert)" }}
          >
            {saving ? "Kaydediliyor..." : form.id ? "Güncelle" : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importOpen} onClose={closeImport} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FileUpload sx={{ color: "var(--icsp-lacivert)" }} />
            Excel&apos;den Harcama Aktarımı
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={importStep} sx={{ mb: 3 }}>
            <Step><StepLabel>Dosya & Ayarlar</StepLabel></Step>
            <Step><StepLabel>Önizleme</StepLabel></Step>
            <Step><StepLabel>Tamamlandı</StepLabel></Step>
          </Stepper>
          {importLoading && <LinearProgress sx={{ mb: 2 }} />}
          {importError && <Alert severity="error" sx={{ mb: 2 }}>{importError}</Alert>}
          {importStep === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="info" sx={{ fontSize: 13 }}>
                <strong>Yeni şablon:</strong> Tarih, Kalem Kodu, Alt Kalem, Masraf Yeri, Fiş/Fatura No, Açıklama, Tutar, Para Birimi, Ödeme Kaynağı.
                Şablonda <em>Ana Kalemler / Alt Kalemler / Masraf Yerleri</em> sayfaları referans içindir —{" "}
                <Button
                  component="a"
                  href="/api/idari/islemler/template"
                  download="harcama_sablonu.xlsx"
                  size="small"
                  sx={{ p: 0, minWidth: 0, verticalAlign: "baseline", textTransform: "none" }}
                >
                  buradan indirin
                </Button>
                . Eski GENEL KASA dosyaları da okunur; alt kalem eşleşmezse manuel düzenleme gerekir.
              </Alert>
              <FormControl fullWidth required>
                <InputLabel>Şantiye</InputLabel>
                <Select value={importSiteId} label="Şantiye" onChange={(e) => setImportSiteId(e.target.value)}>
                  {sites.map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Eski format para birimi önceliği</InputLabel>
                <Select value={importParabirimi} label="Eski format para birimi önceliği" onChange={(e) => setImportParabirimi(e.target.value)}>
                  <MenuItem value="USD">USD (önce USD, yoksa IQD)</MenuItem>
                  <MenuItem value="IQD">IQD (önce IQD, yoksa USD)</MenuItem>
                </Select>
              </FormControl>
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>Excel dosyası (.xlsx)</Typography>
                <input type="file" accept=".xlsx,.xls" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Button variant="outlined" onClick={() => fileInputRef.current?.click()} sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}>
                    Dosya Seç
                  </Button>
                  {importFile && (
                    <Typography variant="body2" sx={{ color: "success.main" }}>
                      ✓ {importFile.name} ({(importFile.size / 1024).toFixed(0)} KB)
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          )}
          {importStep === 1 && (
            <Box>
              <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
                <Chip label={`${importTotal} satır okundu`} color="primary" variant="outlined" />
                <Chip
                  label={`${importPreview.filter((r) => r.matched).length} alt kalem eşleşti`}
                  color="success"
                  variant="outlined"
                />
                {importPreview.some((r) => !r.matched) && (
                  <Chip
                    label={`${importPreview.filter((r) => !r.matched).length} eşleşmedi (yine de aktarılır)`}
                    color="warning"
                    variant="outlined"
                  />
                )}
                <Typography variant="body2" color="text.secondary">
                  Şantiye: <strong>{siteName(importSiteId)}</strong> · {importParabirimi}
                </Typography>
              </Box>
              {importWarnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2, fontSize: 12, maxHeight: 120, overflow: "auto" }}>
                  {importWarnings.slice(0, 15).map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                  {importWarnings.length > 15 && <div>… +{importWarnings.length - 15} uyarı</div>}
                </Alert>
              )}
              <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
                Dosyada daha fazla satır görünüyorsa ama burada azsa: boş Alt Kalem, geçersiz Tarih veya Tutar=0 olan satırlar okunmaz.
                Aktarımda eşleşmeyen satırlar da eklenir; sonra listeden düzenleyebilirsiniz.
              </Alert>
              <Box sx={{ overflowX: "auto", maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Tarih</TableCell>
                      <TableCell>Kalem</TableCell>
                      <TableCell>Alt kalem</TableCell>
                      <TableCell>Masraf yeri</TableCell>
                      <TableCell>Fiş/Fatura</TableCell>
                      <TableCell>Açıklama</TableCell>
                      <TableCell align="right">Tutar</TableCell>
                      <TableCell>PB</TableCell>
                      <TableCell>Eşleşme</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow
                        key={i}
                        sx={{ backgroundColor: row.matched === false ? "#fff8e1" : KATEGORI_RENK[row.kategoriKod] ?? "#fff" }}
                      >
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{row.tarih}</TableCell>
                        <TableCell>{row.kalemKod || "—"}</TableCell>
                        <TableCell>{row.altKalem || "—"}</TableCell>
                        <TableCell>{row.masrafYeri || "—"}</TableCell>
                        <TableCell>{row.fisFaturaNo || "—"}</TableCell>
                        <TableCell sx={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.aciklama}
                        </TableCell>
                        <TableCell align="right">{row.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{row.parabirimi}</TableCell>
                        <TableCell>
                          <Chip
                            label={row.matched ? "OK" : "Eksik"}
                            size="small"
                            color={row.matched ? "success" : "warning"}
                            sx={{ fontSize: 11 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Divider sx={{ mt: 2, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Toplam: <strong>{importPreview.reduce((s, r) => s + r.tutar, 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}</strong>
              </Typography>
            </Box>
          )}
          {importStep === 2 && importResult && (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <CheckCircle sx={{ fontSize: 56, color: "success.main", mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>Aktarım tamamlandı</Typography>
              <Box sx={{ display: "flex", justifyContent: "center", gap: 1, flexWrap: "wrap", mb: 2 }}>
                <Chip label={`${importResult.created} kayıt eklendi`} color="success" />
                {importResult.totalParsed != null && (
                  <Chip label={`${importResult.totalParsed} satır işlendi`} variant="outlined" />
                )}
                {importResult.unmatchedRows != null && importResult.unmatchedRows > 0 && (
                  <Chip label={`${importResult.unmatchedRows} alt kalem eşleşmedi`} color="warning" />
                )}
                {importResult.failed > 0 && <Chip label={`${importResult.failed} hata`} color="error" />}
              </Box>
              {importResult.errors && importResult.errors.length > 0 && (
                <Alert severity="warning" sx={{ textAlign: "left", fontSize: 12, maxHeight: 160, overflow: "auto" }}>
                  {importResult.errors.slice(0, 20).map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeImport}>{importStep === 2 ? "Kapat" : "İptal"}</Button>
          {importStep === 0 && (
            <Button variant="contained" onClick={handlePreview} disabled={importLoading || !importFile || !importSiteId} sx={{ background: "var(--icsp-lacivert)" }}>
              Önizle
            </Button>
          )}
          {importStep === 1 && (
            <>
              <Button onClick={() => setImportStep(0)} disabled={importLoading}>Geri</Button>
              <Button variant="contained" onClick={handleDoImport} disabled={importLoading || importTotal === 0} sx={{ background: "var(--icsp-lacivert)" }}>
                {importLoading ? "Aktarılıyor..." : `${importTotal} kaydı aktar`}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
