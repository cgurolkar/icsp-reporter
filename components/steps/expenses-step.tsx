"use client"

import type React from "react"

import { Grid, TextField, Typography, Box, Button, IconButton, Paper, FormControl, InputLabel, Select, MenuItem } from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { Expense, ExpenseCategory, ExpenseCurrency } from "@/types/form-data"
import { normalizeIqdPerUsd, sumExpensesFx } from "@/lib/expense-fx"

interface ExpensesStepProps {
  data: Expense[]
  onChange: (data: Expense[]) => void
  /** Şantiye / 1 USD = kaç IQD; yoksa varsayılan kur */
  iqdPerUsd?: number | null
}

export default function ExpensesStep({ data, onChange, iqdPerUsd }: ExpensesStepProps) {
  const { t } = useLanguage()

  const expenseCategories: { value: ExpenseCategory; label: string }[] = [
    { value: "santiye", label: t("expense_cat_santiye") },
    { value: "makine", label: t("expense_cat_makine") },
    { value: "personel", label: t("expense_cat_personel") },
    { value: "yakit", label: t("expense_cat_yakit") },
    { value: "diger", label: t("expense_cat_diger") },
  ]

  const rate = normalizeIqdPerUsd(iqdPerUsd)
  const { totalUsd, totalIqd } = sumExpensesFx(data, rate)

  const addExpense = () => {
    onChange([...data, { description: "", amount: 0, category: "diger", currency: "IQD" }])
  }

  const removeExpense = (index: number) => {
    if (data.length > 1) {
      onChange(data.filter((_, i) => i !== index))
    }
  }

  const updateExpense = (index: number, field: keyof Expense, value: string | number) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    onChange(newData)
  }

  const handleKeyPress = (event: React.KeyboardEvent, index: number, field: keyof Expense) => {
    if (event.key === "Enter") {
      event.preventDefault()

      // If this is the last row and we're in the amount field, add a new row
      if (index === data.length - 1 && field === "amount") {
        addExpense()
        // Focus on the description field of the new row
        setTimeout(() => {
          const nextInput = document.querySelector(
            `input[data-expense-index="${index + 1}-description"]`,
          ) as HTMLInputElement
          if (nextInput) {
            nextInput.focus()
          }
        }, 100)
      } else if (field === "description") {
        // Move to amount field in the same row
        const amountInput = document.querySelector(`input[data-expense-index="${index}-amount"]`) as HTMLInputElement
        if (amountInput) {
          amountInput.focus()
        }
      } else if (field === "amount" && index < data.length - 1) {
        // Move to description field of next row
        const nextInput = document.querySelector(
          `input[data-expense-index="${index + 1}-description"]`,
        ) as HTMLInputElement
        if (nextInput) {
          nextInput.focus()
        }
      }
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "#9c27b0", fontWeight: 600, mb: 3 }}>
        {t("expenses")}
      </Typography>
      <Paper
        sx={{ p: 3, background: "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)", border: "1px solid #9c27b0" }}
      >
        {data.map((expense, index) => (
          <Grid container spacing={2} key={index} sx={{ mb: 2 }} alignItems="center">
            <Grid item xs={1}>
              <Typography variant="body1" sx={{ fontWeight: 600, color: "#9c27b0" }}>
                {index + 1}.
              </Typography>
            </Grid>
            <Grid item xs={12} sm={2}>
              <FormControl fullWidth size="small" sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "white" } }}>
                <InputLabel>{t("expense_type")}</InputLabel>
                <Select
                  label={t("expense_type")}
                  value={expense.category ?? "diger"}
                  onChange={(e) => updateExpense(index, "category", e.target.value as ExpenseCategory)}
                >
                  {expenseCategories.map((c) => (
                    <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={2}>
              <FormControl fullWidth size="small" sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "white" } }}>
                <InputLabel>Kur</InputLabel>
                <Select
                  label="Kur"
                  value={expense.currency ?? "IQD"}
                  onChange={(e) => updateExpense(index, "currency", e.target.value as ExpenseCurrency)}
                >
                  <MenuItem value="IQD">IQD</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label={t("description")}
                value={expense.description}
                onChange={(e) => updateExpense(index, "description", e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, index, "description")}
                placeholder={t("expense_description_placeholder")}
                InputProps={{
                  inputProps: { "data-expense-index": `${index}-description` },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "white",
                    "&:hover fieldset": { borderColor: "#9c27b0" },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <TextField
                fullWidth
                size="small"
                label={expense.currency === "USD" ? "Tutar (USD)" : "Tutar (IQD)"}
                type="number"
                value={expense.amount || ""}
                onChange={(e) => updateExpense(index, "amount", Number.parseFloat(e.target.value) || 0)}
                onKeyPress={(e) => handleKeyPress(e, index, "amount")}
                placeholder="0"
                InputProps={{
                  inputProps: { "data-expense-index": `${index}-amount` },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "white",
                    "&:hover fieldset": { borderColor: "#9c27b0" },
                  },
                }}
              />
            </Grid>
            <Grid item xs={1}>
              <IconButton onClick={() => removeExpense(index)} color="error" disabled={data.length <= 1} size="small">
                <Delete />
              </IconButton>
            </Grid>
          </Grid>
        ))}

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 3 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={addExpense}
            sx={{
              backgroundColor: "#9c27b0",
              color: "white",
              "&:hover": { backgroundColor: "#7b1fa2" },
            }}
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
