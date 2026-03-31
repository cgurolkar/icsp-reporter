"use client"

import { useState, useEffect, useRef } from "react"
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
} from "@mui/material"
import { Add, FileUpload, CheckCircle } from "@mui/icons-material"
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

interface PreviewRow {
  tarih: string
  ch: string
  fatNo: string
  aciklama: string
  detay: string
  tutar: number
  parabirimi: string
  kategoriKod: string
  kategoriAdi: string
}

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

  // Excel import state
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState(0) // 0=ayarlar, 1=önizleme, 2=sonuç
  const [importSiteId, setImportSiteId] = useState<string>("")
  const [importParabirimi, setImportParabirimi] = useState<string>("USD")
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importPreview, setImportPreview] = useState<PreviewRow[]>([])
  const [importTotal, setImportTotal] = useState(0)
  const [importResult, setImportResult] = useState<{ created: number; failed: number } | null>(null)
  const [importError, setImportError] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "super_admin" || role === "admin" || role === "manager"

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

  // --- Import handlers ---
  const openImport = () => {
    setImportOpen(true)
    setImportStep(0)
    setImportFile(null)
    setImportPreview([])
    setImportTotal(0)
    setImportResult(null)
    setImportError("")
    setImportSiteId(siteId || "")
  }

  const closeImport = () => {
    setImportOpen(false)
    if (importResult && importResult.created > 0) loadList()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setImportFile(f)
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
      setImportResult({ created: data.created, failed: data.failed })
      setImportStep(2)
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Hata oluştu.")
    } finally {
      setImportLoading(false)
    }
  }

  const siteName = (id: string) => sites.find((s) => String(s.id) === id)?.name ?? ""

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
            <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
              <Button
                variant="outlined"
                startIcon={<FileUpload />}
                onClick={openImport}
                sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}
              >
                Excel'den aktar
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} sx={{ background: "var(--icsp-lacivert)" }}>
                Yeni harcama
              </Button>
            </Box>
          )}
        </Box>

        {!siteId ? (
          <Typography color="text.secondary">Şantiye seçin.</Typography>
        ) : list.length === 0 ? (
          <Typography color="text.secondary">Kayıt yok.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
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
                    <TableCell>
                      {row.odeme_kaynagi === "Merkez_Banka" ? "Merkez" : row.odeme_kaynagi === "rapor" ? "Günlük Rapor" : "Şantiye Kasası"}
                    </TableCell>
                    <TableCell>{row.aciklama ?? "—"}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell colSpan={2}><strong>Toplam</strong></TableCell>
                  <TableCell align="right"><strong>{list.reduce((s, r) => s + Number(r.tutar), 0).toLocaleString("tr-TR")}</strong></TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      {/* Yeni harcama diyaloğu */}
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

      {/* Excel import diyaloğu */}
      <Dialog open={importOpen} onClose={closeImport} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FileUpload sx={{ color: "var(--icsp-lacivert)" }} />
            Excel'den Harcama Aktarımı
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

          {/* Adım 0: Ayarlar */}
          {importStep === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Alert severity="info" sx={{ fontSize: 13 }}>
                <strong>Desteklenen format:</strong> "GENEL KASA RAPORU" şemasındaki Excel dosyası (.xlsx).
                Yalnızca <strong>Tediyeler</strong> (gider) satırları aktarılır, Tahsilatlar (gelir) aktarılmaz.
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
                <InputLabel>Para birimi önceliği</InputLabel>
                <Select value={importParabirimi} label="Para birimi önceliği" onChange={(e) => setImportParabirimi(e.target.value)}>
                  <MenuItem value="USD">USD (önce USD, yoksa IQD)</MenuItem>
                  <MenuItem value="IQD">IQD (önce IQD, yoksa USD)</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>Excel dosyası (.xlsx)</Typography>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Button variant="outlined" onClick={() => fileInputRef.current?.click()} sx={{ borderColor: "var(--icsp-lacivert)", color: "var(--icsp-lacivert)" }}>
                    Dosya Seç
                  </Button>
                  {importFile && (
                    <Typography variant="body2" sx={{ color: "success.main" }}>
                      âœ“ {importFile.name} ({(importFile.size / 1024).toFixed(0)} KB)
                    </Typography>
                  )}
                </Box>
              </Box>

              <Alert severity="warning" sx={{ fontSize: 12 }}>
                Kategori eşlemesi otomatik yapılır: Yemek, Akaryakıt (Mazot/Benzin/yakıt sütunları),
                Maaş (personel/yevmiye), Taşeron (makine/ekipman), Sarf Malzeme, Diğer.
                Aktarım sonrası kategorileri manuel düzenleyebilirsiniz.
              </Alert>
            </Box>
          )}

          {/* Adım 1: Önizleme */}
          {importStep === 1 && (
            <Box>
              <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
                <Chip label={`${importTotal} satır bulundu`} color="primary" variant="outlined" />
                <Chip label={`İlk 100 gösteriliyor`} variant="outlined" sx={{ display: importTotal > 100 ? undefined : "none" }} />
                <Typography variant="body2" color="text.secondary">
                  Şantiye: <strong>{siteName(importSiteId)}</strong> Â· Para birimi: <strong>{importParabirimi}</strong>
                </Typography>
              </Box>
              <Box sx={{ overflowX: "auto", maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Tarih</TableCell>
                      <TableCell>Açıklama</TableCell>
                      <TableCell>Detay</TableCell>
                      <TableCell align="right">Tutar</TableCell>
                      <TableCell>Birim</TableCell>
                      <TableCell>Kategori</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i} sx={{ backgroundColor: KATEGORI_RENK[row.kategoriKod] ?? "#fff" }}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{row.tarih}</TableCell>
                        <TableCell>{row.aciklama}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.detay}
                        </TableCell>
                        <TableCell align="right">{row.tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell>{row.parabirimi}</TableCell>
                        <TableCell>
                          <Chip label={row.kategoriAdi} size="small" sx={{ backgroundColor: KATEGORI_RENK[row.kategoriKod], fontSize: 11 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Divider sx={{ mt: 2, mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Toplam: <strong>
                  {importPreview.reduce((s, r) => s + r.tutar, 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                </strong> (gösterilen {importPreview.length} satır)
              </Typography>
            </Box>
          )}

          {/* Adım 2: Sonuç */}
          {importStep === 2 && importResult && (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <CheckCircle sx={{ fontSize: 56, color: "success.main", mb: 2 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>Aktarım tamamlandı</Typography>
              <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2 }}>
                <Chip label={`${importResult.created} kayıt eklendi`} color="success" />
                {importResult.failed > 0 && <Chip label={`${importResult.failed} hata`} color="error" />}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Şantiye: <strong>{siteName(importSiteId)}</strong>
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={closeImport}>
            {importStep === 2 ? "Kapat" : "İptal"}
          </Button>
          {importStep === 0 && (
            <Button
              variant="contained"
              onClick={handlePreview}
              disabled={importLoading || !importFile || !importSiteId}
              sx={{ background: "var(--icsp-lacivert)" }}
            >
              Önizle
            </Button>
          )}
          {importStep === 1 && (
            <>
              <Button onClick={() => setImportStep(0)} disabled={importLoading}>Geri</Button>
              <Button
                variant="contained"
                onClick={handleDoImport}
                disabled={importLoading || importTotal === 0}
                sx={{ background: "var(--icsp-lacivert)" }}
              >
                {importLoading ? "Aktarılıyor..." : `${importTotal} kaydı aktar`}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}

