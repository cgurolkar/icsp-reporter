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
  Select,
  MenuItem,
  FormControl,
} from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { PileDetail, MachineProductionSummary, SitePileRateOption } from "@/types/form-data"

interface PileDetailsStepProps {
  data: PileDetail[]
  onChange: (data: PileDetail[]) => void
  productionSummary?: MachineProductionSummary[]
  /** Şantiye toplam beton dökülen kazık (üretim özeti) */
  siteConcretePouredPiles?: string
  /** Şantiye çap tarifeleri (fiyatlar olmadan) */
  pileRateOptions?: SitePileRateOption[]
}

export default function PileDetailsStep({
  data,
  onChange,
  productionSummary = [],
  siteConcretePouredPiles = "",
  pileRateOptions = [],
}: PileDetailsStepProps) {
  const { t } = useLanguage()

  const betonToplam = parseInt(String(siteConcretePouredPiles ?? "").trim(), 10) || 0
  const dailyPiles = betonToplam

  const machineCols = productionSummary.filter((m) => m.machineId)
  const singleMachineId = machineCols.length === 1 ? machineCols[0].machineId : null
  const hasRates = pileRateOptions.length > 0
  const siteHasDualPrice = pileRateOptions.some((o) => o.hasSecondary === true)
  const defaultRateId = hasRates ? String(pileRateOptions[0].id) : ""
  const rateById = (id: string | number | null | undefined) =>
    pileRateOptions.find((o) => String(o.id) === String(id ?? ""))

  const addPile = () => {
    const newPileNumber = Math.max(...data.map((p) => p.pileNumber), 0) + 1
    onChange([
      ...data,
      {
        pileNumber: newPileNumber,
        drilled: "",
        notes: "",
        machineIds: singleMachineId ? [singleMachineId] : [],
        diameterRateId: defaultRateId || "",
        priceTier: siteHasDualPrice ? "" : "primary",
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
      if (index === data.length - 1) {
        addPile()
      }
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
  const betonCapEksik =
    hasRates && betonluSatirlar.some((p) => p.diameterRateId == null || String(p.diameterRateId).trim() === "")
  const betonCinsEksik =
    siteHasDualPrice &&
    betonluSatirlar.some((p) => {
      const rate = rateById(p.diameterRateId)
      if (!rate?.hasSecondary) return false
      return p.priceTier !== "primary" && p.priceTier !== "secondary"
    })

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
        {betonCapEksik && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Beton döküldü işaretli satırlarda kazık çapını seçin.
          </Alert>
        )}
        {betonCinsEksik && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Bu şantiyede 1. ve 2. birim fiyat var. Beton döküldü satırlarında <strong>kazık cinsi</strong> (1. fiyat / 2. fiyat)
            seçilmelidir; aksi halde hakediş hesaplanamaz.
          </Alert>
        )}
        <Alert severity="info" sx={{ mb: 2 }}>
          «Beton döküldü» işaretli satırların Delinen (m) toplamı, Üretim Özeti’ndeki <strong>Toplam boy</strong> alanına yazılır
          {hasRates ? "; çap seçimi hakediş için zorunludur" : ""}
          {siteHasDualPrice ? "; çift fiyatlı tarifede <strong>kazık cinsi</strong> (1. / 2. fiyat) seçilmelidir" : ""}.
        </Alert>

        <Typography variant="subtitle1" gutterBottom sx={{ color: "#e65100", fontWeight: 600, mb: 2 }}>
          {t("pile_details_form_title")}
        </Typography>
        <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <Table
            size="small"
            sx={{
              border: "2px solid #000",
              backgroundColor: "white",
              mb: 3,
              minWidth: hasRates ? (siteHasDualPrice ? 820 : 720) : 520,
            }}
          >
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                  {t("pile_short").toUpperCase()}
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                  {t("drilled_short").toUpperCase()}
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                  {t("notes").toUpperCase()}
                </TableCell>
                {hasRates && (
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", minWidth: 110 }}>
                    ÇAP
                  </TableCell>
                )}
                {siteHasDualPrice && (
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", minWidth: 130 }}>
                    KAZIK CİNSİ
                  </TableCell>
                )}
                {cokluMakine &&
                  machineCols.map((m) => (
                    <TableCell
                      key={m.machineId}
                      sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", minWidth: 72, fontSize: "0.7rem" }}
                    >
                      {m.machineName}
                    </TableCell>
                  ))}
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                  Beton döküldü
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                  {t("action").toUpperCase()}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((pile, index) => {
                const selectedRate = rateById(pile.diameterRateId)
                const rowNeedsCins = siteHasDualPrice && selectedRate?.hasSecondary === true
                return (
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
                    {hasRates && (
                      <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                        <FormControl fullWidth size="small" variant="standard">
                          <Select
                            displayEmpty
                            value={pile.diameterRateId != null ? String(pile.diameterRateId) : ""}
                            onChange={(e) => {
                              const v = e.target.value
                              const next = rateById(v)
                              const newData = [...data]
                              newData[index] = {
                                ...newData[index],
                                diameterRateId: v,
                                priceTier: next?.hasSecondary
                                  ? newData[index].priceTier === "secondary" || newData[index].priceTier === "primary"
                                    ? newData[index].priceTier
                                    : ""
                                  : "primary",
                              }
                              onChange(newData)
                            }}
                            disableUnderline
                            sx={{ fontSize: "0.85rem", "& .MuiSelect-select": { py: 0.5, textAlign: "center" } }}
                          >
                            <MenuItem value="">
                              <em>Seç</em>
                            </MenuItem>
                            {pileRateOptions.map((opt) => (
                              <MenuItem key={opt.id} value={String(opt.id)}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                    )}
                    {siteHasDualPrice && (
                      <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                        <FormControl fullWidth size="small" variant="standard">
                          <Select
                            displayEmpty
                            value={
                              selectedRate?.hasSecondary
                                ? pile.priceTier === "primary" || pile.priceTier === "secondary"
                                  ? pile.priceTier
                                  : ""
                                : "primary"
                            }
                            disabled={!!selectedRate && !selectedRate.hasSecondary}
                            onChange={(e) => updatePile(index, "priceTier", e.target.value)}
                            disableUnderline
                            sx={{ fontSize: "0.85rem", "& .MuiSelect-select": { py: 0.5, textAlign: "center" } }}
                          >
                            {rowNeedsCins && (
                              <MenuItem value="">
                                <em>Seçin</em>
                              </MenuItem>
                            )}
                            <MenuItem value="primary">1. fiyat</MenuItem>
                            {(rowNeedsCins || !selectedRate) && <MenuItem value="secondary">2. fiyat</MenuItem>}
                          </Select>
                        </FormControl>
                      </TableCell>
                    )}
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
                            onChange={(e) => {
                              const checked = e.target.checked
                              const newData = [...data]
                              const rate = rateById(newData[index].diameterRateId) ?? rateById(defaultRateId)
                              newData[index] = {
                                ...newData[index],
                                concretePoured: checked,
                                ...(checked && hasRates && !newData[index].diameterRateId
                                  ? {
                                      diameterRateId: defaultRateId,
                                      priceTier: rate?.hasSecondary ? "" : "primary",
                                    }
                                  : {}),
                              }
                              onChange(newData)
                            }}
                          />
                        }
                        label=""
                        sx={{ m: 0 }}
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
                )
              })}
            </TableBody>
          </Table>
        </Box>

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
