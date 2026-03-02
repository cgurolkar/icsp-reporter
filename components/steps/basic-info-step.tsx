"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { TextField, Typography, Box, Paper, Button, Select, MenuItem, FormControl, InputLabel } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"
import type { BasicInfo, MachineBasicInfo } from "@/types/form-data"

interface SiteOption {
  id: number
  name: string
  code: string
}

export interface SiteSummaryForForm {
  totalPiles: number | null
  lastDate: string | null
  remainingPiles: string | null
  projectStartDate?: string | null
  isOngoing?: boolean
  initialPilesDone?: number | null
}

interface BasicInfoStepProps {
  data: BasicInfo
  onChange: (data: BasicInfo) => void
  currentMachineIndex: number
  currentMachine: MachineBasicInfo | null
  onMachineChange: (machineData: MachineBasicInfo) => void
  allMachines?: MachineBasicInfo[] // Tüm makinelerin bilgileri
  onAddMachine?: (machine: any) => void // Ek makine ekleme fonksiyonu
  onMachineIndexChange?: (index: number) => void // Makine indeksi değişikliği
  onSiteSummaryChange?: (summary: SiteSummaryForForm) => void
}

export default function BasicInfoStep({ 
  data, 
  onChange, 
  currentMachineIndex,
  currentMachine,
  onMachineChange,
  allMachines = [],
  onAddMachine,
  onMachineIndexChange,
  onSiteSummaryChange,
}: BasicInfoStepProps) {
  const { t } = useLanguage()
  const [sites, setSites] = useState<SiteOption[]>([])
  const [siteSummary, setSiteSummary] = useState<SiteSummaryForForm>({ totalPiles: null, lastDate: null, remainingPiles: null, projectStartDate: null, isOngoing: false, initialPilesDone: null })

  useEffect(() => {
    fetch("/api/sites")
      .then((res) => res.ok ? res.json() : [])
      .then((list: SiteOption[]) => setSites(list))
      .catch(() => setSites([]))
  }, [])

  useEffect(() => {
    if (data.siteId == null) {
      const empty: SiteSummaryForForm = { totalPiles: null, lastDate: null, remainingPiles: null, projectStartDate: null, isOngoing: false, initialPilesDone: null }
      setSiteSummary(empty)
      onSiteSummaryChange?.(empty)
      return
    }
    fetch(`/api/sites/${data.siteId}/last-report`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((d: { totalPiles?: number | null; lastDate?: string | null; remainingPiles?: string | null; projectStartDate?: string | null; isOngoing?: boolean; initialPilesDone?: number | null }) => {
        const next: SiteSummaryForForm = {
          totalPiles: d.totalPiles ?? null,
          lastDate: d.lastDate ?? null,
          remainingPiles: d.remainingPiles ?? null,
          projectStartDate: d.projectStartDate ?? null,
          isOngoing: d.isOngoing === true,
          initialPilesDone: d.initialPilesDone ?? null,
        }
        setSiteSummary(next)
        onSiteSummaryChange?.(next)
      })
      .catch(() => {
        const empty: SiteSummaryForForm = { totalPiles: null, lastDate: null, remainingPiles: null, projectStartDate: null, isOngoing: false, initialPilesDone: null }
        setSiteSummary(empty)
        onSiteSummaryChange?.(empty)
      })
  }, [data.siteId])

  const handleChange = (field: keyof BasicInfo) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...data,
      [field]: event.target.value,
    })
  }

  const handleMachineChange = (field: keyof MachineBasicInfo) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (currentMachine) {
      onMachineChange({
        ...currentMachine,
        [field]: event.target.value,
      })
    }
  }

  // Tüm makinelerin toplam değerlerini hesapla
  const totalMachineHours = allMachines.reduce((sum, m) => sum + (parseFloat(m.machineHours) || 0), 0)
  const totalUsedFuel = allMachines.reduce((sum, m) => sum + (parseFloat(m.usedFuel) || 0), 0)
  const totalChangedDiamondCount = allMachines.reduce((sum, m) => sum + (parseInt(m.changedDiamondCount) || 0), 0)

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "primary.main", fontWeight: 600, mb: 3 }}>
        {t("basic_info")} {currentMachine ? `- ${currentMachine.machineName}` : ""}
      </Typography>
      
      {/* Tarih ve Proje Bilgileri */}
      <Paper
        sx={{ p: 3, background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)", border: "1px solid #ff9800", mb: 3 }}
      >
        <Typography variant="subtitle1" gutterBottom sx={{ color: "#e65100", fontWeight: 600, mb: 2 }}>
          📅 Rapor tarihi ve şantiye
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 3 }}>
          <TextField
            fullWidth
            label={t("date")}
            type="date"
            value={data.date}
            onChange={handleChange("date")}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "#ff9800" },
              },
            }}
          />
          {sites.length > 0 && (
            <FormControl fullWidth sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "white" } }}>
              <InputLabel id="site-label">{t("site")}</InputLabel>
              <Select
                labelId="site-label"
                label={t("site")}
                value={data.siteId ?? ""}
                onChange={(e) => {
                  const raw = e.target.value
                  const id = raw === "" ? null : Number(raw)
                  const site = id != null ? sites.find((s) => s.id === id) : null
                  onChange({
                    ...data,
                    siteId: id,
                    siteName: site ? site.name : "",
                    project: site ? site.name : data.project,
                  })
                }}
              >
                <MenuItem value="">{t("select_please")}</MenuItem>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        {(siteSummary.totalPiles != null || siteSummary.remainingPiles != null || siteSummary.initialPilesDone != null) && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ color: "#e65100", fontWeight: 600, mb: 1.5 }}>
              {t("project_summary")}
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: "text.secondary", mb: 1 }}>
              {t("project_summary_caption")}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
              <TextField
                fullWidth
                label={t("project_status")}
                value={siteSummary.isOngoing ? t("status_ongoing") : t("status_new")}
                InputProps={{ readOnly: true }}
                size="small"
                sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#f5f5f5" } }}
              />
              {siteSummary.projectStartDate && (
                <TextField
                  fullWidth
                  label={t("project_start_date")}
                  value={String(siteSummary.projectStartDate).slice(0, 10)}
                  InputProps={{ readOnly: true }}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#f5f5f5" } }}
                />
              )}
              {siteSummary.totalPiles != null && (
                <TextField
                  fullWidth
                  label={t("total_piles_in_project")}
                  value={siteSummary.totalPiles}
                  InputProps={{ readOnly: true }}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#fff8e1" } }}
                />
              )}
              {siteSummary.isOngoing && siteSummary.initialPilesDone != null && (
                <TextField
                  fullWidth
                  label={t("initial_piles_done_label")}
                  value={siteSummary.initialPilesDone}
                  InputProps={{ readOnly: true }}
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#e3f2fd" } }}
                />
              )}
              {siteSummary.totalPiles != null && (() => {
                const remainingValid = siteSummary.remainingPiles != null && String(siteSummary.remainingPiles).trim() !== ""
                const initialDone = siteSummary.initialPilesDone != null
                const buguneKadar = remainingValid
                  ? siteSummary.totalPiles - (parseInt(siteSummary.remainingPiles!, 10) || 0)
                  : (initialDone ? siteSummary.initialPilesDone! : null)
                const kalan = remainingValid
                  ? siteSummary.remainingPiles
                  : (initialDone ? String(siteSummary.totalPiles - siteSummary.initialPilesDone!) : null)
                return (
                  <>
                    <TextField
                      fullWidth
                      label={t("done_until_today_excl")}
                      value={buguneKadar != null ? buguneKadar : "—"}
                      InputProps={{ readOnly: true }}
                      size="small"
                      sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#e3f2fd" } }}
                    />
                    <TextField
                      fullWidth
                      label={t("remaining_piles_last_report")}
                      value={kalan != null ? kalan : "—"}
                      InputProps={{ readOnly: true }}
                      size="small"
                      sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#e8f5e9" } }}
                    />
                  </>
                )
              })()}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Toplam Değerler */}
      {allMachines.length > 1 && (
        <Paper
          sx={{ p: 3, background: "linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)", border: "1px solid #4caf50", mb: 3 }}
        >
          <Typography variant="subtitle1" gutterBottom sx={{ color: "#2e7d32", fontWeight: 600, mb: 2 }}>
            📊 {t("all_machines_totals")}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 3 }}>
            <TextField
              fullWidth
              label={t("total_machine_hours")}
              value={totalMachineHours.toFixed(2)}
              InputProps={{ readOnly: true }}
              sx={{
                backgroundColor: "#f1f8e9",
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#f1f8e9",
                },
              }}
            />
            <TextField
              fullWidth
              label={t("total_fuel_used")}
              value={totalUsedFuel.toFixed(2)}
              InputProps={{ readOnly: true }}
              sx={{
                backgroundColor: "#f1f8e9",
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#f1f8e9",
                },
              }}
            />
            <TextField
              fullWidth
              label={t("total_diamond_changed")}
              value={totalChangedDiamondCount}
              InputProps={{ readOnly: true }}
              sx={{
                backgroundColor: "#f1f8e9",
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "#f1f8e9",
                },
              }}
            />
          </Box>
        </Paper>
      )}

      {/* Makine Bilgileri */}
      <Paper
        sx={{ p: 3, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", border: "1px solid #2196f3" }}
      >
        <Typography variant="subtitle1" gutterBottom sx={{ color: "#1565c0", fontWeight: 600, mb: 2 }}>
          🔧 {t("machine_info_title")}
        </Typography>
        
        {/* Makine Seçimi */}
        {allMachines.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>{t("select_machine")}</InputLabel>
              <Select
                value={currentMachineIndex}
                onChange={(e) => {
                  const newIndex = e.target.value as number
                  if (onMachineIndexChange) {
                    onMachineIndexChange(newIndex)
                  }
                }}
                label={t("select_machine")}
                sx={{
                  backgroundColor: "white",
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "white",
                  },
                }}
              >
                {allMachines.map((machine, index) => (
                  <MenuItem key={index} value={index}>
                    {machine.machineName || `${t("machine_n")} ${index + 1}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
        
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 3 }}>
          <TextField
            fullWidth
            label={t("machine_hours")}
            type="number"
            value={currentMachine?.machineHours || ""}
            onChange={handleMachineChange("machineHours")}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "primary.main" },
              },
            }}
          />
          <TextField
            fullWidth
            label={t("fuel_used_litre")}
            type="number"
            value={currentMachine?.usedFuel || ""}
            onChange={handleMachineChange("usedFuel")}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "primary.main" },
              },
            }}
          />
          <TextField
            fullWidth
            label="Değişen Elmas Sayısı"
            type="number"
            value={currentMachine?.changedDiamondCount || ""}
            onChange={handleMachineChange("changedDiamondCount")}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "primary.main" },
              },
            }}
          />
          <TextField
            fullWidth
            label={t("machine_note")}
            multiline
            minRows={2}
            value={currentMachine?.note || ""}
            onChange={handleMachineChange("note")}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "primary.main" },
              },
            }}
          />
        </Box>
      </Paper>
    </Box>
  )
}
