"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
} from "@mui/material"
import { ArrowBack, Add, Person, Edit, Delete } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"
import { useTheme, useMediaQuery } from "@mui/material"

interface PersonelDetail {
  id: number
  ad: string
  soyad: string
  gorev: string
  tc_kimlik?: string | null
  pasaport_no?: string | null
  foto_yolu?: string | null
  calistigi_bolum?: string | null
  dogum_tarihi?: string | null
  kan_grubu?: string | null
  acil_iletisim?: string | null
  acil_telefon?: string | null
  ise_giris_tarihi?: string | null
  isten_cikis_tarihi?: string | null
  sigorta_durumu?: string | null
  iban?: string | null
  banka_adi?: string | null
  gunluk_yevmiye?: number | null
  aylik_maas?: number | null
  atamalar: { id: number; site_id: number; site_name: string; baslangic_tarihi: string; bitis_tarihi?: string | null }[]
}

interface BelgeRow {
  id: number
  belge_tipi: string
  dosya_yolu: string
  gecerlilik_tarihi?: string | null
  yukleme_tarihi?: string
}

interface SiteItem {
  id: number
  name: string
}

interface FinansOzetRow {
  ay: string
  ay_baslangic: string
  toplam_carpan: number
  yevmiye_hak_edis: number
  aylik_maas_goster: number | null
}

interface FinansOzetResp {
  stats_since: string
  gunluk_yevmiye: number | null
  aylik_maas: number | null
  aylar: FinansOzetRow[]
}

function personelFotoSrc(personelId: number, foto_yolu: string | null | undefined): string | undefined {
  if (!foto_yolu) return undefined
  const t = foto_yolu.trim()
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("data:")) return t
  return `/api/idari/personel/${personelId}/foto`
}

