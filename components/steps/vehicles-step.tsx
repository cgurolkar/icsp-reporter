"use client"

import type React from "react"

import { Grid, TextField, Typography, Box, Paper } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"
import type { Vehicles } from "@/types/form-data"

interface VehiclesStepProps {
  data: Vehicles
  onChange: (data: Vehicles) => void
}

export default function VehiclesStep({ data, onChange }: VehiclesStepProps) {
  const { t } = useLanguage()

  const handleChange = (field: keyof Vehicles) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newData = {
      ...data,
      [field]: Number.parseInt(event.target.value) || 0,
    }
    // Calculate total
    newData.total = newData.crane + newData.loader + newData.truck + newData.pickup + newData.car + newData.service
    onChange(newData)
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "warning.main", fontWeight: 600, mb: 3 }}>
        {t("vehicles")}
      </Typography>
      <Paper
        sx={{ p: 3, background: "linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%)", border: "1px solid #ff9800" }}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("crane")}
              type="number"
              value={data.crane}
              onChange={handleChange("crane")}
              InputProps={{ style: { backgroundColor: "white" } }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("loader")}
              type="number"
              value={data.loader}
              onChange={handleChange("loader")}
              InputProps={{ style: { backgroundColor: "white" } }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("truck")}
              type="number"
              value={data.truck}
              onChange={handleChange("truck")}
              InputProps={{ style: { backgroundColor: "white" } }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("pickup")}
              type="number"
              value={data.pickup}
              onChange={handleChange("pickup")}
              InputProps={{ style: { backgroundColor: "white" } }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("car")}
              type="number"
              value={data.car}
              onChange={handleChange("car")}
              InputProps={{ style: { backgroundColor: "white" } }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("service")}
              type="number"
              value={data.service}
              onChange={handleChange("service")}
              InputProps={{ style: { backgroundColor: "white" } }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t("total")}
              type="number"
              value={data.total}
              InputProps={{ readOnly: true, style: { backgroundColor: "white" } }}
              variant="filled"
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
