"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Grid, TextField, Typography, Box, Paper,
  Table, TableHead, TableBody, TableRow, TableCell,
  Select, MenuItem, Chip, Divider, Alert,
  Checkbox, FormControlLabel,
} from "@mui/material"
import { useLanguage } from "@/contexts/language-context"
import type { Personnel, PuantajEntry } from "@/types/form-data"

const DURUM_OPTIONS = [
  { value: "1_G", label: "Tam gün", carpan: 1, durum_kod: "G" },
  { value: "0.5_G", label: "Yarım gün", carpan: 0.5, durum_kod: "G" },
  { value: "0_G", label: "Gelmedi", carpan: 0, durum_kod: "G" },
  { value: "0_I", label: "İzinli", carpan: 0, durum_kod: "İ" },
  { value: "0_R", label: "Raporlu", carpan: 0, durum_kod: "R" },
]

function durumKey(carpan: number, durum_kod: string) {
  if (durum_kod === "İ") return "0_I"
  if (durum_kod === "R") return "0_R"
  return `${carpan}_${durum_kod}`
}

interface PersonelRow {
  personel_id: number
  ad: string
  soyad: string
  gorev: string
  puantaj_id?: number | null
  carpan: number
  durum_kod: string
  mesai_saat: number
  notlar: string
}

interface PersonnelStepProps {
  data: Personnel
  onChange: (data: Personnel) => void
  puantaj: PuantajEntry[]
  onPuantajChange: (entries: PuantajEntry[]) => void
  siteId?: number | null
  tarih?: string
}

