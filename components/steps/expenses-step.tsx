"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { TextField, Typography, Box, Button, IconButton, Paper, FormControl, InputLabel, Select, MenuItem } from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { Expense, ExpenseCurrency } from "@/types/form-data"
import { normalizeIqdPerUsd, sumExpensesFx } from "@/lib/expense-fx"

interface KalemOpt {
  id: number
  kod: string
  ad: string
}
interface AltKalemOpt {
  id: number
  kalem_id: number
  ad: string
  kalem_kod?: string
  kalem_ad?: string
}
interface MasrafOpt {
  id: number
  ad: string
  tip: string
}

interface ExpensesStepProps {
  data: Expense[]
  onChange: (data: Expense[]) => void
  iqdPerUsd?: number | null
}

function kalemIdForExpense(expense: Expense, altKalemler: AltKalemOpt[]): string {
  if (expense.altKalemId) {
    const ak = altKalemler.find((a) => a.id === expense.altKalemId)
    if (ak) return String(ak.kalem_id)
  }
  return ""
}

export default function ExpensesStep({ data, onChange, iqdPerUsd }: ExpensesStepProps) {
  const { t } = useLanguage()
  const [kalemler, setKalemler] = useState<KalemOpt[]>([])
  const [altKalemler, setAltKalemler] = useState<AltKalemOpt[]>([])
  const [masrafYerleri, setMasrafYerleri] = useState<MasrafOpt[]>([])

  useEffect(() => {
    fetch("/api/idari/harcama-tanimlar")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setKalemler(d.kalemler || [])
        setAltKalemler(d.altKalemler || [])
        setMasrafYerleri(d.masrafYerleri || [])
      })
      .catch(() => {})
  }, [])

  const rate = normalizeIqdPerUsd(iqdPerUsd)
  const { totalUsd, totalIqd } = sumExpensesFx(data, rate)

  const addExpense = () => {
    onChange([...data, { description: "", amount: 0, currency: "IQD", altKalemId: null, masrafYeriId: null }])
  }

  const removeExpense = (index: number) => {
    if (data.length > 1) onChange(data.filter((_, i) => i !== index))
  }

  const updateExpense = (index: number, patch: Partial<Expense>) => {
    const newData = [...data]
    newData[index] = { ...newData[index], ...patch }
    onChange(newData)
  }

  const handleKalemChange = (index: number, kalemIdStr: string) => {
    const kalemId = parseInt(kalemIdStr, 10)
    const kalem = kalemler.find((k) => k.id === kalemId)
    const firstAlt = altKalemler.find((a) => a.kalem_id === kalemId)
    updateExpense(index, {
      altKalemId: firstAlt?.id ?? null,
      altKalemAd: firstAlt?.ad,
      kalemKod: kalem?.kod,
      kalemAd: kalem?.ad,
    })
  }

  const handleAltKalemChange = (index: number, altIdStr: string) => {
    const altId = parseInt(altIdStr, 10)
    const ak = altKalemler.find((a) => a.id === altId)
    updateExpense(index, {
      altKalemId: altId || null,
      altKalemAd: ak?.ad,
      kalemKod: ak?.kalem_kod,
      kalemAd: ak?.kalem_ad,
    })
  }

  const handleMasrafChange = (index: number, masrafIdStr: string) => {
    const mid = parseInt(masrafIdStr, 10)
    const my = masrafYerleri.find((m) => m.id === mid)
    updateExpense(index, {
      masrafYeriId: mid || null,
      masrafYeriAd: my?.ad,
    })
  }

  const handleKeyPress = (event: React.KeyboardEvent, index: number, field: "description" | "amount") => {
    if (event.key !== "Enter") return
    event.preventDefault()
    if (index === data.length - 1 && field === "amount") {
      addExpense()
      setTimeout(() => {
        ;(document.querySelector(`input[data-expense-index="${index + 1}-description"]`) as HTMLInputElement)?.focus()
      }, 100)
    } else if (field === "description") {
      ;(document.querySelector(`input[data-expense-index="${index}-amount"]`) as HTMLInputElement)?.focus()
    } else if (field === "amount" && index < data.length - 1) {
      ;(document.querySelector(`input[data-expense-index="${index + 1}-description"]`) as HTMLInputElement)?.focus()
    }
  }

  const altsByKalem = useMemo(() => {
    const map = new Map<number, AltKalemOpt[]>()
    for (const a of altKalemler) {
      const list = map.get(a.kalem_id) || []
      list.push(a)
      map.set(a.kalem_id, list)
    }
    return map
  }, [altKalemler])

  const fieldSx = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "white",
      "&:hover fieldset": { borderColor: "#9c27b0" },
    },
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "#9c27b0", fontWeight: 600, mb: 3 }}>
        {t("expenses")}
      </Typography>
      <Paper
        sx={{ p: 3, background: "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)", border: "1px solid #9c27b0" }}
      >
        {data.map((expense, index) => {
          const selectedKalemId = kalemIdForExpense(expense, altKalemler)
          const filteredAlts = selectedKalemId
            ? altsByKalem.get(parseInt(selectedKalemId, 10)) || []
            : altKalemler

          return (
            <Box
              key={index}
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1.5,
                mb: 2,
                alignItems: "center",
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 600, color: "#9c27b0", minWidth: 28 }}>
                {index + 1}.
              </Typography>
              <FormControl size="small" sx={{ minWidth: 160, flex: "1 1 140px", ...fieldSx }}>
                <InputLabel>Ana kalem</InputLabel>
                <Select
                  label="Ana kalem"
                  value={selectedKalemId}
                  onChange={(e) => handleKalemChange(index, e.target.value)}
                >
                  <MenuItem value="">Seçin</MenuItem>
                  {kalemler.map((k) => (
                    <MenuItem key={k.id} value={String(k.id)}>{k.kod} — {k.ad}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150, flex: "1 1 140px", ...fieldSx }}>
                <InputLabel>Alt kalem</InputLabel>
                <Select
                  label="Alt kalem"
                  value={expense.altKalemId ? String(expense.altKalemId) : ""}
                  onChange={(e) => handleAltKalemChange(index, e.target.value)}
                >
                  <MenuItem value="">Seçin</MenuItem>
                  {filteredAlts.map((a) => (
                    <MenuItem key={a.id} value={String(a.id)}>{a.ad}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 160, flex: "1 1 140px", ...fieldSx }}>
                <InputLabel>Masraf yeri</InputLabel>
                <Select
                  label="Masraf yeri"
                  value={expense.masrafYeriId ? String(expense.masrafYeriId) : ""}
                  onChange={(e) => handleMasrafChange(index, e.target.value)}
                >
                  <MenuItem value="">Seçin</MenuItem>
                  {masrafYerleri.map((m) => (
                    <MenuItem key={m.id} value={String(m.id)}>{m.ad} ({m.tip})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 90, ...fieldSx }}>
                <InputLabel>Kur</InputLabel>
                <Select
                  label="Kur"
                  value={expense.currency ?? "IQD"}
                  onChange={(e) => updateExpense(index, { currency: e.target.value as ExpenseCurrency })}
                >
                  <MenuItem value="IQD">IQD</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                label={t("description")}
                value={expense.description}
                onChange={(e) => updateExpense(index, { description: e.target.value })}
                onKeyPress={(e) => handleKeyPress(e, index, "description")}
                placeholder={t("expense_description_placeholder")}
                InputProps={{ inputProps: { "data-expense-index": `${index}-description` } }}
                sx={{ flex: "2 1 180px", minWidth: 160, ...fieldSx }}
              />
              <TextField
                size="small"
                label={expense.currency === "USD" ? "Tutar (USD)" : "Tutar (IQD)"}
                type="number"
                value={expense.amount || ""}
                onChange={(e) => updateExpense(index, { amount: Number.parseFloat(e.target.value) || 0 })}
                onKeyPress={(e) => handleKeyPress(e, index, "amount")}
                placeholder="0"
                InputProps={{ inputProps: { "data-expense-index": `${index}-amount` } }}
                sx={{ width: 120, ...fieldSx }}
              />
              <IconButton onClick={() => removeExpense(index)} color="error" disabled={data.length <= 1} size="small">
                <Delete />
              </IconButton>
            </Box>
          )
        })}

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 3, flexWrap: "wrap", gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addExpense}
            sx={{ backgroundColor: "#9c27b0", color: "white", "&:hover": { backgroundColor: "#7b1fa2" } }}
          >
            {t("add")} {t("expenses")}
          </Button>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="body2" sx={{ color: "#9c27b0", fontWeight: 600 }}>
              Toplam (USD): {totalUsd.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
            </Typography>
            <Typography variant="body2" sx={{ color: "#9c27b0", fontWeight: 600 }}>
              Toplam (IQD): {totalIqd.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Kur: 1 USD = {rate.toLocaleString("tr-TR")} IQD
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 2, p: 2, backgroundColor: "rgba(156, 39, 176, 0.1)", borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>{t("tip_prefix")}:</strong> {t("tip_expenses")}
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
