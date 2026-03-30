"use client"

import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
} from "@mui/material"
import { Construction } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import { Machine, MachineSelection, AVAILABLE_MACHINES } from "@/types/form-data"

interface MachineSelectionStepProps {
  data: MachineSelection
  onChange: (data: MachineSelection) => void
  /** Şantiyeye atanmış makineler; boşsa sabit liste kullanılır */
  machines?: Machine[]
}

export default function MachineSelectionStep({ data, onChange, machines }: MachineSelectionStepProps) {
  const { t } = useLanguage()
  const list = machines && machines.length > 0 ? machines : AVAILABLE_MACHINES

  const handlePrimaryMachineSelect = (machine: Machine) => {
    onChange({
      ...data,
      selectedMachine: machine,
    })
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h5" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Construction color="primary" />
          {t("machine_selection")}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {t("machine_selection_subtitle")}
        </Typography>
        {machines && machines.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>Önce bir sonraki adımda şantiye seçin; şantiyedeki makineler yüklendiğinde bu liste güncellenir.</Alert>
        )}

        {/* Ana Makine Seçimi */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t("main_machine_selection")}
          </Typography>
          
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {list.map((machine) => (
              <Button
                key={machine.id}
                variant={data.selectedMachine?.id === machine.id ? "contained" : "outlined"}
                size="large"
                onClick={() => handlePrimaryMachineSelect(machine)}
                sx={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                  py: 2,
                  px: 3,
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  minHeight: "60px",
                  "&:hover": {
                    backgroundColor: data.selectedMachine?.id === machine.id ? "primary.dark" : "primary.light",
                  },
                }}
              >
                <Box sx={{ textAlign: "left", width: "100%" }}>
                  <Typography variant="h6" component="div">
                    {machine.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {machine.type}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Box>
        </Box>

        {/* Seçim Durumu */}
        {data.selectedMachine && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <strong>{t("selected_machine_label")}:</strong> {data.selectedMachine.name}
          </Alert>
        )}

        {/* Ek Makineler Bilgisi */}
        <Alert severity="info" sx={{ mt: 2 }}>
          {t("extra_machines_note")}
        </Alert>
      </CardContent>
    </Card>
  )
} 