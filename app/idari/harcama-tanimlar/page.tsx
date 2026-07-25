"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Box,
  Typography,
  Button,
  Paper,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from "@mui/material"
import { Add } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

interface Kalem {
  id: number
  kod: string
  ad: string
  aktif: boolean
}

interface AltKalem {
  id: number
  kalem_id: number
  ad: string
  aktif: boolean
  kalem_kod?: string
  kalem_ad?: string
}

interface MasrafYeri {
  id: number
  ad: string
  tip: string
  aktif: boolean
}

const MASRAF_TIPLERI = ["Makine", "Araç", "Saha", "Yaşam Alanı", "İdari", "Taşeron"]

export default function HarcamaTanimlarPage() {
  const { user } = useAuth()
  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "super_admin" || role === "admin" || role === "manager"

  const [tab, setTab] = useState(0)
  const [kalemler, setKalemler] = useState<Kalem[]>([])
  const [altKalemler, setAltKalemler] = useState<AltKalem[]>([])
  const [masrafYerleri, setMasrafYerleri] = useState<MasrafYeri[]>([])
  const [error, setError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [kalemKod, setKalemKod] = useState("")
  const [kalemAd, setKalemAd] = useState("")
  const [altKalemAd, setAltKalemAd] = useState("")
  const [altKalemParent, setAltKalemParent] = useState("")
  const [masrafAd, setMasrafAd] = useState("")
  const [masrafTip, setMasrafTip] = useState("Saha")

  const load = useCallback(async () => {
    setError("")
    try {
      const [kRes, aRes, mRes] = await Promise.all([
        fetch("/api/idari/harcama-kalemler?all=1"),
        fetch("/api/idari/harcama-alt-kalemler?all=1"),
        fetch("/api/idari/masraf-yerleri?all=1"),
      ])
      if (kRes.ok) setKalemler(await kRes.json())
      if (aRes.ok) setAltKalemler(await aRes.json())
      if (mRes.ok) setMasrafYerleri(await mRes.json())
    } catch {
      setError("Tanımlar yüklenemedi.")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openAdd = () => {
    setKalemKod("")
    setKalemAd("")
    setAltKalemAd("")
    setAltKalemParent(kalemler[0] ? String(kalemler[0].id) : "")
    setMasrafAd("")
    setMasrafTip("Saha")
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    try {
      let res: Response
      if (tab === 0) {
        res = await fetch("/api/idari/harcama-kalemler", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kod: kalemKod, ad: kalemAd }),
        })
      } else if (tab === 1) {
        res = await fetch("/api/idari/harcama-alt-kalemler", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kalemId: parseInt(altKalemParent, 10), ad: altKalemAd }),
        })
      } else {
        res = await fetch("/api/idari/masraf-yerleri", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad: masrafAd, tip: masrafTip }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.")
      setDialogOpen(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Hata")
    } finally {
      setSaving(false)
    }
  }

  const toggleAktif = async (kind: "kalem" | "alt" | "masraf", id: number, aktif: boolean) => {
    const url =
      kind === "kalem"
        ? `/api/idari/harcama-kalemler/${id}`
        : kind === "alt"
          ? `/api/idari/harcama-alt-kalemler/${id}`
          : `/api/idari/masraf-yerleri/${id}`
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktif }),
    })
    if (res.ok) await load()
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Güncellenemedi.")
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 1 }}>
        Harcama Tanımları
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Ana kalem (100–700), alt kalem ve masraf yeri tanımlarını yönetin. Günlük rapor ve harcama girişlerinde dropdown olarak kullanılır.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, pt: 1 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab label="Ana Kalemler" />
            <Tab label="Alt Kalemler" />
            <Tab label="Masraf Yerleri" />
          </Tabs>
          {canManage && (
            <Button variant="contained" size="small" startIcon={<Add />} onClick={openAdd} sx={{ background: "var(--icsp-lacivert)" }}>
              Yeni ekle
            </Button>
          )}
        </Box>

        {tab === 0 && (
          <Box sx={{ overflowX: "auto", p: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Kod</strong></TableCell>
                  <TableCell><strong>Ana Kalem</strong></TableCell>
                  <TableCell align="center"><strong>Aktif</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {kalemler.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.kod}</TableCell>
                    <TableCell>{k.ad}</TableCell>
                    <TableCell align="center">
                      {canManage ? (
                        <Switch size="small" checked={!!k.aktif} onChange={(e) => toggleAktif("kalem", k.id, e.target.checked)} />
                      ) : (
                        <Chip size="small" label={k.aktif ? "Aktif" : "Pasif"} color={k.aktif ? "success" : "default"} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ overflowX: "auto", p: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Kod</strong></TableCell>
                  <TableCell><strong>Ana Kalem</strong></TableCell>
                  <TableCell><strong>Alt Kalem</strong></TableCell>
                  <TableCell align="center"><strong>Aktif</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {altKalemler.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.kalem_kod}</TableCell>
                    <TableCell>{a.kalem_ad}</TableCell>
                    <TableCell>{a.ad}</TableCell>
                    <TableCell align="center">
                      {canManage ? (
                        <Switch size="small" checked={!!a.aktif} onChange={(e) => toggleAktif("alt", a.id, e.target.checked)} />
                      ) : (
                        <Chip size="small" label={a.aktif ? "Aktif" : "Pasif"} color={a.aktif ? "success" : "default"} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {tab === 2 && (
          <Box sx={{ overflowX: "auto", p: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Masraf Yeri</strong></TableCell>
                  <TableCell><strong>Tip</strong></TableCell>
                  <TableCell align="center"><strong>Aktif</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {masrafYerleri.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.ad}</TableCell>
                    <TableCell>{m.tip}</TableCell>
                    <TableCell align="center">
                      {canManage ? (
                        <Switch size="small" checked={!!m.aktif} onChange={(e) => toggleAktif("masraf", m.id, e.target.checked)} />
                      ) : (
                        <Chip size="small" label={m.aktif ? "Aktif" : "Pasif"} color={m.aktif ? "success" : "default"} />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {tab === 0 ? "Yeni ana kalem" : tab === 1 ? "Yeni alt kalem" : "Yeni masraf yeri"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {tab === 0 && (
              <>
                <TextField label="Kod (örn. 800)" value={kalemKod} onChange={(e) => setKalemKod(e.target.value)} fullWidth required />
                <TextField label="Ana kalem adı" value={kalemAd} onChange={(e) => setKalemAd(e.target.value)} fullWidth required />
              </>
            )}
            {tab === 1 && (
              <>
                <FormControl fullWidth required>
                  <InputLabel>Ana kalem</InputLabel>
                  <Select value={altKalemParent} label="Ana kalem" onChange={(e) => setAltKalemParent(e.target.value)}>
                    {kalemler.filter((k) => k.aktif).map((k) => (
                      <MenuItem key={k.id} value={String(k.id)}>{k.kod} — {k.ad}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField label="Alt kalem adı" value={altKalemAd} onChange={(e) => setAltKalemAd(e.target.value)} fullWidth required />
              </>
            )}
            {tab === 2 && (
              <>
                <TextField label="Masraf yeri" value={masrafAd} onChange={(e) => setMasrafAd(e.target.value)} fullWidth required />
                <FormControl fullWidth required>
                  <InputLabel>Tip</InputLabel>
                  <Select value={masrafTip} label="Tip" onChange={(e) => setMasrafTip(e.target.value)}>
                    {MASRAF_TIPLERI.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              saving ||
              (tab === 0 && (!kalemKod.trim() || !kalemAd.trim())) ||
              (tab === 1 && (!altKalemParent || !altKalemAd.trim())) ||
              (tab === 2 && (!masrafAd.trim() || !masrafTip))
            }
            sx={{ background: "var(--icsp-lacivert)" }}
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
