"use client"

import React, { useRef } from "react"
import { Typography, Box, TextField, Paper, Button } from "@mui/material"
import { PhotoCamera } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { DailyInfo } from "@/types/form-data"

interface DailyInfoStepProps {
  data: DailyInfo
  onChange: (data: DailyInfo) => void
}

const MAX_IMAGE_SIZE_MB = 5
const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp"

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export default function DailyInfoStep({ data, onChange }: DailyInfoStepProps) {
  const { t } = useLanguage()
  const input1Ref = useRef<HTMLInputElement>(null)
  const input2Ref = useRef<HTMLInputElement>(null)

  const handleImageChange = async (slot: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      alert(t("image_max_size").replace("{{max}}", String(MAX_IMAGE_SIZE_MB)))
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (slot === 1) onChange({ ...data, image1: dataUrl })
      else onChange({ ...data, image2: dataUrl })
    } catch (err) {
      console.error(err)
      alert(t("image_upload_error"))
    }
    e.target.value = ""
  }

  const removeImage = (slot: 1 | 2) => {
    if (slot === 1) onChange({ ...data, image1: "" })
    else onChange({ ...data, image2: "" })
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "#1976d2", fontWeight: 600, mb: 3 }}>
        {t("daily_info")}
      </Typography>
      <Paper sx={{ p: 3, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", border: "1px solid #1976d2" }}>
        <Typography variant="subtitle2" sx={{ color: "#1565c0", mb: 1.5, fontWeight: 600 }}>
          {t("daily_notes")}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={4}
          placeholder={t("daily_notes_placeholder")}
          value={data.notes}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          sx={{
            mb: 3,
            "& .MuiOutlinedInput-root": { backgroundColor: "white", "&:hover fieldset": { borderColor: "#1976d2" } },
          }}
        />

        <Typography variant="subtitle2" sx={{ color: "#1565c0", mb: 1.5, fontWeight: 600 }}>
          {t("daily_images_label")}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ flex: "1 1 200px" }}>
            <input
              ref={input1Ref}
              type="file"
              accept={ACCEPT_IMAGE}
              style={{ display: "none" }}
              onChange={(e) => handleImageChange(1, e)}
            />
            {data.image1 ? (
              <Box sx={{ position: "relative", display: "inline-block" }}>
                <img
                  src={data.image1}
                  alt="Günlük 1"
                  style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", border: "1px solid #ccc", borderRadius: 8 }}
                />
                <Button size="small" color="error" onClick={() => removeImage(1)} sx={{ position: "absolute", top: 4, right: 4 }}>
                  {t("remove")}
                </Button>
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={() => input1Ref.current?.click()}
                sx={{ borderColor: "#1976d2", color: "#1976d2" }}
              >
                {t("add_image_1")}
              </Button>
            )}
          </Box>
          <Box sx={{ flex: "1 1 200px" }}>
            <input
              ref={input2Ref}
              type="file"
              accept={ACCEPT_IMAGE}
              style={{ display: "none" }}
              onChange={(e) => handleImageChange(2, e)}
            />
            {data.image2 ? (
              <Box sx={{ position: "relative", display: "inline-block" }}>
                <img
                  src={data.image2}
                  alt="2"
                  style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", border: "1px solid #ccc", borderRadius: 8 }}
                />
                <Button size="small" color="error" onClick={() => removeImage(2)} sx={{ position: "absolute", top: 4, right: 4 }}>
                  {t("remove")}
                </Button>
              </Box>
            ) : (
              <Button
                variant="outlined"
                startIcon={<PhotoCamera />}
                onClick={() => input2Ref.current?.click()}
                sx={{ borderColor: "#1976d2", color: "#1976d2" }}
              >
                {t("add_image_2")}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}
