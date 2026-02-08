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

interface BasicInfoStepProps {
  data: BasicInfo
  onChange: (data: BasicInfo) => void
  currentMachineIndex: number
  currentMachine: MachineBasicInfo | null
  onMachineChange: (machineData: MachineBasicInfo) => void
  allMachines?: MachineBasicInfo[] // Tüm makinelerin bilgileri
  onAddMachine?: (machine: any) => void // Ek makine ekleme fonksiyonu
  onMachineIndexChange?: (index: number) => void // Makine indeksi değişikliği
}

export default function BasicInfoStep({ 
  data, 
  onChange, 
  currentMachineIndex,
  currentMachine,
  onMachineChange,
  allMachines = [],
  onAddMachine,
  onMachineIndexChange
}: BasicInfoStepProps) {
  const { t } = useLanguage()
  const [sites, setSites] = useState<SiteOption[]>([])
  const [siteSummary, setSiteSummary] = useState<{ totalPiles: number | null; lastDate: string | null; remainingPiles: string | null }>({ totalPiles: null, lastDate: null, remainingPiles: null })

  useEffect(() => {
    fetch("/api/sites")
      .then((res) => res.ok ? res.json() : [])
      .then((list: SiteOption[]) => setSites(list))
      .catch(() => setSites([]))
  }, [])

  useEffect(() => {
    if (data.siteId == null) {
      setSiteSummary({ totalPiles: null, lastDate: null, remainingPiles: null })
      return
    }
    fetch(`/api/sites/${data.siteId}/last-report`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((d: { totalPiles?: number | null; lastDate?: string | null; remainingPiles?: string | null }) =>
        setSiteSummary({
          totalPiles: d.totalPiles ?? null,
          lastDate: d.lastDate ?? null,
          remainingPiles: d.remainingPiles ?? null,
        })
      )
      .catch(() => setSiteSummary({ totalPiles: null, lastDate: null, remainingPiles: null }))
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
              <InputLabel id="site-label">Şantiye</InputLabel>
              <Select
                labelId="site-label"
                label="Şantiye"
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
                <MenuItem value="">Seçiniz</MenuItem>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        {(siteSummary.totalPiles != null || siteSummary.remainingPiles != null) && (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2, mt: 2 }}>
            {siteSummary.totalPiles != null && (
              <TextField
                fullWidth
                label="Projedeki toplam kazık sayısı"
                value={siteSummary.totalPiles}
                InputProps={{ readOnly: true }}
                size="small"
                sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#fff8e1" } }}
              />
            )}
            {siteSummary.lastDate != null && siteSummary.remainingPiles != null && (
              <TextField
                fullWidth
                label={`Önceki günden kalan (${siteSummary.lastDate})`}
                value={siteSummary.remainingPiles}
                InputProps={{ readOnly: true }}
                size="small"
                sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "#e8f5e9" } }}
              />
            )}
          </Box>
        )}
      </Paper>

      {/* Toplam Değerler */}
      {allMachines.length > 1 && (
        <Paper
          sx={{ p: 3, background: "linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)", border: "1px solid #4caf50", mb: 3 }}
        >
          <Typography variant="subtitle1" gutterBottom sx={{ color: "#2e7d32", fontWeight: 600, mb: 2 }}>
            📊 Tüm Makinelerin Toplam Değerleri
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 3 }}>
            <TextField
              fullWidth
              label="Toplam Makine Saat"
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
              label="Toplam Kullanılan Mazot (Litre)"
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
              label="Toplam Değişen Elmas Sayısı"
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
          🔧 Makine Bilgileri
        </Typography>
        
        {/* Makine Seçimi */}
        {allMachines.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Makine Seçin</InputLabel>
              <Select
                value={currentMachineIndex}
                onChange={(e) => {
                  const newIndex = e.target.value as number
                  if (onMachineIndexChange) {
                    onMachineIndexChange(newIndex)
                  }
                  console.log("Makine seçimi değişti:", newIndex)
                }}
                label="Makine Seçin"
                sx={{
                  backgroundColor: "white",
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "white",
                  },
                }}
              >
                {allMachines.map((machine, index) => (
                  <MenuItem key={index} value={index}>
                    {machine.machineName || `Makine ${index + 1}`}
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
            label="Kullanılan Mazot (Litre)"
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
            label="Makine Notu"
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
