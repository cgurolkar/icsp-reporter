"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Alert,
} from "@mui/material"
import { Construction } from "@mui/icons-material"
import { Machine, MachineSelection } from "@/types/form-data"
import { AVAILABLE_MACHINES } from "@/types/form-data"

interface MachineSelectionStepProps {
  data: MachineSelection
  onChange: (data: MachineSelection) => void
}

export default function MachineSelectionStep({ data, onChange }: MachineSelectionStepProps) {
  const handlePrimaryMachineSelect = (machine: Machine) => {
    console.log("Selected machine:", machine)
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
          Makine Seçimi
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Çalışma için kullanılacak kazık makinelerini seçin
        </Typography>

        {/* Ana Makine Seçimi */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Ana Makine Seçimi
          </Typography>
          
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {AVAILABLE_MACHINES.map((machine) => (
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
            <strong>Seçilen Makine:</strong> {data.selectedMachine.name}
          </Alert>
        )}

        {/* Ek Makineler Bilgisi */}
        <Alert severity="info" sx={{ mt: 2 }}>
          Ek makineler 2. adım sonrasında eklenebilir.
        </Alert>
      </CardContent>
    </Card>
  )
} 