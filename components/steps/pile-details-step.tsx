"use client"

import type React from "react"
import { useState, useEffect } from "react"

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
} from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { PileDetail, MachineProductionSummary } from "@/types/form-data"

interface PileDetailsStepProps {
  data: PileDetail[]
  onChange: (data: PileDetail[]) => void
  productionSummary?: MachineProductionSummary[]
  /** Şantiye proje özetinden gelen toplam kazık (yoksa ayarlardan alınır) */
  projectTotalPiles?: number
  /** Bugünden önce yapılan toplam kazık sayısı (son rapordaki kalan üzerinden hesaplanır) */
  totalCompletedBeforeToday?: number
}

export default function PileDetailsStep({ data, onChange, productionSummary = [], projectTotalPiles: projectTotalFromProps, totalCompletedBeforeToday = 0 }: PileDetailsStepProps) {
  const { t } = useLanguage()
  const [projectTotalFromSettings, setProjectTotalFromSettings] = useState<number>(120)

  // Şantiye seçilmemişse yönetici panelinden toplam kazık sayısını al
  useEffect(() => {
    if (projectTotalFromProps != null) return
    const loadProjectSettings = async () => {
      try {
        const response = await fetch("/api/admin/settings")
        if (response.ok) {
          const settings = await response.json()
          setProjectTotalFromSettings(parseInt(settings.totalPiles) || 120)
        }
      } catch (error) {
        console.error("Error loading project settings:", error)
      }
    }
    loadProjectSettings()
  }, [projectTotalFromProps])

  const projectTotalPiles = projectTotalFromProps ?? projectTotalFromSettings

  // Tüm makinelerin toplam değerlerini hesapla
  const totalProduction = productionSummary.reduce((sum, m) => sum + (parseFloat(m.totalProduction) || 0), 0)
  const totalEmptyBorehole = productionSummary.reduce((sum, m) => sum + (parseInt(m.emptyBorehole) || 0), 0)
  const totalPreBorehole = productionSummary.reduce((sum, m) => sum + (parseInt(m.preBorehole) || 0), 0)
  const dailyPiles = productionSummary.reduce((sum, m) => sum + (parseInt(m.concretePoured) || 0), 0)

  // Bugüne kadar (bugün dahil) = son rapor sonu itibarıyla yapılan + bugün yapılan
  const totalCompletedIncludingToday = totalCompletedBeforeToday + dailyPiles
  // Kalan kazık = proje toplam − bugüne kadar (bugün dahil)
  const remainingPiles = projectTotalPiles - totalCompletedIncludingToday

  const addPile = () => {
    const newPileNumber = Math.max(...data.map((p) => p.pileNumber), 0) + 1
    onChange([...data, { pileNumber: newPileNumber, drilled: "", notes: "" }])
  }

  const removePile = (index: number) => {
    if (data.length > 1) {
      onChange(data.filter((_, i) => i !== index))
    }
  }

  const updatePile = (index: number, field: keyof PileDetail, value: string | number) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    onChange(newData)
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

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "warning.main", fontWeight: 600, mb: 3 }}>
        {t("pile_details_form_title")}
      </Typography>
      <Paper sx={{ p: 3, background: "linear-gradient(135deg, #fffde7 0%, #ffe082 100%)", border: "1px solid #ffb300", mb: 3 }}>
        {/* Toplam Değerler */}
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 3 }}>
          <TextField
            label={t("total_piles_in_project")}
            value={projectTotalPiles}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 200, backgroundColor: "#fffde7" }}
          />
          <TextField
            label={t("done_until_today_excl_short")}
            value={totalCompletedBeforeToday}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 220, backgroundColor: "#e3f2fd" }}
          />
          <TextField
            label={t("daily_pile_count_label")}
            value={dailyPiles}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 200, backgroundColor: "#fffde7" }}
          />
          <TextField
            label={t("done_until_today_incl")}
            value={totalCompletedIncludingToday}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 220, backgroundColor: "#e3f2fd" }}
          />
          <TextField
            label={t("remaining_piles_count")}
            value={remainingPiles}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 200, backgroundColor: "#e8f5e9" }}
          />
          <TextField
            label={t("total_production")}
            value={totalProduction.toFixed(2)}
            InputProps={{ readOnly: true }}
            sx={{ minWidth: 200, backgroundColor: "#fffde7" }}
          />
        </Box>

        {detayEksik && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t("pile_details_warning").replace(/\{count\}/g, String(yapilanKazikSayisi)).replace(/\{entered\}/g, String(doldurulanDetaySayisi))}
          </Alert>
        )}

        {/* Makine Detayları */}
        {productionSummary.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ color: "#e65100", fontWeight: 600, mb: 2 }}>
              📊 {t("machine_details_title")}
            </Typography>
            <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "white" }}>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                    {t("machine")}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                    {t("total_production")}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                    {t("empty_borehole")}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                    {t("pre_borehole")}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                    {t("concrete_poured_short")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {productionSummary.map((machine, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                      {machine.machineName}
                    </TableCell>
                    <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                      {machine.totalProduction || "0"}
                    </TableCell>
                    <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                      {machine.emptyBorehole || "0"}
                    </TableCell>
                    <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                      {machine.preBorehole || "0"}
                    </TableCell>
                    <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                      {machine.concretePoured || "0"}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Toplam Satırı */}
                <TableRow sx={{ backgroundColor: "#f9f9f9" }}>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {t("total").toUpperCase()}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {totalProduction.toFixed(2)}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {totalEmptyBorehole}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {totalPreBorehole}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {dailyPiles}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Kazık Detayları Formu */}
        <Typography variant="subtitle1" gutterBottom sx={{ color: "#e65100", fontWeight: 600, mb: 2 }}>
          📝 {t("pile_details_form_title")}
        </Typography>
        <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "white", mb: 3 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                {t("pile_short").toUpperCase()}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "25%" }}>
                {t("drilled_short").toUpperCase()}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "50%" }}>
                {t("notes").toUpperCase()}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "10%" }}>
                {t("action").toUpperCase()}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((pile, index) => (
              <TableRow key={index}>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {pile.pileNumber}
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
