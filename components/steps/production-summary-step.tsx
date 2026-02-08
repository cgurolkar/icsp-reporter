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
          Makine bilgisi bulunamadı. Lütfen makine seçimi yapın.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "info.main", fontWeight: 600, mb: 3 }}>
        {t("production_summary")} - {currentMachine?.machineName || "Makine Seçilmedi"}
      </Typography>
      
      {/* Makine Seçimi */}
      {data.length > 0 && (
        <Paper sx={{ p: 3, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", border: "1px solid #2196f3", mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ color: "#1565c0", fontWeight: 600, mb: 2 }}>
            🔧 Makine Seçimi
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Makine Seçin</InputLabel>
            <Select
              value={currentMachineIndex}
              onChange={(e) => {
                const newIndex = e.target.value as number
                if (onMachineIndexChange) {
                  onMachineIndexChange(newIndex)
                }
                console.log("Üretim özeti - Makine seçimi değişti:", newIndex)
              }}
              label="Makine Seçin"
              sx={{
                backgroundColor: "white",
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "white",
                },
              }}
            >
              {data.map((machine, index) => (
                <MenuItem key={index} value={index}>
                  {machine.machineName || `Makine ${index + 1}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
      )}
      
      <Paper sx={{ p: 3, background: "linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)", border: "1px solid #03a9f4" }}>
        {/* Form Fields */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 3 }}>
          <TextField
            fullWidth
            label="İmalat Miktarı (m)"
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
            label="Boş Foraj (Adet)"
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
            label="Ön Foraj (Adet)"
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
            label="Beton Dökülen Kazık Sayısı"
            value={currentMachine.concretePoured}
            onChange={handleChange("concretePoured")}
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
                  İmalat Miktarı (m)
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {currentMachine.totalProduction}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  Boş Foraj (Adet)
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {currentMachine.emptyBorehole}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  Ön Foraj (Adet)
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {currentMachine.preBorehole}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  Beton Dökülen Kazık Sayısı
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
              📊 Tüm Makinelerin Toplam Değerleri
            </Typography>
            <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "#f1f8e9" }}>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#c8e6c9" }}>
                    Toplam İmalat Miktarı (m)
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {data.reduce((sum, m) => sum + (parseFloat(m.totalProduction) || 0), 0).toFixed(2)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#c8e6c9" }}>
                    Toplam Boş Foraj (Adet)
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {data.reduce((sum, m) => sum + (parseInt(m.emptyBorehole) || 0), 0)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#c8e6c9" }}>
                    Toplam Ön Foraj (Adet)
                  </TableCell>
                  <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                    {data.reduce((sum, m) => sum + (parseInt(m.preBorehole) || 0), 0)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#c8e6c9" }}>
                    Toplam Beton Dökülen Kazık Sayısı
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
        <DialogTitle>Ek Makine Ekle</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ek olarak kullanılacak makineyi seçin
          </Typography>
          <FormControl fullWidth>
            <InputLabel>Makine Seçin</InputLabel>
            <Select
              value={selectedMachineId}
              label="Makine Seçin"
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
          <Button onClick={() => setShowAddMachineDialog(false)}>İptal</Button>
          <Button 
            onClick={handleAddMachine} 
            variant="contained"
            disabled={!selectedMachineId}
          >
            Ekle
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
} 