"use client"

import { useEffect } from "react"
import { Box, TextField, Typography, Paper } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"
import type { IronStep } from "@/types/form-data"

interface IronStepProps {
  data: IronStep
  onChange: (data: IronStep) => void
}

export default function IronStepComponent({ data, onChange }: IronStepProps) {
  const { t } = useLanguage()

  // Otomatik kalan demir hesaplama
  useEffect(() => {
    const prepared = parseFloat(data.preparedToday) || 0
    const onSite = parseFloat(data.onSite) || 0
    const lowered = parseFloat(data.lowered) || 0
    const remaining = (onSite + prepared - lowered).toString()
    if (data.remaining !== remaining) {
      onChange({ ...data, remaining })
    }
    // eslint-disable-next-line
  }, [data.preparedToday, data.onSite, data.lowered])

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "success.main", fontWeight: 600, mb: 3 }}>
        {t("iron_step")}
      </Typography>
      <Paper sx={{ p: 3, background: "linear-gradient(135deg, #e8f5e9 0%, #b2dfdb 100%)", border: "1px solid #388e3c" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 3 }}>
          <TextField
            fullWidth
            label={t("iron_prepared_today")}
            value={data.preparedToday}
            onChange={e => onChange({ ...data, preparedToday: e.target.value })}
            type="number"
            sx={{ backgroundColor: "white" }}
          />
          <TextField
            fullWidth
            label={t("iron_on_site")}
            value={data.onSite}
            onChange={e => onChange({ ...data, onSite: e.target.value })}
            type="number"
            sx={{ backgroundColor: "white" }}
          />
          <TextField
            fullWidth
            label={t("iron_lowered")}
            value={data.lowered}
            onChange={e => onChange({ ...data, lowered: e.target.value })}
            type="number"
            sx={{ backgroundColor: "white" }}
          />
          <TextField
            fullWidth
            label={t("iron_remaining_site")}
            value={data.remaining}
            InputProps={{ readOnly: true }}
            sx={{ backgroundColor: "#f1f8e9" }}
          />
        </Box>
      </Paper>
    </Box>
  )
} 