export default function PersonnelStep({
  data, onChange, puantaj, onPuantajChange, siteId, tarih,
}: PersonnelStepProps) {
  const { t } = useLanguage()
  const [personeller, setPersoneller] = useState<PersonelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!siteId || !tarih) { setPersoneller([]); setLoaded(false); return }
    setLoading(true)
    fetch(`/api/idari/puantaj?siteId=${siteId}&tarih=${tarih}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: PersonelRow[]) => {
        setPersoneller(rows)
        setLoaded(true)
        if (rows.length > 0) {
          onPuantajChange(
            rows.map((r) => ({
              personel_id: r.personel_id,
              ad: r.ad,
              soyad: r.soyad,
              gorev: r.gorev,
              carpan: r.puantaj_id != null ? (Number(r.carpan) || 0) : 0,
              durum_kod: (r.durum_kod as string) || "G",
              mesai_saat: r.mesai_saat ?? 0,
              notlar: r.notlar ?? "",
            })),
          )
        }
      })
      .catch(() => setPersoneller([]))
      .finally(() => setLoading(false))
  }, [siteId, tarih])

  const updateEntry = (personelId: number, patch: Partial<PuantajEntry>) => {
    onPuantajChange(puantaj.map((e) => e.personel_id === personelId ? { ...e, ...patch } : e))
  }

  const setDurum = (personelId: number, value: string) => {
    const opt = DURUM_OPTIONS.find((o) => o.value === value)
    if (!opt) return
    updateEntry(personelId, { carpan: opt.carpan, durum_kod: opt.durum_kod })
  }

  const setSantiyedeCalisti = (personelId: number, calisti: boolean) => {
    if (calisti) {
      updateEntry(personelId, { carpan: 1, durum_kod: "G" })
    } else {
      updateEntry(personelId, { carpan: 0, durum_kod: "G" })
    }
  }

  const handleChange = (field: keyof Personnel) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newData = { ...data, [field]: Number.parseInt(event.target.value) || 0 }
    newData.total = newData.engineer + newData.foreman + newData.operator + newData.oiler + newData.welder + newData.other
    onChange(newData)
  }

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "white",
      "&:hover fieldset": { borderColor: "success.main" },
    },
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "success.main", fontWeight: 600, mb: 3 }}>
        {t("personnel")}
      </Typography>

      <Paper sx={{ p: 3, background: "linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)", border: "1px solid #4caf50", mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2, color: "success.dark" }}>Genel Personel Sayısı</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={2}><TextField fullWidth label={t("engineer")} type="number" value={data.engineer} onChange={handleChange("engineer")} sx={fieldSx} /></Grid>
          <Grid item xs={12} md={2}><TextField fullWidth label={t("foreman")} type="number" value={data.foreman} onChange={handleChange("foreman")} sx={fieldSx} /></Grid>
          <Grid item xs={12} md={2}><TextField fullWidth label={t("operator")} type="number" value={data.operator} onChange={handleChange("operator")} sx={fieldSx} /></Grid>
          <Grid item xs={12} md={2}><TextField fullWidth label={t("oiler")} type="number" value={data.oiler} onChange={handleChange("oiler")} sx={fieldSx} /></Grid>
          <Grid item xs={12} md={2}><TextField fullWidth label={t("welder")} type="number" value={data.welder} onChange={handleChange("welder")} sx={fieldSx} /></Grid>
          <Grid item xs={12} md={2}><TextField fullWidth label={t("other")} type="number" value={data.other} onChange={handleChange("other")} sx={fieldSx} /></Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth label={t("total")} type="number" value={data.total}
              InputProps={{ readOnly: true }} variant="filled"
              sx={{ "& .MuiFilledInput-root": { backgroundColor: "success.light", color: "white", fontWeight: "bold" } }}
            />
          </Grid>
        </Grid>
      </Paper>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "var(--icsp-lacivert)", mb: 1 }}>
        Günlük Puantaj
        {puantaj.length > 0 && (
          <Chip
            label={`${puantaj.filter((e) => e.carpan > 0).length} / ${puantaj.length} çalışan`}
            size="small" color="primary" sx={{ ml: 1 }}
          />
        )}
      </Typography>

      {!siteId ? (
        <Alert severity="info">Puantaj için önce Temel Bilgiler adımında şantiye seçin.</Alert>
      ) : loading ? (
        <Typography color="text.secondary" variant="body2">Personel listesi yükleniyor...</Typography>
      ) : loaded && personeller.length === 0 ? (
        <Alert severity="warning">
          Bu şantiyeye atanmış aktif personel bulunamadı. İdari → Personel bölümünden şantiye ataması yapın.
        </Alert>
      ) : puantaj.length > 0 ? (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#e8eaf6" }}>
                <TableCell sx={{ width: 56 }}><strong>Şantiyede</strong></TableCell>
                <TableCell><strong>Ad Soyad</strong></TableCell>
                <TableCell><strong>Görev</strong></TableCell>
                <TableCell><strong>Durum</strong></TableCell>
                <TableCell><strong>Fazla mesai (s)</strong></TableCell>
                <TableCell><strong>Not</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {puantaj.map((entry) => (
                <TableRow
                  key={entry.personel_id}
                  sx={{ backgroundColor: entry.carpan === 0 ? "#fff8f8" : entry.carpan < 1 ? "#fffde7" : "#f9fff9" }}
                >
                  <TableCell>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={entry.carpan > 0}
                          onChange={(e) => setSantiyedeCalisti(entry.personel_id, e.target.checked)}
                          size="small"
                        />
                      }
                      label=""
                      sx={{ mr: 0 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{entry.ad} {entry.soyad}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{entry.gorev}</Typography></TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={durumKey(entry.carpan, entry.durum_kod)}
                      onChange={(e) => setDurum(entry.personel_id, e.target.value)}
                      sx={{ minWidth: 130 }}
                    >
                      {DURUM_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </Select>
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number" size="small" inputProps={{ min: 0, step: 0.5 }}
                      value={entry.mesai_saat}
                      onChange={(e) => updateEntry(entry.personel_id, { mesai_saat: parseFloat(e.target.value) || 0 })}
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small" placeholder="Not..." value={entry.notlar}
                      onChange={(e) => updateEntry(entry.personel_id, { notlar: e.target.value })}
                      sx={{ minWidth: 140 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : null}
    </Box>
  )
}
