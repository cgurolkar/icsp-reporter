"use client"

import { useState, useEffect } from "react"
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
  Alert,
} from "@mui/material"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"

const DURUM_OPTIONS = [
  { value: "1_G", label: "Tam gün", carpan: 1, durum_kod: "G" },
  { value: "0.5_G", label: "Yarım gün", carpan: 0.5, durum_kod: "G" },
  { value: "0_G", label: "Gelmedi", carpan: 0, durum_kod: "G" },
  { value: "0_I", label: "İzinli", carpan: 0, durum_kod: "İ" },
  { value: "0_R", label: "Raporlu", carpan: 0, durum_kod: "R" },
]

interface SiteItem {
  id: number
  name: string
}

interface PuantajRow {
  personel_id: number
  ad: string
  soyad: string
  gorev: string
  puantaj_id?: number
  carpan: number
  durum_kod: string
  mesai_saat: number
  notlar: string
  puantaj_durum: string
}

export default function IdariPuantajPage() {
  const { user } = useAuth()
  const [sites, setSites] = useState<SiteItem[]>([])
  const [siteId, setSiteId] = useState<string>("")
  const [tarih, setTarih] = useState(() => new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<PuantajRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localRows, setLocalRows] = useState<Record<number, { carpan: number; durum_kod: string; mesai_saat: number; notlar: string }>>({})

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const siteIdNum = siteId ? parseInt(siteId, 10) : 0
  const canEnter = role === "admin" || (user?.siteId != null && user.siteId === siteIdNum)

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SiteItem[]) => {
        if (role === "user" || role === "personel") {
          const myId = user?.siteId
          if (myId != null) setSites(data.filter((s) => s.id === myId))
          else setSites([])
        } else setSites(data)
      })
      .catch(() => setSites([]))
  }, [role, user?.siteId])

  useEffect(() => {
    if (!siteId || !tarih) {
      setRows([])
      setLocalRows({})
      return
    }
    setLoading(true)
    fetch(`/api/idari/puantaj?siteId=${siteId}&tarih=${tarih}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PuantajRow[]) => {
        setRows(data)
        const map: Record<number, { carpan: number; durum_kod: string; mesai_saat: number; notlar: string }> = {}
        data.forEach((row) => {
          const key = row.durum_kod === "İ" ? "0_I" : row.durum_kod === "R" ? "0_R" : `${row.carpan}_${row.durum_kod}`
          map[row.personel_id] = {
            carpan: row.carpan,
            durum_kod: row.durum_kod,
            mesai_saat: row.mesai_saat,
            notlar: row.notlar || "",
          }
        })
        setLocalRows(map)
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [siteId, tarih])

  const setDurum = (personelId: number, value: string) => {
    const opt = DURUM_OPTIONS.find((o) => o.value === value)
    if (!opt) return
    setLocalRows((prev) => ({
      ...prev,
      [personelId]: {
        ...prev[personelId],
        carpan: opt.carpan,
        durum_kod: opt.durum_kod,
        mesai_saat: prev[personelId]?.mesai_saat ?? 0,
        notlar: prev[personelId]?.notlar ?? "",
      },
    }))
  }

  const setMesai = (personelId: number, v: number) => {
    setLocalRows((prev) => ({
      ...prev,
      [personelId]: { ...prev[personelId], mesai_saat: v, carpan: prev[personelId]?.carpan ?? 1, durum_kod: prev[personelId]?.durum_kod ?? "G", notlar: prev[personelId]?.notlar ?? "" },
    }))
  }

  const setNotlar = (personelId: number, v: string) => {
    setLocalRows((prev) => ({
      ...prev,
      [personelId]: { ...prev[personelId], notlar: v, carpan: prev[personelId]?.carpan ?? 1, durum_kod: prev[personelId]?.durum_kod ?? "G", mesai_saat: prev[personelId]?.mesai_saat ?? 0 },
    }))
  }

  const tumunuGeldi = () => {
    setLocalRows((prev) => {
      const next = { ...prev }
      rows.forEach((r) => {
        next[r.personel_id] = { carpan: 1, durum_kod: "G", mesai_saat: next[r.personel_id]?.mesai_saat ?? 0, notlar: next[r.personel_id]?.notlar ?? "" }
      })
      return next
    })
  }

  const getDurumValue = (row: PuantajRow) => {
    const local = localRows[row.personel_id]
    const c = local?.carpan ?? row.carpan
    const d = local?.durum_kod ?? row.durum_kod
    if (d === "İ") return "0_I"
    if (d === "R") return "0_R"
    return `${c}_${d}`
  }

  const handleSave = async () => {
    if (!siteId || !tarih || !canEnter) return
    setSaving(true)
    const payload = {
      siteId: parseInt(siteId, 10),
      tarih,
      rows: rows.map((r) => {
        const loc = localRows[r.personel_id] ?? { carpan: r.carpan, durum_kod: r.durum_kod, mesai_saat: r.mesai_saat, notlar: r.notlar }
        return {
          personel_id: r.personel_id,
          carpan: loc.carpan,
          durum_kod: loc.durum_kod,
          mesai_saat: loc.mesai_saat,
          notlar: loc.notlar || undefined,
        }
      }),
    }
    const res = await fetch("/api/idari/puantaj", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    setSaving(false)
    if (res.ok) {
      const list = await fetch(`/api/idari/puantaj?siteId=${siteId}&tarih=${tarih}`).then((r) => (r.ok ? r.json() : []))
      setRows(list)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "Kaydedilemedi.")
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Puantaj girişi
      </Typography>

      {!canEnter && role !== "admin" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Puantaj girişi sadece o şantiyenin sorumlu kişisi tarafından yapılır. Sadece atandığınız şantiyeyi seçebilirsiniz.
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Şantiye</InputLabel>
            <Select value={siteId} label="Şantiye" onChange={(e) => setSiteId(e.target.value)}>
              <MenuItem value="">Seçin</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Tarih" type="date" value={tarih} onChange={(e) => setTarih(e.target.value.slice(0, 10))} size="small" InputLabelProps={{ shrink: true }} />
          <Button variant="outlined" onClick={tumunuGeldi} disabled={rows.length === 0 || !canEnter}>
            Tümünü &quot;Geldi&quot; yap
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={rows.length === 0 || !canEnter || saving} sx={{ background: "var(--icsp-lacivert)" }}>
            {saving ? "Kaydediliyor..." : "Kaydet (Taslak)"}
          </Button>
        </Box>

        {loading ? (
          <Typography color="text.secondary">Yükleniyor...</Typography>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary">
            {siteId && tarih ? "Bu şantiyede bu tarihte atanmış personel yok. Önce personel ataması yapın." : "Şantiye ve tarih seçin."}
          </Typography>
        ) : (
          <Table size="small" sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell><strong>Personel / Görev</strong></TableCell>
                <TableCell><strong>Durum</strong></TableCell>
                <TableCell><strong>Fazla mesai (saat)</strong></TableCell>
                <TableCell><strong>Not</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.personel_id}>
                  <TableCell>{row.ad} {row.soyad} — {row.gorev}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={getDurumValue(row)}
                      onChange={(e) => setDurum(row.personel_id, e.target.value)}
                      disabled={row.puantaj_durum === "onaylandi"}
                      sx={{ minWidth: 140 }}
                    >
                      {DURUM_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                    {row.puantaj_durum === "onaylandi" && <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>Onaylı</Typography>}
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: 0, step: 0.5 }}
                      value={localRows[row.personel_id]?.mesai_saat ?? row.mesai_saat}
                      onChange={(e) => setMesai(row.personel_id, parseFloat(e.target.value) || 0)}
                      disabled={row.puantaj_durum === "onaylandi"}
                      sx={{ width: 90 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      placeholder="Not"
                      value={localRows[row.personel_id]?.notlar ?? row.notlar}
                      onChange={(e) => setNotlar(row.personel_id, e.target.value)}
                      disabled={row.puantaj_durum === "onaylandi"}
                      fullWidth
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {(role === "admin" || role === "manager") && (
        <Button component={Link} href="/idari/puantaj-onay" variant="outlined">
          Puantaj onay sayfasına git
        </Button>
      )}
    </Box>
  )
}
