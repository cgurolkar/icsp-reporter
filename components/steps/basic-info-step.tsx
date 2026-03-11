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
  lockedSiteId?: number // Kullanıcı/Personel: sadece atandığı şantiye (değiştirilemez)
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
  lockedSiteId,
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

  const handleMachineChange = (_field: keyof MachineBasicInfo) => (_event: React.ChangeEvent<HTMLInputElement>) => {
    // Makine saati, mazot, imalat, not artık sadece operatör girişinde; proje bilgi girişinde kaldırıldı
  }

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
                disabled={lockedSiteId != null}
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

      {/* Makine saati, mazot, yaptığı imalat ve makine notu artık sadece operatör girişinde (Makine girişi) yapılır; rapora operatör verileri eklenir. */}
    </Box>
  )
}
