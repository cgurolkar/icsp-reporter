"use client"

import type React from "react"
import { useState } from "react"
import { 
  TextField, 
  Typography, 
  Box, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from "@mui/material"
import { Add } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { MachineProductionSummary, Machine } from "@/types/form-data"

// Geçici olarak makine listesi
const AVAILABLE_MACHINES: Machine[] = [
  { id: "1", name: "XCMG SR220", type: "Drill Rig" },
  { id: "2", name: "SANY 285", type: "Drill Rig" },
  { id: "3", name: "BAUER BG 25", type: "Drill Rig" },
  { id: "4", name: "SOILMEC R-625", type: "Drill Rig" },
]

interface ProductionSummaryStepProps {
  data: MachineProductionSummary[]
  onChange: (data: MachineProductionSummary[]) => void
  currentMachineIndex: number
  additionalMachines: Machine[]
  onAddMachine: (machine: Machine) => void
  onMachineIndexChange?: (index: number) => void // Makine indeksi değişikliği
}

export default function ProductionSummaryStep({ 
  data, 
  onChange, 
  currentMachineIndex,
  additionalMachines,
  onAddMachine,
  onMachineIndexChange
}: ProductionSummaryStepProps) {
  const { t } = useLanguage()
  const [showAddMachineDialog, setShowAddMachineDialog] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState("")

  const currentMachine = data[currentMachineIndex]
  const allMachines = [data[0]?.machineName, ...additionalMachines.map(m => m.name)].filter(Boolean)

  // O gün yapılan kazık sayısı = toplam Beton Dökülen (tek kaynak; ilk makineye yazılır)
  const dailyPileCount = data.length > 0 ? String((parseInt(data[0].concretePoured, 10) || 0) + data.slice(1).reduce((s, m) => s + (parseInt(m.concretePoured, 10) || 0), 0)) : ""

  const handleDailyPileCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    const num = value.trim() === "" ? "" : value
    const updatedData = data.map((m, i) => ({
      ...m,
      concretePoured: i === 0 ? num : m.concretePoured,
      dailyPileCount: i === 0 ? num : (m as any).dailyPileCount ?? "",
    }))
    onChange(updatedData)
  }

  const handleChange = (field: keyof MachineProductionSummary) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const updatedData = [...data]
    updatedData[currentMachineIndex] = {
      ...updatedData[currentMachineIndex],
      [field]: event.target.value,
    }
    onChange(updatedData)
  }

  const handleAddMachine = () => {
    if (selectedMachineId) {
      const machine = AVAILABLE_MACHINES.find(m => m.id === selectedMachineId)
      if (machine) {
        onAddMachine(machine)
        setSelectedMachineId("")
        setShowAddMachineDialog(false)
      }
    }
  }

  if (!currentMachine) {
    return (
      <Box>
        <Alert severity="error">
          {t("no_machine_info")}
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "info.main", fontWeight: 600, mb: 3 }}>
        {t("production_summary")} - {currentMachine?.machineName || t("no_machine_selected")}
      </Typography>
      
      {/* Makine Seçimi */}
      {data.length > 0 && (
        <Paper sx={{ p: 3, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", border: "1px solid #2196f3", mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ color: "#1565c0", fontWeight: 600, mb: 2 }}>
            🔧 {t("machine_selection_title")}
          </Typography>
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
              {data.map((machine, index) => (
                <MenuItem key={index} value={index}>
                  {machine.machineName || `${t("machine_n")} ${index + 1}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
      )}
      
      <Paper sx={{ p: 3, background: "linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)", border: "1px solid #03a9f4" }}>
        {/* O gün yapılan kazık sayısı = Beton Dökülen Kazık (Ad.) ile aynı */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label={t("daily_pile_count_label")}
            value={dailyPileCount}
            onChange={handleDailyPileCountChange}
            helperText={t("helper_beton_pile")}
            sx={{
              maxWidth: 320,
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "info.main" },
              },
            }}
          />
        </Box>
        {/* Form Fields */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 3 }}>
          <TextField
            fullWidth
            label={t("total_production")}
            value={currentMachine.totalProduction}
            onChange={handleChange("totalProduction")}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "info.main" },
              },
            }}
          />
          <TextField
            fullWidth
            label={t("empty_borehole")}
            value={currentMachine.emptyBorehole}
            onChange={handleChange("emptyBorehole")}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "info.main" },
              },
            }}
          />
          <TextField
            fullWidth
            label={t("pre_borehole")}
            value={currentMachine.preBorehole}
            onChange={handleChange("preBorehole")}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "info.main" },
              },
            }}
          />
          <TextField
            fullWidth
            label={t("concrete_pile_count")}
            value={currentMachine.concretePoured}
            onChange={handleChange("concretePoured")}
            placeholder={dailyPileCount || t("same_as_daily")}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "&:hover fieldset": { borderColor: "info.main" },
              },
            }}
          />
        </Box>

        {/* Preview Table */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: "info.main" }}>
            {t("preview")}:
          </Typography>
          <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "white" }}>
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  {t("total_production")}
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {currentMachine.totalProduction}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  {t("empty_borehole")}
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {currentMachine.emptyBorehole}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  {t("pre_borehole")}
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {currentMachine.preBorehole}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  {t("total_concrete_piles")}
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {currentMachine.concretePoured}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {/* Tüm Makinelerin Toplam Değerleri */}
        {data.length > 1 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: "success.main" }}>
              📊 {t("all_machines_totals")}
            </Typography>
            <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "#f1f8e9" }}>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#c8e6c9" }}>
                    {t("total_production_summary_label")}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {data.reduce((sum, m) => sum + (parseFloat(m.totalProduction) || 0), 0).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#c8e6c9" }}>
                    {t("total_empty_borehole")}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {data.reduce((sum, m) => sum + (parseInt(m.emptyBorehole) || 0), 0)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#c8e6c9" }}>
                    {t("total_pre_borehole")}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {data.reduce((sum, m) => sum + (parseInt(m.preBorehole) || 0), 0)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#c8e6c9" }}>
                    {t("total_concrete_piles")}
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {data.reduce((sum, m) => sum + (parseInt(m.concretePoured) || 0), 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>

      {/* Makine Ekleme Dialog */}
      <Dialog open={showAddMachineDialog} onClose={() => setShowAddMachineDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("add_extra_machine")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("select_extra_machine")}
          </Typography>
          <FormControl fullWidth>
            <InputLabel>{t("select_machine")}</InputLabel>
            <Select
              value={selectedMachineId}
              label={t("select_machine")}
              onChange={(e) => setSelectedMachineId(e.target.value)}
            >
              {AVAILABLE_MACHINES
                .filter(machine => 
                  machine.id !== data[0]?.machineId && 
                  !additionalMachines.find(m => m.id === machine.id)
                )
                .map((machine) => (
                  <MenuItem key={machine.id} value={machine.id}>
                    {machine.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddMachineDialog(false)}>{t("cancel")}</Button>
          <Button 
            onClick={handleAddMachine} 
            variant="contained"
            disabled={!selectedMachineId}
          >
            {t("add")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
} 