"use client"

import { FormControl, Select, MenuItem, type SelectChangeEvent } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  const handleChange = (event: SelectChangeEvent) => {
    setLanguage(event.target.value as "tr" | "en" | "ar")
  }

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select value={language} onChange={handleChange} displayEmpty>
        <MenuItem value="tr">🇹🇷 Türkçe</MenuItem>
        <MenuItem value="en">🇺🇸 English</MenuItem>
        <MenuItem value="ar">🇸🇦 العربية</MenuItem>
      </Select>
    </FormControl>
  )
}
