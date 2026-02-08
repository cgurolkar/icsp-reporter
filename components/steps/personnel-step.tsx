"use client"

import type React from "react"

import { Grid, TextField, Typography, Box, Paper } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"
import type { Personnel } from "@/types/form-data"

interface PersonnelStepProps {
  data: Personnel
  onChange: (data: Personnel) => void
}

export default function PersonnelStep({ data, onChange }: PersonnelStepProps) {
  const { t } = useLanguage()

  const handleChange = (field: keyof Personnel) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newData = {
      ...data,
      [field]: Number.parseInt(event.target.value) || 0,
    }
    // Calculate total
    newData.total =
      newData.engineer + newData.foreman + newData.operator + newData.oiler + newData.welder + newData.other
    onChange(newData)
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "success.main", fontWeight: 600, mb: 3 }}>
        {t("personnel")}
      </Typography>
      <Paper
        sx={{ p: 3, background: "linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)", border: "1px solid #4caf50" }}
      >
        <Grid container spacing={3}>
          {/* All TextField components get the green styling */}
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("engineer")}
              type="number"
              value={data.engineer}
              onChange={handleChange("engineer")}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "white",
                  "&:hover fieldset": { borderColor: "success.main" },
                },
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("foreman")}
              type="number"
              value={data.foreman}
              onChange={handleChange("foreman")}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "white",
                  "&:hover fieldset": { borderColor: "success.main" },
                },
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("operator")}
              type="number"
              value={data.operator}
              onChange={handleChange("operator")}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "white",
                  "&:hover fieldset": { borderColor: "success.main" },
                },
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("oiler")}
              type="number"
              value={data.oiler}
              onChange={handleChange("oiler")}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "white",
                  "&:hover fieldset": { borderColor: "success.main" },
                },
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("welder")}
              type="number"
              value={data.welder}
              onChange={handleChange("welder")}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "white",
                  "&:hover fieldset": { borderColor: "success.main" },
                },
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label={t("other")}
              type="number"
              value={data.other}
              onChange={handleChange("other")}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "white",
                  "&:hover fieldset": { borderColor: "success.main" },
                },
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t("total")}
              type="number"
              value={data.total}
              InputProps={{ readOnly: true }}
              variant="filled"
              sx={{
                "& .MuiFilledInput-root": {
                  backgroundColor: "success.light",
                  color: "white",
                  fontWeight: "bold",
                },
              }}
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
