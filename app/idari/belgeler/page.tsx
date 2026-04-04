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
} from "@mui/material"
import { Add, Warning } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

interface PersonelItem {
  id: number
  ad: string
  soyad: string
  gorev: string
}

interface BelgeTipi {
  id: number
  kod: string
  ad: string
}

interface BelgeRow {
  id: number
  personel_id: number
  belge_tipi: string
  dosya_yolu: string
  gecerlilik_tarihi: string | null
  yukleme_tarihi: string
}

export default function IdariBelgelerPage() {
  const { user } = useAuth()
  const [personelList, setPersonelList] = useState<PersonelItem[]>([])
  const [belgeTipleri, setBelgeTipleri] = useState<BelgeTipi[]>([])
  const [selectedPersonelId, setSelectedPersonelId] = useState<string>("")
  const [belgeler, setBelgeler] = useState<BelgeRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ belge_tipi: "", gecerlilik_tarihi: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "super_admin" || role === "admin" || role === "manager"

  useEffect(() => {
    const params = new URLSearchParams()
    if (role === "user" || role === "personel") {
      if (user?.siteId != null) params.set("siteId", String(user.siteId))
    }
    fetch(`/api/idari/personel?${params}&limit=500`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res: { data?: PersonelItem[] } | PersonelItem[]) => {
        setPersonelList(Array.isArray(res) ? res : (res.data ?? []))
      })
      .catch(() => setPersonelList([]))
    setBelgeTipleri([
      { id: 1, kod: "kimlik", ad: "Kimlik Fotokopisi" },
      { id: 2, kod: "isg", ad: "İSG Eğitim Sertifikası" },
      { id: 3, kod: "mesleki", ad: "Mesleki Yeterlilik Belgesi" },
      { id: 4, kod: "saglik", ad: "Sağlık Raporu" },
      { id: 5, kod: "adli_sicil", ad: "Adli Sicil Kaydı" },
    ])
  }, [role, user?.siteId])

  useEffect(() => {
    if (!selectedPersonelId) {
      setBelgeler([])
      return
    }
    fetch(`/api/idari/personel/${selectedPersonelId}/belgeler`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setBelgeler)
      .catch(() => setBelgeler([]))
  }, [selectedPersonelId])

  const handleFileChange = async () => {
    const input = fileInputRef.current
    if (!input?.files?.[0] || !selectedPersonelId || !form.belge_tipi) return
    const file = input.files[0]
    if (file.size > 5 * 1024 * 1024) {
      alert("Dosya 5MB'dan küçük olmalı.")
      return
    }
    setSaving(true)
    const formData = new FormData()
    formData.append("belge_tipi", form.belge_tipi)
    if (form.gecerlilik_tarihi) formData.append("gecerlilik_tarihi", form.gecerlilik_tarihi)
    formData.append("file", file)
    const res = await fetch(`/api/idari/personel/${selectedPersonelId}/belgeler`, {
      method: "POST",
      body: formData,
    })
    setSaving(false)
    if (res.ok) {
      setDialogOpen(false)
      setForm({ belge_tipi: "", gecerlilik_tarihi: "" })
      input.value = ""
      const list = await fetch(`/api/idari/personel/${selectedPersonelId}/belgeler`).then((r) => (r.ok ? r.json() : []))
      setBelgeler(list)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Yüklenemedi.")
    }
  }

  const isGecikmis = (tarih: string | null) => {
    if (!tarih) return false
    return new Date(tarih) < new Date()
  }
  const isYakin = (tarih: string | null) => {
    if (!tarih) return false
    const d = new Date(tarih)
    const in15 = new Date()
    in15.setDate(in15.getDate() + 15)
    return d >= new Date() && d <= in15
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Personel belgeleri
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel>Personel</InputLabel>
            <Select value={selectedPersonelId} label="Personel" onChange={(e) => setSelectedPersonelId(e.target.value)}>
              <MenuItem value="">Seçin</MenuItem>
              {personelList.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>{p.ad} {p.soyad} — {p.gorev}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {canManage && selectedPersonelId && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)} sx={{ background: "var(--icsp-lacivert)" }}>
              Belge ekle
            </Button>
          )}
        </Box>

        {!selectedPersonelId ? (
          <Typography color="text.secondary">Personel seçin.</Typography>
        ) : belgeler.length === 0 ? (
          <Typography color="text.secondary">Belge yok.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Belge tipi</strong></TableCell>
                <TableCell><strong>Geçerlilik tarihi</strong></TableCell>
                <TableCell><strong>Yükleme</strong></TableCell>
                <TableCell>Durum</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {belgeler.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.belge_tipi}</TableCell>
                  <TableCell>{row.gecerlilik_tarihi ? String(row.gecerlilik_tarihi).slice(0, 10) : "—"}</TableCell>
                  <TableCell>{row.yukleme_tarihi ? String(row.yukleme_tarihi).slice(0, 10) : "—"}</TableCell>
                  <TableCell>
                    {row.gecerlilik_tarihi && (
                      isGecikmis(row.gecerlilik_tarihi) ? <Typography color="error" variant="body2"><Warning /> Süresi dolmuş</Typography>
                        : isYakin(row.gecerlilik_tarihi) ? <Typography color="warning.main" variant="body2">Yaklaşıyor</Typography>
                        : null
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Belge yükle</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Belge tipi</InputLabel>
              <Select value={form.belge_tipi} label="Belge tipi" onChange={(e) => setForm((f) => ({ ...f, belge_tipi: e.target.value }))}>
                {belgeTipleri.map((t) => (
                  <MenuItem key={t.kod} value={t.kod}>{t.ad}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Geçerlilik tarihi (opsiyonel)" type="date" value={form.gecerlilik_tarihi} onChange={(e) => setForm((f) => ({ ...f, gecerlilik_tarihi: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            <Button variant="outlined" component="label" disabled={!form.belge_tipi}>
              Dosya seç (max 5MB)
              <input type="file" ref={fileInputRef} hidden accept=".pdf,image/*" onChange={handleFileChange} />
            </Button>
            {saving && <Typography variant="body2">Yükleniyor...</Typography>}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

