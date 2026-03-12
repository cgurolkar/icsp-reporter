"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
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
} from "@mui/material"
import { ArrowBack, Add } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

interface PersonelDetail {
  id: number
  ad: string
  soyad: string
  gorev: string
  tc_kimlik?: string | null
  dogum_tarihi?: string | null
  kan_grubu?: string | null
  acil_iletisim?: string | null
  acil_telefon?: string | null
  ise_giris_tarihi?: string | null
  sigorta_durumu?: string | null
  iban?: string | null
  banka_adi?: string | null
  gunluk_yevmiye?: number | null
  aylik_maas?: number | null
  atamalar: { id: number; site_id: number; site_name: string; baslangic_tarihi: string; bitis_tarihi?: string | null }[]
}

interface SiteItem {
  id: number
  name: string
}

export default function IdariPersonelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const id = typeof params.id === "string" ? parseInt(params.id, 10) : NaN
  const [personel, setPersonel] = useState<PersonelDetail | null>(null)
  const [sites, setSites] = useState<SiteItem[]>([])
  const [atamaDialogOpen, setAtamaDialogOpen] = useState(false)
  const [atamaForm, setAtamaForm] = useState({ site_id: "", baslangic_tarihi: "", bitis_tarihi: "" })

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "admin" || role === "manager"

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

  const loadPersonel = () => {
    if (Number.isNaN(id)) return
    fetch(`/api/idari/personel/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PersonelDetail | null) => setPersonel(data))
      .catch(() => setPersonel(null))
  }

  const handleAddAtama = async () => {
    const site_id = parseInt(atamaForm.site_id, 10)
    if (!site_id || !atamaForm.baslangic_tarihi.trim()) {
      alert("Şantiye ve başlangıç tarihi gerekli.")
      return
    }
    const res = await fetch(`/api/idari/personel/${id}/atama`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id,
        baslangic_tarihi: atamaForm.baslangic_tarihi.slice(0, 10),
        bitis_tarihi: atamaForm.bitis_tarihi ? atamaForm.bitis_tarihi.slice(0, 10) : null,
      }),
    })
    if (res.ok) {
      setAtamaDialogOpen(false)
      setAtamaForm({ site_id: "", baslangic_tarihi: "", bitis_tarihi: "" })
      loadPersonel()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Atama eklenemedi.")
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

  return (
    <Box>
      <Button component={Link} href="/idari/personel" startIcon={<ArrowBack />} sx={{ mb: 2 }}>
        Listeye dön
      </Button>

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
          {personel.ad} {personel.soyad}
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <Typography><strong>Görev:</strong> {personel.gorev}</Typography>
          <Typography><strong>TC:</strong> {personel.tc_kimlik ?? "—"}</Typography>
          <Typography><strong>İşe giriş:</strong> {personel.ise_giris_tarihi ? String(personel.ise_giris_tarihi).slice(0, 10) : "—"}</Typography>
          <Typography><strong>Kan grubu:</strong> {personel.kan_grubu ?? "—"}</Typography>
          <Typography><strong>Acil iletişim:</strong> {personel.acil_iletisim ?? "—"}</Typography>
          <Typography><strong>Acil telefon:</strong> {personel.acil_telefon ?? "—"}</Typography>
          <Typography><strong>Günlük yevmiye:</strong> {personel.gunluk_yevmiye != null ? personel.gunluk_yevmiye : "—"}</Typography>
          <Typography><strong>Aylık maaş:</strong> {personel.aylik_maas != null ? personel.aylik_maas : "—"}</Typography>
          <Typography><strong>IBAN:</strong> {personel.iban ?? "—"}</Typography>
          <Typography><strong>Banka:</strong> {personel.banka_adi ?? "—"}</Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>Atama geçmişi (şantiye)</Typography>
          {canManage && (
            <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setAtamaDialogOpen(true)}>
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
              </TableRow>
            </TableHead>
            <TableBody>
              {personel.atamalar.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.site_name}</TableCell>
                  <TableCell>{String(a.baslangic_tarihi).slice(0, 10)}</TableCell>
                  <TableCell>{a.bitis_tarihi ? String(a.bitis_tarihi).slice(0, 10) : "Devam ediyor"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={atamaDialogOpen} onClose={() => setAtamaDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Şantiye ataması ekle</DialogTitle>
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAtamaDialogOpen(false)}>İptal</Button>
          <Button variant="contained" onClick={handleAddAtama} disabled={!atamaForm.site_id || !atamaForm.baslangic_tarihi} sx={{ background: "var(--icsp-lacivert)" }}>
            Ekle
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
