"use client"

import type React from "react"

import {
  TextField,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Alert,
  Checkbox,
  FormControlLabel,
} from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { PileDetail, MachineProductionSummary } from "@/types/form-data"

interface PileDetailsStepProps {
  data: PileDetail[]
  onChange: (data: PileDetail[]) => void
  productionSummary?: MachineProductionSummary[]
  /** Şantiye toplam beton dökülen kazık (üretim özeti) */
  siteConcretePouredPiles?: string
}

export default function PileDetailsStep({
  data,
  onChange,
  productionSummary = [],
  siteConcretePouredPiles = "",
}: PileDetailsStepProps) {
  const { t } = useLanguage()

  const betonToplam = parseInt(String(siteConcretePouredPiles ?? "").trim(), 10) || 0
  const dailyPiles = betonToplam

  const machineCols = productionSummary.filter((m) => m.machineId)
  const singleMachineId = machineCols.length === 1 ? machineCols[0].machineId : null

  const addPile = () => {
    const newPileNumber = Math.max(...data.map((p) => p.pileNumber), 0) + 1
    onChange([
      ...data,
      {
        pileNumber: newPileNumber,
        drilled: "",
        notes: "",
        machineIds: singleMachineId ? [singleMachineId] : [],
      },
    ])
  }

  const removePile = (index: number) => {
    if (data.length > 1) {
      onChange(data.filter((_, i) => i !== index))
    }
  }

  const updatePile = (index: number, field: keyof PileDetail, value: string | number | boolean | string[]) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value as never }
    onChange(newData)
  }

  const togglePileMachine = (index: number, machineId: string) => {
    const row = data[index]
    const cur = row.machineIds ?? []
    const next = cur.includes(machineId) ? cur.filter((id) => id !== machineId) : [...cur, machineId]
    updatePile(index, "machineIds", next)
  }

  const handleKeyPress = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "Enter") {
      event.preventDefault()
      // If this is the last row, add a new one
      if (index === data.length - 1) {
        addPile()
      }
      // Focus on the next row
      setTimeout(() => {
        const nextInput = document.querySelector(`input[data-pile-index="${index + 1}"]`) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
        }
      }, 100)
    }
  }

  const yapilanKazikSayisi = dailyPiles
  const doldurulanDetaySayisi = data.filter((p) => String(p.drilled ?? "").trim() || String(p.notes ?? "").trim()).length
  const detayEksik = yapilanKazikSayisi > 0 && doldurulanDetaySayisi < yapilanKazikSayisi
  const cokluMakine = machineCols.length > 1
  const betonluSatirlar = data.filter((p) => p.concretePoured)
  const betonMakineEksik = cokluMakine && betonluSatirlar.some((p) => !(p.machineIds && p.machineIds.length > 0))

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "warning.main", fontWeight: 600, mb: 3 }}>
        {t("pile_details_form_title")}
      </Typography>
      <Paper sx={{ p: 3, background: "linear-gradient(135deg, #fffde7 0%, #ffe082 100%)", border: "1px solid #ffb300", mb: 3 }}>
        {detayEksik && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("pile_details_warning").replace(/\{count\}/g, String(yapilanKazikSayisi)).replace(/\{entered\}/g, String(doldurulanDetaySayisi))}
          </Alert>
        )}
        {betonMakineEksik && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Beton döküldü işaretli satırlarda hangi makineye ait olduğunu en az bir makine sütunundan işaretleyin.
          </Alert>
        )}

        {/* Kazık Detayları Formu */}
        <Typography variant="subtitle1" gutterBottom sx={{ color: "#e65100", fontWeight: 600, mb: 2 }}>
          📝 {t("pile_details_form_title")}
        </Typography>
        <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "white", mb: 3 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "12%" }}>
                {t("pile_short").toUpperCase()}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "18%" }}>
                {t("drilled_short").toUpperCase()}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "28%" }}>
                {t("notes").toUpperCase()}
              </TableCell>
              {cokluMakine &&
                machineCols.map((m) => (
                  <TableCell
                    key={m.machineId}
                    sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", minWidth: 72, fontSize: "0.7rem" }}
                  >
                    {m.machineName}
                  </TableCell>
                ))}
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "12%" }}>
                Beton döküldü
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "8%" }}>
                {t("action").toUpperCase()}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((pile, index) => (
              <TableRow key={index}>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  <TextField
                    size="small"
                    type="number"
                    value={pile.pileNumber}
                    onChange={(e) => updatePile(index, "pileNumber", parseInt(e.target.value, 10) || index + 1)}
                    variant="standard"
                    InputProps={{ disableUnderline: true, inputProps: { min: 1 } }}
                    sx={{ width: 56, "& input": { textAlign: "center" } }}
                  />
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={pile.drilled}
                    onChange={(e) => updatePile(index, "drilled", e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    placeholder="28.00"
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      inputProps: { "data-pile-index": index },
                    }}
                    sx={{ "& input": { textAlign: "center", fontWeight: "bold" } }}
                  />
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={pile.notes}
                    onChange={(e) => updatePile(index, "notes", e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    placeholder="28. BOŞ FORAJ"
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      inputProps: { "data-pile-index": `${index}-notes` },
                    }}
                    sx={{ "& input": { fontSize: "0.9rem" } }}
                  />
                </TableCell>
                {cokluMakine &&
                  machineCols.map((m) => {
                    const checked = (pile.machineIds ?? []).includes(m.machineId)
                    return (
                      <TableCell key={m.machineId} sx={{ border: "1px solid #000", textAlign: "center", p: 0.25 }}>
                        <Checkbox
                          size="small"
                          checked={checked}
                          onChange={() => togglePileMachine(index, m.machineId)}
                          inputProps={{ "aria-label": m.machineName }}
                        />
                      </TableCell>
                    )
                  })}
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", p: 0.5 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={!!pile.concretePoured}
                        onChange={(e) => updatePile(index, "concretePoured", e.target.checked)}
                      />
                    }
                    label=""
                  />
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", p: 0.5 }}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removePile(index)}
                    disabled={data.length <= 1}
                    sx={{ minWidth: "auto", p: 0.5 }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addPile}
            sx={{
              backgroundColor: "#795548",
              color: "white",
              "&:hover": { backgroundColor: "#5d4037" },
            }}
          >
            {t("add_row")}
          </Button>
        </Box>

        <Box sx={{ mt: 2, p: 2, backgroundColor: "rgba(121, 85, 72, 0.1)", borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>{t("tip_prefix")}:</strong> {t("tip_pile_details")}
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
