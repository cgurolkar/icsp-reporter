"use client"

import React, { useEffect, useMemo } from "react"

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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListSubheader,
} from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { Fuel, Machine } from "@/types/form-data"

interface FuelStepProps {
  data: Fuel
  onChange: (data: Fuel) => void
  selectedMachine: Machine | null
  additionalMachines: Machine[]
  /** Temel bilgilerdeki makineler (makine adları mazot satırında listelenir) */
  basicInfoMachines?: { machineName?: string }[]
}

const emptyFuelMachine = { name: "", shift: "", incoming: "", remaining: "", used: "" }

export default function FuelStep({ data, onChange, selectedMachine, additionalMachines, basicInfoMachines = [] }: FuelStepProps) {
  const { t } = useLanguage()
  const machines = Array.isArray(data.machines) && data.machines.length > 0 ? data.machines : [emptyFuelMachine]

  const machineNames = useMemo(() => {
    const fromBasic = (basicInfoMachines || []).map((m) => (m as { machineName?: string }).machineName).filter(Boolean) as string[]
    const fromSelection = [selectedMachine?.name, ...(additionalMachines || []).map((m) => m.name)].filter(Boolean) as string[]
    return [...new Set([...fromBasic, ...fromSelection])]
  }, [basicInfoMachines, selectedMachine, additionalMachines])

  const vehicleOptions = useMemo(() => [t("crane"), t("loader"), t("truck"), t("pickup"), t("car"), t("service")], [t])
  const nameOptions = useMemo(() => [...machineNames, ...vehicleOptions], [machineNames, vehicleOptions])

  // Seçili tüm makineler için yakıt satırı olsun; eksik makine satırlarını ekle (mevcut değerleri koru)
  useEffect(() => {
    const current = Array.isArray(data.machines) ? data.machines : []
    const fromBasic = (basicInfoMachines || []).map((m) => (m as { machineName?: string }).machineName).filter(Boolean) as string[]
    const fromSelection = [selectedMachine?.name, ...(additionalMachines || []).map((m) => m.name)].filter(Boolean) as string[]
    const names = [...new Set([...fromBasic, ...fromSelection])]
    if (names.length === 0) {
      if (current.length === 0) onChange({ ...data, machines: [emptyFuelMachine] })
      return
    }
    const byName = new Map<string, (typeof current)[0]>()
    for (const row of current) {
      const n = String(row?.name ?? "").trim()
      if (n) byName.set(n.toLocaleLowerCase("tr-TR"), row)
    }
    const nameSet = new Set(names.map((n) => n.toLocaleLowerCase("tr-TR")))
    const extras = current.filter((row) => {
      const n = String(row?.name ?? "").trim()
      return n && !nameSet.has(n.toLocaleLowerCase("tr-TR"))
    })
    const synced = [
      ...names.map((name) => byName.get(name.toLocaleLowerCase("tr-TR")) ?? { name, shift: "", incoming: "", remaining: "", used: "" }),
      ...extras,
    ]
    const missing = names.some((n) => !byName.has(n.toLocaleLowerCase("tr-TR")))
    const sameLength = synced.length === current.length
    if (missing || current.length === 0 || (!sameLength && names.length > current.filter((r) => String(r?.name ?? "").trim()).length)) {
      onChange({ ...data, machines: synced })
    }
  }, [basicInfoMachines, selectedMachine, additionalMachines])

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
        <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch", mb: 3 }}>
        <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "white", minWidth: 520 }}>
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f0f0f0" }}>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "20%" }}>
                {t("machine").toUpperCase()}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                {t("shift").toUpperCase()}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                {t("incoming_lt")}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                {t("remaining_lt")}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "15%" }}>
                {t("used_lt")}
              </TableCell>
              <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center", width: "10%" }}>
                {t("action").toUpperCase()}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {machines.map((machine, index) => (
              <TableRow key={index}>
                <TableCell sx={{ border: "1px solid #000", p: 0.5 }}>
                  <FormControl fullWidth size="small" variant="standard" sx={{ minWidth: 140 }}>
                    <Select
                      displayEmpty
                      value={machine.name ?? ""}
                      onChange={(e) => updateMachine(index, "name", e.target.value)}
                      renderValue={(v) => v || t("select_machine_or_vehicle")}
                      inputProps={{ "data-machine-index": `${index}-name` }}
                      sx={{ fontSize: "0.9rem", fontWeight: "bold", "& .MuiSelect-select": { py: 0.5 } }}
                    >
                      <MenuItem value="">
                        <em>{t("select_machine_or_vehicle")}</em>
                      </MenuItem>
                      {machineNames.length > 0 && (
                        <>
                          <ListSubheader sx={{ lineHeight: 2, fontSize: "0.75rem", opacity: 0.8 }} onMouseDown={(e) => e.preventDefault()}>— {t("machines_section")} —</ListSubheader>
                          {machineNames.map((name) => (
                            <MenuItem key={name} value={name}>{name}</MenuItem>
                          ))}
                        </>
                      )}
                      <ListSubheader sx={{ lineHeight: 2, fontSize: "0.75rem", opacity: 0.8 }} onMouseDown={(e) => e.preventDefault()}>— {t("vehicles_section")} —</ListSubheader>
                      {vehicleOptions.map((v) => (
                        <MenuItem key={v} value={v}>{v}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
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
        </Box>

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
            {t("add_machine_vehicle")}
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
            placeholder={t("fuel_notes_placeholder")}
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
            label={t("fuel_remaining_site")}
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
            💡 <strong>{t("tip_prefix")}:</strong> {t("tip_fuel_step")}
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
