"use client"

import React, { useEffect } from "react"

import {
  Grid,
  TextField,
  Typography,
  Box,
  Paper,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { Fuel, Machine } from "@/types/form-data"

interface FuelStepProps {
  data: Fuel
  onChange: (data: Fuel) => void
  selectedMachine: Machine | null
  additionalMachines: Machine[]
}

const emptyFuelMachine = { name: "", shift: "", incoming: "", remaining: "", used: "" }

export default function FuelStep({ data, onChange, selectedMachine, additionalMachines }: FuelStepProps) {
  const { t } = useLanguage()
  const machines = Array.isArray(data.machines) && data.machines.length > 0 ? data.machines : [emptyFuelMachine]

  // Tabloda en az bir satır olsun
  useEffect(() => {
    if (!Array.isArray(data.machines) || data.machines.length === 0) {
      onChange({ ...data, machines: [emptyFuelMachine] })
    }
  }, [])

  // Makine seçimi sonrası otomatik olarak makine adlarını doldur (sadece tek boş satır varken)
  useEffect(() => {
    if (selectedMachine && machines.length === 1 && machines[0].name === "") {
      const allMachines = [selectedMachine, ...(additionalMachines || [])]
      const updatedMachines = allMachines.map(machine => ({
        name: machine.name,
        shift: "",
        incoming: "",
        remaining: "",
        used: "",
      }))
      onChange({
        ...data,
        machines: updatedMachines,
      })
    }
  }, [selectedMachine, additionalMachines])

  const addMachine = () => {
    onChange({
      ...data,
      machines: [...machines, { name: "", shift: "", incoming: "", remaining: "", used: "" }],
    })
  }

  const removeMachine = (index: number) => {
    if (machines.length > 1) {
      onChange({
        ...data,
        machines: machines.filter((_, i) => i !== index),
      })
    }
  }

  const updateMachine = (index: number, field: string, value: string) => {
    const newMachines = [...machines]
    newMachines[index] = { ...newMachines[index], [field]: value }
    onChange({
      ...data,
      machines: newMachines,
    })
  }

  const handleKeyPress = (event: React.KeyboardEvent, index: number, field: string) => {
    if (event.key === "Enter") {
      event.preventDefault()
      const fields = ["name", "shift", "incoming", "remaining", "used"]
      const currentFieldIndex = fields.indexOf(field)

      if (currentFieldIndex < fields.length - 1) {
        const nextField = fields[currentFieldIndex + 1]
        const nextInput = document.querySelector(
          `input[data-machine-index="${index}-${nextField}"]`,
        ) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
        }
      } else if (index === machines.length - 1) {
        addMachine()
        setTimeout(() => {
          const nextInput = document.querySelector(`input[data-machine-index="${index + 1}-name"]`) as HTMLInputElement
          if (nextInput) {
            nextInput.focus()
          }
        }, 100)
      } else {
        const nextInput = document.querySelector(`input[data-machine-index="${index + 1}-name"]`) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
        }
      }
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "secondary.main", fontWeight: 600, mb: 3 }}>
        {t("fuel")}
      </Typography>
      <Paper
        sx={{ p: 3, background: "linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)", border: "1px solid #e91e63" }}
      >
        {/* Machine Fuel Table */}
        <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "white", mb: 3 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "20%" }}>
                MAKİNE
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                DEVİR
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                GELEN
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                KALAN
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                KULLANILAN
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "10%" }}>
                İŞLEM
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {machines.map((machine, index) => (
              <TableRow key={index}>
                <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={machine.name}
                    onChange={(e) => updateMachine(index, "name", e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, index, "name")}
                    placeholder="Makine Adı"
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      inputProps: { "data-machine-index": `${index}-name` },
                    }}
                    sx={{ "& input": { fontSize: "0.9rem", fontWeight: "bold" } }}
                  />
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={machine.shift}
                    onChange={(e) => updateMachine(index, "shift", e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, index, "shift")}
                    placeholder="0"
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      inputProps: { "data-machine-index": `${index}-shift` },
                    }}
                    sx={{ "& input": { textAlign: "center", fontSize: "0.9rem" } }}
                  />
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={machine.incoming}
                    onChange={(e) => updateMachine(index, "incoming", e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, index, "incoming")}
                    placeholder="0"
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      inputProps: { "data-machine-index": `${index}-incoming` },
                    }}
                    sx={{ "& input": { textAlign: "center", fontSize: "0.9rem" } }}
                  />
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={machine.remaining}
                    onChange={(e) => updateMachine(index, "remaining", e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, index, "remaining")}
                    placeholder="0"
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      inputProps: { "data-machine-index": `${index}-remaining` },
                    }}
                    sx={{ "& input": { textAlign: "center", fontSize: "0.9rem" } }}
                  />
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={machine.used}
                    onChange={(e) => updateMachine(index, "used", e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, index, "used")}
                    placeholder="0"
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      inputProps: { "data-machine-index": `${index}-used` },
                    }}
                    sx={{ "& input": { textAlign: "center", fontSize: "0.9rem" } }}
                  />
                </TableCell>
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", p: 0.5 }}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeMachine(index)}
                    disabled={machines.length <= 1}
                    sx={{ minWidth: "auto", p: 0.5 }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addMachine}
            sx={{
              backgroundColor: "#e91e63",
              color: "white",
              "&:hover": { backgroundColor: "#c2185b" },
            }}
          >
            Makine Ekle
          </Button>
        </Box>

        {/* Daily Usage Notes */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label={t("daily_fuel_usage")}
            multiline
            rows={3}
            value={data.dailyUsage}
            onChange={e => onChange({ ...data, dailyUsage: e.target.value })}
            placeholder="Günlük mazot kullanımı ile ilgili notlar..."
            InputProps={{
              style: { color: "#e91e63" },
            }}
            InputLabelProps={{
              style: { color: "#e91e63" },
            }}
            sx={{
              "& label.Mui-focused": {
                color: "#e91e63",
              },
              "& .MuiInput-underline:after": {
                borderBottomColor: "#e91e63",
              },
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "& fieldset": {
                  borderColor: "#e91e63",
                },
                "&:hover fieldset": {
                  borderColor: "#e91e63",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#e91e63",
                },
              },
            }}
          />
        </Box>
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Sahada Kalan Mazot (Devir)"
            value={data.remainingOnSite}
            onChange={e => onChange({ ...data, remainingOnSite: e.target.value })}
            placeholder="Sahada kalan mazot miktarı (kg/litre)"
            InputProps={{
              style: { color: "#e91e63" },
            }}
            InputLabelProps={{
              style: { color: "#e91e63" },
            }}
            sx={{
              "& label.Mui-focused": {
                color: "#e91e63",
              },
              "& .MuiInput-underline:after": {
                borderBottomColor: "#e91e63",
              },
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                "& fieldset": {
                  borderColor: "#e91e63",
                },
                "&:hover fieldset": {
                  borderColor: "#e91e63",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#e91e63",
                },
              },
            }}
          />
        </Box>

        <Box sx={{ mt: 2, p: 2, backgroundColor: "rgba(233, 30, 99, 0.1)", borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>İpucu:</strong> Başka şantiyede mazot kullanan makine varsa &quot;Makine Ekle&quot; ile ekleyin. Yeni satır için Enter tuşunu da kullanabilirsiniz.
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
