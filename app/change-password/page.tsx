"use client"

import { useState } from "react"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { Alert, Box, Button, Container, Paper, TextField, Typography } from "@mui/material"
import { theme } from "@/lib/theme"

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (newPassword.length < 6) {
      setError("Yeni şifre en az 6 karakter olmalı.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Yeni şifre ve tekrar şifresi eşleşmiyor.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Şifre güncellenemedi.")
        setLoading(false)
        return
      }
      setSuccess("Şifreniz güncellendi. Yönlendiriliyorsunuz...")
      setTimeout(() => {
        window.location.href = "/proje"
      }, 800)
    } catch {
      setError("Bağlantı hatası.")
      setLoading(false)
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a237e 0%, #534bae 100%)",
          p: 2,
        }}
      >
        <Container maxWidth="xs">
          <Paper elevation={4} sx={{ p: 3, borderRadius: 2, background: "#fff" }}>
            <Typography variant="h5" fontWeight={700} sx={{ color: "var(--icsp-lacivert)", mb: 1, textAlign: "center" }}>
              Şifre Değiştir
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: "center" }}>
              İlk girişte güvenlik için şifrenizi güncellemeniz gerekir.
            </Typography>

            <form onSubmit={handleSubmit}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  {success}
                </Alert>
              )}

              <TextField
                fullWidth
                type="password"
                label="Mevcut şifre"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                margin="normal"
                autoComplete="current-password"
                required
              />
              <TextField
                fullWidth
                type="password"
                label="Yeni şifre"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                margin="normal"
                autoComplete="new-password"
                required
              />
              <TextField
                fullWidth
                type="password"
                label="Yeni şifre (tekrar)"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                margin="normal"
                autoComplete="new-password"
                required
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  mt: 2,
                  py: 1.5,
                  backgroundColor: "#1a237e",
                  "&:hover": { backgroundColor: "#000051" },
                }}
              >
                {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </Button>
            </form>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  )
}
