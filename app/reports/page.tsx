"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Box,
  Container,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  IconButton,
} from "@mui/material"
import { ChevronLeft, ChevronRight } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

interface SiteOption {
  id: number
  name: string
  code: string
  report_count?: number
}

interface ReportRow {
  id: number
  date: string
  project: string
  site_name?: string
  selected_machine_name?: string
  total_production_summary?: string
  total_production?: string
  daily_pile_count?: string
  total_pile_count?: string
  concrete_poured?: string
  remaining_piles?: string
  engineer_count?: number
  foreman_count?: number
  operator_count?: number
  personnel_total?: number
  daily_fuel_usage?: string
  notes?: string
}

const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

function ReportsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const canViewReports = user?.role === "super_admin" || user?.role === "admin" || user?.role === "manager"

  const [siteId, setSiteId] = useState<string>(() => searchParams.get("siteId") || "")
  const [sites, setSites] = useState<SiteOption[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  useEffect(() => {
    if (user != null && !canViewReports) {
      router.replace("/proje")
    }
  }, [canViewReports, user, router])

  useEffect(() => {
    if (!canViewReports) return
    fetch("/api/sites?withReportCount=1")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: SiteOption[]) => setSites(list))
      .catch(() => setSites([]))
  }, [])

  useEffect(() => {
    if (!siteId) {
      setReports([])
      setSelectedDate(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setSelectedDate(null)
    const start = new Date(calendarMonth.year, calendarMonth.month, 1)
    const end = new Date(calendarMonth.year, calendarMonth.month + 1, 0)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)
    const params = new URLSearchParams({ siteId, startDate: startStr, endDate: endStr, raw: "1" })
    fetch(`/api/reports?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Veriler alınamadı")
        return res.json()
      })
      .then((data: ReportRow[]) => setReports(data))
      .catch((err) => {
        setError(err.message || "Bir hata oluştu")
        setReports([])
      })
      .finally(() => setLoading(false))
  }, [siteId, calendarMonth.year, calendarMonth.month, canViewReports])

  const toDateKey = (d: string | unknown): string => {
    if (typeof d === "string") return d.slice(0, 10)
    if (d instanceof Date) return d.toISOString().slice(0, 10)
    return String(d).slice(0, 10)
  }
  const reportsByDate = reports.reduce<Record<string, ReportRow[]>>((acc, r) => {
    const dateKey = toDateKey(r.date)
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(r)
    return acc
  }, {})

  const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate()
  const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) week.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  const hasReport = (day: number) => {
    const dateStr = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return !!reportsByDate[dateStr]?.length
  }

  const selectedReports = selectedDate ? reportsByDate[selectedDate] || [] : []
  const selectedReport = selectedReports[0]

  const currentSite = sites.find((s) => String(s.id) === siteId)
  const reportCount = currentSite?.report_count ?? (siteId ? reports.length : 0)

  if (user != null && !canViewReports) {
    return (
      <Box sx={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "#fafafa", py: 2, px: 0, overflowX: "hidden", maxWidth: "100%" }}>
      <Container maxWidth="lg" sx={{ maxWidth: "100%", px: { xs: 1.5, sm: 2 } }}>
        <Typography variant="h6" fontWeight={600} sx={{ color: "var(--icsp-lacivert)", mb: 2 }}>
          Şantiyeler – Tarihe göre rapor özeti
        </Typography>

        {sites.length > 0 && (
          <Box sx={{ width: "100%", maxWidth: 420, mb: 3, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <FormControl fullWidth size="small" sx={{ minWidth: 0, flex: "1 1 200px" }}>
              <InputLabel id="report-site-label">Şantiye</InputLabel>
              <Select
                labelId="report-site-label"
                label="Şantiye"
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value)
                  setSelectedDate(null)
                }}
              >
                <MenuItem value="">Şantiye seçin</MenuItem>
                {sites.map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    {s.name} ({s.code}) — {s.report_count ?? 0} rapor
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {siteId && (
              <Typography variant="body2" color="text.secondary">
                Toplam rapor: <strong>{reportCount}</strong>
              </Typography>
            )}
          </Box>
        )}

        {!siteId && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Raporları görmek için önce bir şantiye seçin.
          </Alert>
        )}

        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {siteId && loading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}

        {siteId && !loading && (
          <>
            <Paper sx={{ p: 2, mb: 3, background: "#fff", border: "1px solid var(--icsp-nav-border)", maxWidth: 400 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <IconButton
                  size="small"
                  onClick={() =>
                    setCalendarMonth((prev) =>
                      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }
                    )
                  }
                >
                  <ChevronLeft />
                </IconButton>
                <Typography variant="subtitle1" fontWeight={600}>
                  {MONTH_NAMES[calendarMonth.month]} {calendarMonth.year}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() =>
                    setCalendarMonth((prev) =>
                      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }
                    )
                  }
                >
                  <ChevronRight />
                </IconButton>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => (
                      <TableCell key={day} align="center" sx={{ fontWeight: 600, py: 0.5, borderColor: "var(--icsp-nav-border)" }}>
                        {day}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {weeks.map((row, wi) => (
                    <TableRow key={wi}>
                      {row.map((day, di) => {
                        if (day === null) {
                          return <TableCell key={di} sx={{ borderColor: "var(--icsp-nav-border)", p: 0.5 }} />
                        }
                        const dateStr = `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        const has = hasReport(day)
                        const isSelected = selectedDate === dateStr
                        return (
                          <TableCell
                            key={di}
                            align="center"
                            onClick={() => setSelectedDate(dateStr)}
                            sx={{
                              borderColor: "var(--icsp-nav-border)",
                              p: 0.5,
                              cursor: "pointer",
                              backgroundColor: isSelected ? "var(--icsp-lacivert)" : has ? "rgba(26, 35, 126, 0.12)" : undefined,
                              color: isSelected ? "#fff" : undefined,
                              fontWeight: has ? 600 : 400,
                              "&:hover": { backgroundColor: has || isSelected ? "rgba(26, 35, 126, 0.25)" : "#f5f5f5" },
                            }}
                          >
                            {day}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>

            <Paper sx={{ p: 2, background: "#fff", border: "1px solid var(--icsp-nav-border)", overflow: "hidden", maxWidth: "100%" }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ color: "var(--icsp-lacivert)", mb: 2 }}>
                {selectedDate ? `${selectedDate} — Rapor özeti` : "Rapor özeti"}
              </Typography>
              {!selectedDate ? (
                <Typography color="text.secondary" sx={{ wordBreak: "break-word" }}>Takvimden bir gün seçin; seçilen tarihe ait rapor özeti burada görünür.</Typography>
              ) : selectedReports.length === 0 ? (
                <Typography color="text.secondary">Bu tarihte rapor yok.</Typography>
              ) : (
                selectedReports.map((r) => (
                  <Box key={r.id} sx={{ mb: 2, overflowX: "auto", maxWidth: "100%" }}>
                    <Table size="small" sx={{ minWidth: 260 }}>
                      <TableBody>
                        <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Proje</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.project}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Makine</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.selected_machine_name || "—"}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Kazık İmalatı (m)</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.total_production_summary ?? r.total_production ?? "—"}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Kazık Sayısı (Ad.)</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{[r.daily_pile_count, r.total_pile_count, r.concrete_poured].find((v) => v != null && String(v).trim() !== "") ?? "—"}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Beton dökülen (Ad.)</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.concrete_poured != null && String(r.concrete_poured).trim() !== "" ? r.concrete_poured : "—"}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Kalan kazık — beton dökülecek (Ad.)</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.remaining_piles != null && String(r.remaining_piles).trim() !== "" ? r.remaining_piles : "—"}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Personel toplam</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.personnel_total ?? "—"}</TableCell></TableRow>
                        <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Mazot Miktarı (lt) / not</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.daily_fuel_usage != null && String(r.daily_fuel_usage).trim() !== "" ? String(r.daily_fuel_usage) : "—"}</TableCell></TableRow>
                        {r.notes && (
                          <TableRow><TableCell sx={{ borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Notlar</TableCell><TableCell sx={{ borderColor: "var(--icsp-nav-border)", whiteSpace: "pre-wrap" }}>{r.notes}</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Box>
                ))
              )}
            </Paper>
          </>
        )}
      </Container>
    </Box>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafafa" }}>
        <CircularProgress />
      </Box>
    }>
      <ReportsContent />
    </Suspense>
  )
}

