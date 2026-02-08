"use client"

import type React from "react"

import { Grid, TextField, Typography, Box, Button, IconButton, Paper } from "@mui/material"
import { Add, Delete } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { Expense } from "@/types/form-data"

interface ExpensesStepProps {
  data: Expense[]
  onChange: (data: Expense[]) => void
}

export default function ExpensesStep({ data, onChange }: ExpensesStepProps) {
  const { t } = useLanguage()

  const addExpense = () => {
    onChange([...data, { description: "", amount: 0 }])
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

  const total = data.reduce((sum, expense) => sum + expense.amount, 0)

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "#9c27b0", fontWeight: 600, mb: 3 }}>
        {t("expenses")}
      </Typography>
      <Paper
        sx={{ p: 3, background: "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)", border: "1px solid #9c27b0" }}
      >
        {data.map((expense, index) => (
          <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
            <Grid item xs={1}>
              <Typography variant="body1" sx={{ mt: 2, fontWeight: 600, color: "#9c27b0" }}>
                {index + 1}.
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label={t("description")}
                value={expense.description}
                onChange={(e) => updateExpense(index, "description", e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, index, "description")}
                placeholder="Harcama açıklaması..."
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
            <Grid item xs={4}>
              <TextField
                fullWidth
                label={t("amount_iqd")}
                type="number"
                value={expense.amount}
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
              <IconButton onClick={() => removeExpense(index)} color="error" disabled={data.length <= 1} sx={{ mt: 1 }}>
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

          <Typography variant="h6" sx={{ color: "#9c27b0", fontWeight: 600 }}>
            {t("total")}: {total.toLocaleString()} {t("currency")}
          </Typography>
        </Box>

        <Box sx={{ mt: 2, p: 2, backgroundColor: "rgba(156, 39, 176, 0.1)", borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>İpucu:</strong> Yeni satır eklemek için Enter tuşuna basın veya "Harcama Ekle" butonunu kullanın.
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
