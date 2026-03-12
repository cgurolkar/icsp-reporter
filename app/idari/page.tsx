"use client"

import Link from "next/link"
import { Box, Typography, Button, Paper } from "@mui/material"
import { People, Assignment, AttachMoney } from "@mui/icons-material"

export default function IdariDashboardPage() {
  return (
    <Box>
      <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 2 }}>
        Dashboard
      </Typography>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          İdari modüle hoş geldiniz. Personel, puantaj ve finans işlemlerini menüden yönetebilirsiniz.
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Button component={Link} href="/idari/personel" variant="contained" startIcon={<People />} sx={{ background: "var(--icsp-lacivert)" }}>
            Personel listesi
          </Button>
          <Button component={Link} href="/idari/puantaj" variant="outlined" startIcon={<Assignment />} disabled>
            Puantaj (yakında)
          </Button>
          <Button component={Link} href="/idari/harcamalar" variant="outlined" startIcon={<AttachMoney />} disabled>
            Harcamalar (yakında)
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
