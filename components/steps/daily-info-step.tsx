"use client"

import React, { useRef } from "react"
import { Typography, Box, TextField, Paper, Button, IconButton } from "@mui/material"
import { PhotoCamera, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { DailyInfo } from "@/types/form-data"

interface DailyInfoStepProps {
  data: DailyInfo
  onChange: (data: DailyInfo) => void
}

const MAX_IMAGE_SIZE_MB = 5
const MAX_IMAGES = 10
const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp"

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

/** Normalize legacy image1/image2 fields into the images array */
function getImages(data: DailyInfo): string[] {
  if (Array.isArray(data.images) && data.images.length > 0) return data.images
  // Backward compat: merge image1/image2 into array
  const legacy = [data.image1 ?? "", data.image2 ?? ""].filter(Boolean)
  return legacy
}

export default function DailyInfoStep({ data, onChange }: DailyInfoStepProps) {
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const images = getImages(data)

  const setImages = (newImages: string[]) => {
    onChange({ ...data, images: newImages, image1: newImages[0] ?? "", image2: newImages[1] ?? "" })
  }

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ""

    const remaining = MAX_IMAGES - images.length
    const toProcess = files.slice(0, remaining)

    const newImages: string[] = []
    for (const file of toProcess) {
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        alert(t("image_max_size").replace("{{max}}", String(MAX_IMAGE_SIZE_MB)))
        continue
      }
      try {
        const dataUrl = await readFileAsDataUrl(file)
        newImages.push(dataUrl)
      } catch (err) {
        console.error(err)
        alert(t("image_upload_error"))
      }
    }
    setImages([...images, ...newImages])
  }

  const removeImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index)
    setImages(updated)
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
            mb: 2,
            "& .MuiOutlinedInput-root": { backgroundColor: "white", "&:hover fieldset": { borderColor: "#1976d2" } },
          }}
        />
        <Typography variant="subtitle2" sx={{ color: "#1565c0", mb: 1.5, fontWeight: 600 }}>
          {t("next_day_planned_work")}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          placeholder={t("next_day_planned_work_placeholder")}
          value={data.nextDayPlannedWork ?? ""}
          onChange={(e) => onChange({ ...data, nextDayPlannedWork: e.target.value })}
          sx={{
            mb: 3,
            "& .MuiOutlinedInput-root": { backgroundColor: "white", "&:hover fieldset": { borderColor: "#1976d2" } },
          }}
        />

        <Typography variant="subtitle2" sx={{ color: "#1565c0", mb: 1.5, fontWeight: 600 }}>
          {t("daily_images_label")} ({images.length}/{MAX_IMAGES})
        </Typography>

        {/* Mevcut resimler */}
        {images.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
            {images.map((src, i) => (
              <Box
                key={i}
                sx={{
                  position: "relative",
                  display: "inline-block",
                  border: "1px solid #90caf9",
                  borderRadius: 2,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <img
                  src={src}
                  alt={`Fotoğraf ${i + 1}`}
                  style={{ maxWidth: 180, maxHeight: 160, objectFit: "contain", display: "block" }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    background: "rgba(0,0,0,0.45)",
                    borderRadius: "0 0 0 6px",
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => removeImage(i)}
                    sx={{ color: "#fff", p: 0.5 }}
                    title="Kaldır"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    background: "rgba(0,0,0,0.35)",
                    color: "#fff",
                    py: 0.25,
                    fontSize: "0.7rem",
                  }}
                >
                  {i + 1}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Resim ekle butonu */}
        {images.length < MAX_IMAGES && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_IMAGE}
              multiple
              style={{ display: "none" }}
              onChange={handleAddImage}
            />
            <Button
              variant="outlined"
              startIcon={<PhotoCamera />}
              onClick={() => fileInputRef.current?.click()}
              sx={{ borderColor: "#1976d2", color: "#1976d2" }}
            >
              Fotoğraf Ekle ({images.length}/{MAX_IMAGES})
            </Button>
          </>
        )}
        {images.length >= MAX_IMAGES && (
          <Typography variant="caption" color="text.secondary">
            Maksimum fotoğraf sayısına ({MAX_IMAGES}) ulaşıldı.
          </Typography>
        )}
      </Paper>
    </Box>
  )
}