export default function IdariPersonelDetailPage() {
  const params = useParams()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
  const { user } = useAuth()
  const id = typeof params?.id === "string" ? parseInt(params.id, 10) : NaN
  const [personel, setPersonel] = useState<PersonelDetail | null>(null)
  const [sites, setSites] = useState<SiteItem[]>([])
  const [belgeler, setBelgeler] = useState<BelgeRow[]>([])
  const [belgeTipleri, setBelgeTipleri] = useState<{ id: number; kod: string; ad: string }[]>([])
  const [atamaDialogOpen, setAtamaDialogOpen] = useState(false)
  const [editingAtamaId, setEditingAtamaId] = useState<number | null>(null)
  const [atamaForm, setAtamaForm] = useState({ site_id: "", baslangic_tarihi: "", bitis_tarihi: "" })
  const [finansOzet, setFinansOzet] = useState<FinansOzetResp | null>(null)
  const [belgeDialogOpen, setBelgeDialogOpen] = useState(false)
  const [belgeForm, setBelgeForm] = useState({ belge_tipi: "", gecerlilik_tarihi: "" })
  const [belgeSaving, setBelgeSaving] = useState(false)

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "super_admin" || role === "admin" || role === "manager"

  useEffect(() => {
    if (Number.isNaN(id)) return
    fetch(`/api/idari/personel/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PersonelDetail | null) => setPersonel(data))
      .catch(() => setPersonel(null))
  }, [id])

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SiteItem[]) => setSites(data))
      .catch(() => setSites([]))
  }, [])

  useEffect(() => {
    if (Number.isNaN(id)) return
    fetch(`/api/idari/personel/${id}/belgeler`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BelgeRow[]) => setBelgeler(data))
      .catch(() => setBelgeler([]))
  }, [id])

  useEffect(() => {
    if (Number.isNaN(id)) return
    fetch(`/api/idari/personel/${id}/finans-ozet`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: FinansOzetResp | null) => setFinansOzet(d))
      .catch(() => setFinansOzet(null))
  }, [id])

  useEffect(() => {
    fetch("/api/idari/belge-tipleri")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: number; kod: string; ad: string }[]) => setBelgeTipleri(data))
      .catch(() => setBelgeTipleri([]))
  }, [])

  const loadPersonel = () => {
    if (Number.isNaN(id)) return
    fetch(`/api/idari/personel/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PersonelDetail | null) => setPersonel(data))
      .catch(() => setPersonel(null))
    fetch(`/api/idari/personel/${id}/belgeler`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BelgeRow[]) => setBelgeler(data))
      .catch(() => setBelgeler([]))
  }

  const handleBelgeFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id || !belgeForm.belge_tipi) return
    if (file.size > 5 * 1024 * 1024) {
      alert("Dosya 5MB'dan küçük olmalı.")
      return
    }
    setBelgeSaving(true)
    const formData = new FormData()
    formData.append("belge_tipi", belgeForm.belge_tipi)
    if (belgeForm.gecerlilik_tarihi) formData.append("gecerlilik_tarihi", belgeForm.gecerlilik_tarihi)
    formData.append("file", file)
    const res = await fetch(`/api/idari/personel/${id}/belgeler`, {
      method: "POST",
      body: formData,
    })
    setBelgeSaving(false)
    if (res.ok) {
      setBelgeDialogOpen(false)
      setBelgeForm({ belge_tipi: "", gecerlilik_tarihi: "" })
      e.target.value = ""
      loadPersonel()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Yüklenemedi.")
    }
  }

  const closeAtamaDialog = () => {
    setAtamaDialogOpen(false)
    setEditingAtamaId(null)
    setAtamaForm({ site_id: "", baslangic_tarihi: "", bitis_tarihi: "" })
  }

  const handleSaveAtama = async () => {
    const site_id = parseInt(atamaForm.site_id, 10)
    if (!site_id || !atamaForm.baslangic_tarihi.trim()) {
      alert("Şantiye ve başlangıç tarihi gerekli.")
      return
    }
    const body = {
      site_id,
      baslangic_tarihi: atamaForm.baslangic_tarihi.slice(0, 10),
      bitis_tarihi: atamaForm.bitis_tarihi ? atamaForm.bitis_tarihi.slice(0, 10) : null,
    }
    const res =
      editingAtamaId != null
        ? await fetch(`/api/idari/personel/${id}/atama/${editingAtamaId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/idari/personel/${id}/atama`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
    if (res.ok) {
      closeAtamaDialog()
      loadPersonel()
      fetch(`/api/idari/personel/${id}/finans-ozet`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: FinansOzetResp | null) => setFinansOzet(d))
        .catch(() => {})
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || (editingAtamaId != null ? "Atama güncellenemedi." : "Atama eklenemedi."))
    }
  }

  const handleDeleteAtama = async (atamaId: number) => {
    if (!confirm("Bu şantiye atamasını silmek istediğinize emin misiniz?")) return
    const res = await fetch(`/api/idari/personel/${id}/atama/${atamaId}`, { method: "DELETE" })
    if (res.ok) {
      loadPersonel()
      fetch(`/api/idari/personel/${id}/finans-ozet`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: FinansOzetResp | null) => setFinansOzet(d))
        .catch(() => {})
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Silinemedi.")
    }
  }

  if (Number.isNaN(id)) {
    return (
      <Box>
        <Typography color="error">Geçersiz personel.</Typography>
        <Button component={Link} href="/idari/personel" sx={{ mt: 2 }}>Listeye dön</Button>
      </Box>
    )
  }

  if (!personel) {
    return (
      <Box>
        <Typography color="text.secondary">Yükleniyor...</Typography>
        <Button component={Link} href="/idari/personel" sx={{ mt: 2 }}>Listeye dön</Button>
      </Box>
    )
  }

  const fotoSrc = personelFotoSrc(id, personel.foto_yolu)

  return (
    <Box>
      <Button component={Link} href="/idari/personel" startIcon={<ArrowBack />} sx={{ mb: 2 }}>
        Listeye dön
      </Button>

      <Paper sx={{ p: 0, mb: 2, borderRadius: 2, overflow: "hidden" }}>
        <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "stretch" }}>
          <Box
            sx={{
              width: isMobile ? "100%" : 160,
              minHeight: isMobile ? 180 : 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "grey.100",
              p: 2,
            }}
          >
            {fotoSrc ? (
              <Box component="img" src={fotoSrc} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 1 }} />
            ) : (
              <Person sx={{ fontSize: 80, color: "grey.400" }} />
            )}
          </Box>
          <Box sx={{ flex: 1, p: 3 }}>
            <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600 }}>
              {personel.ad} {personel.soyad}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {personel.gorev}
              {personel.calistigi_bolum && ` Â· ${personel.calistigi_bolum}`}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mt: 2 }}>
              <Typography variant="body2"><strong>Kimlik:</strong> {personel.tc_kimlik ? `TC ${personel.tc_kimlik}` : personel.pasaport_no ? `Pasaport ${personel.pasaport_no}` : "—"}</Typography>
              <Typography variant="body2"><strong>İşe giriş:</strong> {personel.ise_giris_tarihi ? String(personel.ise_giris_tarihi).slice(0, 10) : "—"}</Typography>
              <Typography variant="body2"><strong>İşten çıkış:</strong> {personel.isten_cikis_tarihi ? String(personel.isten_cikis_tarihi).slice(0, 10) : "—"}</Typography>
              <Typography variant="body2"><strong>Çalıştığı bölüm:</strong> {personel.calistigi_bolum ?? "—"}</Typography>
              <Typography variant="body2"><strong>Kan grubu:</strong> {personel.kan_grubu ?? "—"}</Typography>
              <Typography variant="body2"><strong>Acil iletişim:</strong> {personel.acil_iletisim ?? "—"}</Typography>
              <Typography variant="body2"><strong>Acil telefon:</strong> {personel.acil_telefon ?? "—"}</Typography>
              <Typography variant="body2"><strong>Günlük yevmiye:</strong> {personel.gunluk_yevmiye != null ? personel.gunluk_yevmiye : "—"}</Typography>
              <Typography variant="body2"><strong>Aylık maaş:</strong> {personel.aylik_maas != null ? personel.aylik_maas : "—"}</Typography>
              <Typography variant="body2"><strong>IBAN:</strong> {personel.iban ?? "—"}</Typography>
              <Typography variant="body2"><strong>Banka:</strong> {personel.banka_adi ?? "—"}</Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {canManage && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>Belgeler (Pasaport/Kimlik, Personel fotoğrafı)</Typography>
          <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setBelgeDialogOpen(true)} sx={{ mb: 2 }}>
            Belge / fotoğraf yükle
          </Button>
          {belgeler.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Henüz belge yok.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Belge</strong></TableCell>
                  <TableCell><strong>Geçerlilik</strong></TableCell>
                  <TableCell>İndir</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {belgeler.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{belgeTipleri.find((t) => t.kod === b.belge_tipi)?.ad ?? b.belge_tipi}</TableCell>
                    <TableCell>{b.gecerlilik_tarihi ? String(b.gecerlilik_tarihi).slice(0, 10) : "—"}</TableCell>
                    <TableCell><Button size="small" href={`/api/idari/personel/${id}/belgeler/${b.id}`} target="_blank" rel="noopener">Görüntüle</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {finansOzet && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>Ücret özeti (onaylı puantaj)</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Veriler {finansOzet.stats_since} tarihinden itibaren listelenir (sistemde puantaj olan aylar). Yevmiye tutarı güncel tarifeyle çarpılır; aylık maaş için ay içinde en az bir onaylı puantaj varsa tarife satırı gösterilir.
          </Typography>
          {finansOzet.aylar.length === 0 ? (
            <Typography variant="body2" color="text.secondary">Bu dönemde onaylı puantaj kaydı yok.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Ay</strong></TableCell>
                  <TableCell align="right"><strong>Adam/gün</strong></TableCell>
                  <TableCell align="right"><strong>Yevmiye hak edişi</strong></TableCell>
                  <TableCell align="right"><strong>Aylık maaş (liste)</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {finansOzet.aylar.map((row) => (
                  <TableRow key={row.ay}>
                    <TableCell>{row.ay}</TableCell>
                    <TableCell align="right">{Number(row.toplam_carpan).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">
                      {finansOzet.gunluk_yevmiye != null && finansOzet.gunluk_yevmiye > 0
                        ? Number(row.yevmiye_hak_edis).toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {row.aylik_maas_goster != null ? Number(row.aylik_maas_goster).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>Atama geçmişi (şantiye)</Typography>
          {canManage && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={() => {
                setEditingAtamaId(null)
                setAtamaForm({ site_id: "", baslangic_tarihi: "", bitis_tarihi: "" })
                setAtamaDialogOpen(true)
              }}
            >
              Atama ekle
            </Button>
          )}
        </Box>
        {!personel.atamalar || personel.atamalar.length === 0 ? (
          <Typography color="text.secondary">Henüz atama yok.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Şantiye</strong></TableCell>
                <TableCell><strong>Başlangıç</strong></TableCell>
                <TableCell><strong>Bitiş</strong></TableCell>
                {canManage && <TableCell align="right"><strong>İşlem</strong></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {personel.atamalar.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.site_name}</TableCell>
                  <TableCell>{String(a.baslangic_tarihi).slice(0, 10)}</TableCell>
                  <TableCell>{a.bitis_tarihi ? String(a.bitis_tarihi).slice(0, 10) : "Devam ediyor"}</TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        aria-label="Düzenle"
                        onClick={() => {
                          setEditingAtamaId(a.id)
                          setAtamaForm({
                            site_id: String(a.site_id),
                            baslangic_tarihi: String(a.baslangic_tarihi).slice(0, 10),
                            bitis_tarihi: a.bitis_tarihi ? String(a.bitis_tarihi).slice(0, 10) : "",
                          })
                          setAtamaDialogOpen(true)
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" aria-label="Sil" color="error" onClick={() => handleDeleteAtama(a.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={belgeDialogOpen} onClose={() => setBelgeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Belge / fotoğraf yükle</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Belge tipi</InputLabel>
              <Select value={belgeForm.belge_tipi} label="Belge tipi" onChange={(e) => setBelgeForm((f) => ({ ...f, belge_tipi: e.target.value }))}>
                <MenuItem value="">Seçin</MenuItem>
                {belgeTipleri.map((t) => (
                  <MenuItem key={t.id} value={t.kod}>{t.ad}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Geçerlilik tarihi (opsiyonel)" type="date" value={belgeForm.gecerlilik_tarihi} onChange={(e) => setBelgeForm((f) => ({ ...f, gecerlilik_tarihi: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            <Button variant="outlined" component="label" disabled={!belgeForm.belge_tipi || belgeSaving}>
              {belgeSaving ? "Yükleniyor…" : "Dosya seç"}
              <input type="file" accept="image/*,.pdf" hidden onChange={handleBelgeFileChange} />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBelgeDialogOpen(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={atamaDialogOpen} onClose={closeAtamaDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{editingAtamaId != null ? "Şantiye atamasını düzenle" : "Şantiye ataması ekle"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Şantiye</InputLabel>
              <Select
                value={atamaForm.site_id}
                label="Şantiye"
                onChange={(e) => setAtamaForm((f) => ({ ...f, site_id: e.target.value }))}
              >
                {sites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Başlangıç tarihi"
              type="date"
              value={atamaForm.baslangic_tarihi}
              onChange={(e) => setAtamaForm((f) => ({ ...f, baslangic_tarihi: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="Bitiş tarihi (opsiyonel)"
              type="date"
              value={atamaForm.bitis_tarihi}
              onChange={(e) => setAtamaForm((f) => ({ ...f, bitis_tarihi: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Typography variant="caption" color="text.secondary">
              {editingAtamaId != null
                ? "Tarih ve şantiye bilgisini güncelleyebilirsiniz. Çakışan başlangıç tarihi kaydedilemez."
                : "Yeni atama eklendiğinde, başka şantiyelerdeki aktif atamalar başlangıç tarihinden bir gün önce otomatik kapatılır."}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAtamaDialog}>İptal</Button>
          <Button variant="contained" onClick={handleSaveAtama} disabled={!atamaForm.site_id || !atamaForm.baslangic_tarihi} sx={{ background: "var(--icsp-lacivert)" }}>
            {editingAtamaId != null ? "Kaydet" : "Ekle"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

