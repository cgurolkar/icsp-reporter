"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { Box, Container, Paper, TextField, Button, Typography, Alert, CircularProgress } from "@mui/material"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/proje"
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedMessage, setSeedMessage] = useState("")

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) router.replace(next)
      })
      .catch(() => {})
  }, [router, next])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Giriş başarısız.")
        setLoading(false)
        return
      }
      setLoading(false)
      window.location.href = next
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError"
      setError(isAbort ? "Zaman aşımı. Sunucuya ulaşılamıyor." : "Bağlantı hatası.")
      setLoading(false)
    }
  }

  return (
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
        <Paper
          elevation={4}
          sx={{
            p: 3,
            borderRadius: 2,
            background: "#fff",
          }}
        >
          <Typography variant="h5" fontWeight={700} sx={{ color: "var(--icsp-lacivert)", mb: 2, textAlign: "center" }}>
            ICSP Reporter
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: "center" }}>
            Giriş yapın
          </Typography>
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Kullanıcı adı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              autoComplete="username"
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              sx={{ "& .MuiInputBase-root": { backgroundColor: "#fff" } }}
            />
            <TextField
              fullWidth
              type="password"
              label="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              autoComplete="current-password"
              required
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              sx={{ "& .MuiInputBase-root": { backgroundColor: "#fff" } }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                mt: 2,
                mb: 1,
                py: 1.5,
                backgroundColor: "#1a237e",
                color: "#fff",
                fontWeight: 600,
                "&:hover": { backgroundColor: "#000051" },
                "&:disabled": { backgroundColor: "#9fa8da", color: "#fff" },
              }}
            >
              {loading ? "Giriş yapılıyor..." : "Giriş"}
            </Button>
            {/* Seed butonu sadece geliştirme ortamında görünür */}
            {process.env.NODE_ENV === "development" && (
              <>
                <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: "center", color: "text.secondary" }}>
                  İlk giriş?{" "}
                  <button
                    type="button"
                    onClick={async () => {
                      setSeedMessage("")
                      setSeedLoading(true)
                      try {
                        const res = await fetch("/api/seed-admin")
                        const data = await res.json().catch(() => ({}))
                        setSeedMessage(data.message || data.error || (res.ok ? "Hesap oluşturuldu." : "İşlem başarısız."))
                        if (res.ok) setTimeout(() => setSeedMessage(""), 5000)
                      } catch {
                        setSeedMessage("Bağlantı hatası.")
                      }
                      setSeedLoading(false)
                    }}
                    disabled={seedLoading}
                    style={{ background: "none", border: "none", color: "#1a237e", cursor: "pointer", textDecoration: "underline", padding: 0, font: "inherit" }}
                  >
                    {seedLoading ? "Oluşturuluyor..." : "Yönetici hesabı oluştur"}
                  </button>
                </Typography>
                {seedMessage && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5, textAlign: "center", color: "success.main" }}>
                    {seedMessage}
                  </Typography>
                )}
              </>
            )}
          </form>
        </Paper>
      </Container>
    </Box>
  )
}

export default function LoginPage() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Suspense fallback={<Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1a237e 0%, #534bae 100%)" }}><CircularProgress sx={{ color: "#fff" }} /></Box>}>
        <LoginForm />
      </Suspense>
    </ThemeProvider>
  )
}
