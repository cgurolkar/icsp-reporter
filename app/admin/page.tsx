"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  Skeleton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material"
import { Delete, Add, Edit, Assessment, Place, TrendingUp, Refresh } from "@mui/icons-material"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { LanguageProvider, useLanguage } from "@/contexts/language-context"
import LanguageSelector from "@/components/language-selector"

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

function AdminPanel() {
  const [tabValue, setTabValue] = useState(0)
  const [emails, setEmails] = useState<string[]>([])
  const [users, setUsers] = useState<string[]>([])
  const [customFields, setCustomFields] = useState<string[]>([])
  const [totalPiles, setTotalPiles] = useState<string>("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"email" | "user" | "field">("email")
  const [dialogValue, setDialogValue] = useState("")
  const [editIndex, setEditIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  // Kullanıcı yönetimi için state'ler
  const [dbUsers, setDbUsers] = useState<any[]>([])
  const [dbProjects, setDbProjects] = useState<any[]>([])
  const [userProjects, setUserProjects] = useState<{[key: number]: number[]}>({})
  const [addDbUserDialogOpen, setAddDbUserDialogOpen] = useState(false)
  const [addDbUserForm, setAddDbUserForm] = useState({ username: "", password: "", role: "user", siteId: "" as string | number })

  // Şantiye yönetimi
  const [dbSites, setDbSites] = useState<{ id: number; name: string; code: string; email_list: string[]; report_count?: number; total_piles?: number | null; region?: string | null; city?: string | null; country?: string | null; authorized_person?: string | null; employer?: string | null }[]>([])
  const [siteDialogOpen, setSiteDialogOpen] = useState(false)
  const [siteDialogData, setSiteDialogData] = useState<{ id?: number; name: string; code: string; emailList: string[]; totalPiles: string; region: string; city: string; country: string; authorizedPerson: string; employer: string }>({
    name: "",
    code: "",
    emailList: [],
    totalPiles: "",
    region: "",
    city: "",
    country: "",
    authorizedPerson: "",
    employer: "",
  })

  // Dashboard
  const [dashboardStats, setDashboardStats] = useState<{
    totalReports: number
    daily: { date: string; dayLabel: string; reportCount: number; piles: number; fuel?: number; production?: number; expenses?: number }[]
    weekly: { week: string; reportCount: number; piles: number }[]
    monthly: { month: string; reportCount: number; piles: number }[]
    machineComparison?: { machineName: string; totalProduction: number; totalPiles: number; reportCount: number }[]
  } | null>(null)
  const [recentReports, setRecentReports] = useState<any[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardSiteId, setDashboardSiteId] = useState<string>("")
  const [dashboardChartMetric, setDashboardChartMetric] = useState<"piles" | "fuel" | "production" | "expenses">("piles")

  const { t } = useLanguage()

  useEffect(() => {
    loadSettings()
    loadUsersAndProjects()
    loadSites()
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [dashboardSiteId])

  useEffect(() => {
    if (tabValue === 5) loadSites()
  }, [tabValue])

  const loadDashboard = async () => {
    setDashboardLoading(true)
    try {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 90)
      const params = new URLSearchParams({
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      })
      if (dashboardSiteId) params.set("siteId", dashboardSiteId)
      const [statsRes, rawRes] = await Promise.all([
        fetch(`/api/reports?${params}`),
        fetch(`/api/reports?${params}&raw=1&limit=10`),
      ])
      if (statsRes.ok) {
        const data = await statsRes.json()
        setDashboardStats({
          totalReports: data.totalReports ?? 0,
          daily: (data.daily || []).map((d: any) => ({ date: d.date, dayLabel: d.dayLabel ?? d.date, reportCount: d.reportCount ?? 0, piles: d.piles ?? 0, fuel: d.fuel ?? 0, production: d.production ?? 0, expenses: d.expenses ?? 0 })),
          weekly: (data.weekly || []).map((w: any) => ({ week: w.week, reportCount: w.reportCount ?? 0, piles: w.piles ?? 0, fuel: w.fuel ?? 0, production: w.production ?? 0, expenses: w.expenses ?? 0 })),
          monthly: (data.monthly || []).map((m: any) => ({ month: m.month, reportCount: m.reportCount ?? 0, piles: m.piles ?? 0, fuel: m.fuel ?? 0, production: m.production ?? 0, expenses: m.expenses ?? 0 })),
          machineComparison: data.machineComparison ?? [],
        })
      }
      if (rawRes.ok) setRecentReports(await rawRes.json())
    } catch (e) {
      console.error("Dashboard load error:", e)
    } finally {
      setDashboardLoading(false)
    }
  }

  const loadSites = async () => {
    try {
      const res = await fetch("/api/sites?withReportCount=1")
      if (res.ok) {
        const list = await res.json()
        setDbSites(list.map((s: any) => ({ ...s, email_list: s.email_list || [], report_count: s.report_count ?? 0 })))
      }
    } catch (e) {
      console.error("Error loading sites:", e)
    }
  }

  const loadUsersAndProjects = async () => {
    try {
      // Kullanıcıları yükle
      const usersResponse = await fetch("/api/users")
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setDbUsers(usersData.users || [])
        
        // Kullanıcı-proje ilişkilerini yükle
        const userProjectsMap: {[key: number]: number[]} = {}
        for (const user of usersData.users || []) {
          const userProjectsResponse = await fetch(`/api/users/${user.id}/projects`)
          if (userProjectsResponse.ok) {
            const userProjectsData = await userProjectsResponse.json()
            userProjectsMap[user.id] = userProjectsData.projects.map((p: any) => p.id)
          }
        }
        setUserProjects(userProjectsMap)
      }
      
      // Projeleri yükle
      const projectsResponse = await fetch("/api/projects")
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setDbProjects(projectsData.projects || [])
      }
    } catch (error) {
      console.error("Error loading users and projects:", error)
    }
  }

  const loadSettings = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/settings")
      if (response.ok) {
        const settings = await response.json()
        setEmails(settings.emails || ["admin@company.com", "manager@company.com"])
        setUsers(settings.users || ["admin", "manager"])
        setCustomFields(settings.customFields || ["Extra Field 1", "Extra Field 2"])
        setTotalPiles(settings.totalPiles || "100")
      } else {
        setError("Failed to load settings")
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      setError("Error loading settings")
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: emails.filter((email) => email.trim() !== ""),
          users: users.filter((user) => user.trim() !== ""),
          customFields: customFields.filter((field) => field.trim() !== ""),
          totalPiles: totalPiles,
        }),
      })

      if (response.ok) {
        alert(t("settings_saved"))
      } else {
        setError("Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      setError("Error saving settings")
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = (type: "email" | "user" | "field") => {
    setDialogType(type)
    setDialogValue("")
    setEditIndex(-1)
    setDialogOpen(true)
  }

  const handleEdit = (type: "email" | "user" | "field", index: number, value: string) => {
    setDialogType(type)
    setDialogValue(value)
    setEditIndex(index)
    setDialogOpen(true)
  }

  const handleDelete = (type: "email" | "user" | "field", index: number) => {
    if (confirm(t("confirm_delete"))) {
      switch (type) {
        case "email":
          setEmails((prev) => prev.filter((_, i) => i !== index))
          break
        case "user":
          setUsers((prev) => prev.filter((_, i) => i !== index))
          break
        case "field":
          setCustomFields((prev) => prev.filter((_, i) => i !== index))
          break
      }
    }
  }

  const handleDialogSave = () => {
    if (!dialogValue.trim()) {
      alert(t("field_required"))
      return
    }

    switch (dialogType) {
      case "email":
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(dialogValue)) {
          alert(t("invalid_email"))
          return
        }
        if (editIndex >= 0) {
          setEmails((prev) => prev.map((item, i) => (i === editIndex ? dialogValue.trim() : item)))
        } else {
          setEmails((prev) => [...prev, dialogValue.trim()])
        }
        break
      case "user":
        if (editIndex >= 0) {
          setUsers((prev) => prev.map((item, i) => (i === editIndex ? dialogValue.trim() : item)))
        } else {
          setUsers((prev) => [...prev, dialogValue.trim()])
        }
        break
      case "field":
        if (editIndex >= 0) {
          setCustomFields((prev) => prev.map((item, i) => (i === editIndex ? dialogValue.trim() : item)))
        } else {
          setCustomFields((prev) => [...prev, dialogValue.trim()])
        }
        break
    }
    setDialogOpen(false)
    setDialogValue("")
    setEditIndex(-1)
  }

  const getDialogTitle = () => {
    const action = editIndex >= 0 ? t("edit") : t("add")
    switch (dialogType) {
      case "email":
        return `${action} ${t("email")}`
      case "user":
        return `${action} ${t("user")}`
      case "field":
        return `${action} ${t("field")}`
      default:
        return action
    }
  }

  const getPlaceholder = () => {
    switch (dialogType) {
      case "email":
        return "example@company.com"
      case "user":
        return t("username")
      case "field":
        return t("field_name")
      default:
        return ""
    }
  }

  // Kullanıcı yönetimi fonksiyonları
  const handleUserRoleChange = async (userId: number, newRole: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      })
      
      if (response.ok) {
        // Kullanıcı listesini güncelle
        setDbUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ))
      }
    } catch (error) {
      console.error("Error updating user role:", error)
    }
  }

  const handleUserProjectAssign = async (userId: number, projectIds: number[]) => {
    try {
      const response = await fetch(`/api/users/${userId}/projects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: projectIds })
      })
      
      if (response.ok) {
        // Kullanıcı-proje ilişkilerini güncelle
        setUserProjects(prev => ({ ...prev, [userId]: projectIds }))
      }
    } catch (error) {
      console.error("Error updating user projects:", error)
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: "center", background: "#fafafa", minHeight: "100vh" }}>
        <Container maxWidth="lg">
          <Typography sx={{ color: "#333" }}>Yükleniyor...</Typography>
        </Container>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: "100vh", background: "#2c2f36", py: 3 }}>
      <Container maxWidth="lg">
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 2,
            background: "rgba(44, 47, 54, 0.6)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#e6edf3",
            "& .MuiListItemText-primary": { color: "#e6edf3" },
            "& .MuiListItemText-secondary": { color: "rgba(255,255,255,0.7)" },
            "& .MuiChip-label": { color: "#1a1a1a" },
            "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.9)" },
            "& .MuiInputLabel-root.Mui-focused": { color: "#4caf50" },
            "& .MuiFormLabel-root": { color: "rgba(255,255,255,0.9)" },
          }}
        >
          <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600, mb: 2 }}>
            {t("admin_panel")}
          </Typography>

        {error && (
          <Box sx={{ mb: 2, p: 2, backgroundColor: "error.light", color: "error.contrastText", borderRadius: 1 }}>
            <Typography>{error}</Typography>
          </Box>
        )}

        <Box sx={{ borderBottom: 1, borderColor: "rgba(255,255,255,0.2)" }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            sx={{
              "& .MuiTab-root": { color: "rgba(255,255,255,0.7)" },
              "& .Mui-selected": { color: "#fff", fontWeight: 600 },
              "& .MuiTabs-indicator": { backgroundColor: "#4caf50" },
            }}
          >
            <Tab label="Dashboard" icon={<Assessment />} iconPosition="start" />
            <Tab label={t("email_settings")} />
            <Tab label={t("user_management")} />
            <Tab label={t("custom_fields")} />
            <Tab label="Proje Ayarları" />
            <Tab label="Şantiyeler" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600 }}>
              Dashboard
            </Typography>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={() => loadDashboard()}
              disabled={dashboardLoading}
              sx={{ color: "#b0bec5" }}
            >
              Yenile
            </Button>
          </Box>
          {dashboardLoading ? (
            <Grid container spacing={2}>
              {[1, 2, 3, 4].map((i) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                  <Skeleton variant="rounded" height={100} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ background: "linear-gradient(135deg, #4caf50 0%, #43a047 100%)", color: "#fff", borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.9, mb: 0.5 }}>
                        <Assessment fontSize="small" /> Toplam Rapor
                      </Box>
                      <Typography variant="h4" sx={{ color: "#fff", fontWeight: 700 }}>
                        {dashboardStats?.totalReports ?? 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ background: "linear-gradient(135deg, #ec407a 0%, #e91e63 100%)", color: "#fff", borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.9, mb: 0.5 }}>
                        <Place fontSize="small" /> Şantiyeler
                      </Box>
                      <Typography variant="h4" sx={{ color: "#fff", fontWeight: 700 }}>
                        {dbSites.length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ background: "linear-gradient(135deg, #ffc107 0%, #ffb300 100%)", color: "#1a1a1a", borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.9, mb: 0.5 }}>
                        <TrendingUp fontSize="small" /> Bu hafta
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {dashboardStats?.weekly?.slice(-1)[0]?.reportCount ?? 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", color: "#fff", borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.9, mb: 0.5 }}>
                        Son 90 gün
                      </Box>
                      <Typography variant="h4" sx={{ color: "#fff", fontWeight: 700 }}>
                        {dashboardStats?.totalReports ?? 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="dashboard-site-label">Şantiye</InputLabel>
                  <Select
                    labelId="dashboard-site-label"
                    label="Şantiye"
                    value={dashboardSiteId}
                    onChange={(e) => setDashboardSiteId(e.target.value)}
                    sx={{ background: "#fff" }}
                  >
                    <MenuItem value="">Tüm şantiyeler</MenuItem>
                    {dbSites.map((s: any) => (
                      <MenuItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="chart-metric-label">Grafik verisi</InputLabel>
                  <Select
                    labelId="chart-metric-label"
                    label="Grafik verisi"
                    value={dashboardChartMetric}
                    onChange={(e) => setDashboardChartMetric(e.target.value as "piles" | "fuel" | "production" | "expenses")}
                    sx={{ background: "#fff" }}
                  >
                    <MenuItem value="piles">Kazık</MenuItem>
                    <MenuItem value="fuel">Mazot</MenuItem>
                    <MenuItem value="production">İmalat</MenuItem>
                    <MenuItem value="expenses">Harcama</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {(dashboardStats?.daily?.length ?? 0) > 0 && (
                <>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12 }}>
                      <Paper sx={{ p: 2, background: "#fff", border: "1px solid var(--icsp-nav-border)", height: "100%" }}>
                        <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>
                          Günlük — {dashboardChartMetric === "piles" ? "Kazık" : dashboardChartMetric === "fuel" ? "Mazot" : dashboardChartMetric === "production" ? "İmalat" : "Harcama"}
                        </Typography>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={dashboardStats?.daily ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis dataKey="dayLabel" tick={{ fill: "#616161", fontSize: 10 }} />
                            <YAxis tick={{ fill: "#616161", fontSize: 10 }} />
                            <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--icsp-nav-border)" }} />
                            <Legend />
                            <Bar
                              dataKey={dashboardChartMetric}
                              fill={dashboardChartMetric === "piles" ? "var(--icsp-lacivert)" : dashboardChartMetric === "fuel" ? "var(--icsp-kirmizi)" : dashboardChartMetric === "production" ? "#2e7d32" : "#ed6c02"}
                              name={dashboardChartMetric === "piles" ? "Kazık" : dashboardChartMetric === "fuel" ? "Mazot" : dashboardChartMetric === "production" ? "İmalat" : "Harcamalar"}
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Paper>
                    </Grid>
                  </Grid>
                  {(dashboardStats?.monthly?.length ?? 0) > 0 && (
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Paper sx={{ p: 2, background: "#fff", border: "1px solid var(--icsp-nav-border)", height: "100%" }}>
                          <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>Aylık Kazık / Üretim</Typography>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={dashboardStats?.monthly ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                              <XAxis dataKey="month" tick={{ fill: "#616161", fontSize: 10 }} />
                              <YAxis tick={{ fill: "#616161", fontSize: 10 }} />
                              <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--icsp-nav-border)" }} />
                              <Legend />
                              <Bar dataKey="piles" fill="var(--icsp-lacivert)" name="Kazık" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Paper sx={{ p: 2, background: "#fff", border: "1px solid var(--icsp-nav-border)", height: "100%" }}>
                          <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>Aylık Mazot & Harcamalar</Typography>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={dashboardStats?.monthly ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                              <XAxis dataKey="month" tick={{ fill: "#616161", fontSize: 10 }} />
                              <YAxis tick={{ fill: "#616161", fontSize: 10 }} />
                              <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--icsp-nav-border)" }} />
                              <Legend />
                              <Bar dataKey="fuel" fill="var(--icsp-kirmizi)" name="Mazot" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="expenses" fill="#ed6c02" name="Harcamalar" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Grid>
                    </Grid>
                  )}
                </>
              )}
              {(dashboardStats?.machineComparison?.length ?? 0) > 1 && (
                <Paper sx={{ p: 2, mb: 3, background: "#fff", border: "1px solid var(--icsp-nav-border)" }}>
                  <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>
                    Makine karşılaştırması (son 90 gün)
                  </Typography>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dashboardStats?.machineComparison ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="machineName" tick={{ fill: "#616161", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#616161", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--icsp-nav-border)" }} />
                      <Bar dataKey="totalProduction" fill="var(--icsp-lacivert)" name="İmalat (m)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="totalPiles" fill="var(--icsp-kirmizi)" name="Yapılan kazık" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              )}
              <Paper sx={{ background: "#fff", border: "1px solid var(--icsp-nav-border)", overflow: "hidden" }}>
                <Typography variant="subtitle1" sx={{ color: "var(--icsp-lacivert)", p: 2, borderBottom: "1px solid var(--icsp-nav-border)", fontWeight: 600 }}>
                  Son raporlar (bilgi girişi kayıtları)
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Tarih</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Proje</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Şantiye</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Makine</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>İmalat (m)</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Yapılan kazık</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Beton dökülen</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ color: "#616161", borderColor: "var(--icsp-nav-border)" }}>
                          Henüz rapor yok
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentReports.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.date}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.project}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.site_name || "—"}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.selected_machine_name || "—"}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.total_production_summary ?? r.total_production ?? "—"}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.daily_pile_count ?? r.total_pile_count ?? "—"}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.concrete_poured ?? "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600 }}>{t("email_recipients")}</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("email")}>
              {t("add_email")}
            </Button>
          </Box>
          <List>
            {emails.map((email, index) => (
              <ListItem key={index} divider>
                <ListItemText primary={email} />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => handleEdit("email", index, email)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete("email", index)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#e6edf3" }}>Kullanıcı Yönetimi</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => { setAddDbUserForm({ username: "", password: "", role: "user", siteId: "" }); setAddDbUserDialogOpen(true) }}>
              Kullanıcı Ekle
            </Button>
          </Box>
          <List>
            {dbUsers.map((user) => (
              <ListItem key={user.id} divider>
                <ListItemText 
                  primary={user.username} 
                  secondary={
                    <>
                      Rol: {user.role} | Email: {user.email || "N/A"}
                      {(user as any).site_name && (
                        <> | Sorumlu şantiye: <strong>{(user as any).site_name}</strong> ({(user as any).site_code})</>
                      )}
                    </>
                  }
                />
                <ListItemSecondaryAction sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Sorumlu şantiye</InputLabel>
                    <Select
                      value={(user as any).site_id ?? ""}
                      label="Sorumlu şantiye"
                      onChange={async (e) => {
                        const v = e.target.value
                        const siteId = v === "" ? null : Number(v)
                        try {
                          const res = await fetch(`/api/users/${user.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ siteId }),
                          })
                          if (res.ok) {
                            setDbUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, site_id: siteId, site_name: dbSites.find((s) => s.id === siteId)?.name, site_code: dbSites.find((s) => s.id === siteId)?.code } : u)))
                          }
                        } catch (err) {
                          console.error(err)
                        }
                      }}
                    >
                      <MenuItem value="">—</MenuItem>
                      {dbSites.map((s) => (
                        <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <IconButton onClick={() => handleEdit("user", user.id, user.username)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete("user", user.id)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#e6edf3" }}>{t("authorized_users")}</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("user")}>
              {t("add_user")}
            </Button>
          </Box>
          <List>
            {users.map((user, index) => (
              <ListItem key={index} divider>
                <ListItemText primary={user} />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => handleEdit("user", index, user)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete("user", index)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#e6edf3" }}>{t("custom_form_fields")}</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("field")}>
              {t("add_field")}
            </Button>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {customFields.map((field, index) => (
              <Chip
                key={index}
                label={field}
                onDelete={() => handleDelete("field", index)}
                onClick={() => handleEdit("field", index, field)}
                sx={{ cursor: "pointer" }}
              />
            ))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: "#e6edf3" }}>
              Proje Ayarları
            </Typography>
            <TextField
              fullWidth
              label="Toplam Kazık Sayısı"
              type="number"
              value={totalPiles}
              onChange={(e) => setTotalPiles(e.target.value)}
              helperText="Bu değer proje için sabit kalacak ve raporlarda kullanılacaktır"
              sx={{ mb: 2 }}
            />
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <Typography variant="subtitle2" sx={{ color: "rgba(255,255,255,0.8)", mb: 2 }}>
            Farklı şantiyeler tek veritabanında toplanır. Her şantiye için rapor e-postası alacak adresleri tanımlayın.
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600 }}>Şantiyeler</Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/seed-default-site")
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      await loadSites()
                      alert(data.message || "Şantiye eklendi.")
                    } else {
                      alert(data.error || "Eklenemedi.")
                    }
                  } catch (e) {
                    alert("İstek gönderilemedi. Veritabanı bağlantısını kontrol edin.")
                  }
                }}
              >
                North Light Shaqlawa (ICSP001) ekle
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setSiteDialogData({ name: "", code: "", emailList: [], totalPiles: "", region: "", city: "", country: "", authorizedPerson: "", employer: "" })
                  setSiteDialogOpen(true)
                }}
              >
                Şantiye Ekle
              </Button>
            </Box>
          </Box>
          <List>
            {dbSites.map((site) => (
              <ListItem key={site.id} divider>
                <ListItemText
                  primary={`${site.name} (${site.code})`}
                  secondary={
                    <>
                      {(site.email_list && site.email_list.length > 0)
                        ? `E-posta: ${site.email_list.slice(0, 2).join(", ")}${site.email_list.length > 2 ? "..." : ""} · `
                        : ""}
                      <strong>Rapor sayısı: {Number(site.report_count) || 0}</strong>
                      {site.total_piles != null ? ` · Proje toplam kazık: ${site.total_piles}` : ""}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                onClick={() => {
                  setSiteDialogData({
                    id: site.id,
                    name: site.name,
                    code: site.code,
                    emailList: site.email_list || [],
                    totalPiles: site.total_piles != null ? String(site.total_piles) : "",
                    region: site.region != null ? String(site.region) : "",
                    city: site.city != null ? String(site.city) : "",
                    country: site.country != null ? String(site.country) : "",
                    authorizedPerson: (site as any).authorized_person != null ? String((site as any).authorized_person) : "",
                    employer: (site as any).employer != null ? String((site as any).employer) : "",
                  })
                  setSiteDialogOpen(true)
                }}
                  >
                    <Edit />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          {dbSites.length === 0 && (
            <Typography sx={{ color: "#616161", py: 2 }}>
              Henüz şantiye yok. Formda şantiye seçeneği çıkmaz; raporlar varsayılan e-posta listesine gider.
            </Typography>
          )}
        </TabPanel>

        <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
          <Button variant="contained" size="large" onClick={saveSettings} disabled={loading}>
            {loading ? "Saving..." : t("save_settings")}
          </Button>
        </Box>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              fullWidth
              variant="outlined"
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              placeholder={getPlaceholder()}
              type={dialogType === "email" ? "email" : "text"}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={handleDialogSave} variant="contained">
              {t("save")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={siteDialogOpen} onClose={() => setSiteDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{siteDialogData.id ? "Şantiye Düzenle" : "Şantiye Ekle"}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              fullWidth
              label="Şantiye adı"
              value={siteDialogData.name}
              onChange={(e) => setSiteDialogData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Örn: SHAQLAWA Şantiyesi"
            />
            <TextField
              margin="dense"
              fullWidth
              label="Kod (benzersiz)"
              value={siteDialogData.code}
              onChange={(e) => setSiteDialogData((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s/g, "") }))}
              placeholder="Örn: SHAQ01"
              disabled={!!siteDialogData.id}
              helperText={siteDialogData.id ? "Kod düzenlenemez" : "Raporlarda görünecek kısa kod"}
            />
            <TextField margin="dense" fullWidth label="Yetkili kişi" value={siteDialogData.authorizedPerson} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, authorizedPerson: e.target.value }))} placeholder="Şantiye yetkilisi adı" />
            <TextField margin="dense" fullWidth label="İşveren" value={siteDialogData.employer} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, employer: e.target.value }))} placeholder="İşveren / firma adı" />
            <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }} color="text.secondary">Proje yeri</Typography>
            <Grid container spacing={1}>
              <Grid size={{ xs: 12 }}>
                <TextField margin="dense" fullWidth size="small" label="Ülke" value={siteDialogData.country} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, country: e.target.value }))} placeholder="Türkiye" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField margin="dense" fullWidth size="small" label="Bölge" value={siteDialogData.region} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, region: e.target.value }))} placeholder="Marmara" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField margin="dense" fullWidth size="small" label="Şehir" value={siteDialogData.city} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, city: e.target.value }))} placeholder="İstanbul" />
              </Grid>
            </Grid>
            <TextField
              margin="dense"
              fullWidth
              type="number"
              label="Projedeki toplam kazık sayısı"
              value={siteDialogData.totalPiles}
              onChange={(e) => setSiteDialogData((prev) => ({ ...prev, totalPiles: e.target.value }))}
              placeholder="Örn: 150"
              inputProps={{ min: 0 }}
            />
            <Typography variant="body2" sx={{ mt: 2, mb: 1 }} color="text.secondary">
              Rapor PDF’inin gideceği e-posta adresleri (her satıra bir adres)
            </Typography>
            <TextField
              margin="dense"
              fullWidth
              multiline
              minRows={3}
              value={siteDialogData.emailList.join("\n")}
              onChange={(e) =>
                setSiteDialogData((prev) => ({
                  ...prev,
                  emailList: e.target.value.split(/\n/).map((s) => s.trim()).filter(Boolean),
                }))
              }
              placeholder="admin@firma.com"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSiteDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              type="button"
              variant="contained"
              onClick={async () => {
                if (!siteDialogData.name.trim() || !siteDialogData.code.trim()) {
                  alert("Şantiye adı ve kod zorunludur.")
                  return
                }
                const payload = {
                  name: siteDialogData.name.trim(),
                  code: siteDialogData.code.trim(),
                  emailList: Array.isArray(siteDialogData.emailList) ? siteDialogData.emailList : [],
                  totalPiles: siteDialogData.totalPiles.trim() ? parseInt(siteDialogData.totalPiles, 10) || null : null,
                  region: siteDialogData.region.trim() || null,
                  city: siteDialogData.city.trim() || null,
                  country: siteDialogData.country.trim() || null,
                  authorizedPerson: siteDialogData.authorizedPerson.trim() || null,
                  employer: siteDialogData.employer.trim() || null,
                }
                try {
                    if (siteDialogData.id) {
                    const res = await fetch(`/api/sites/${siteDialogData.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      await loadSites()
                      setSiteDialogOpen(false)
                    } else {
                      alert(data.error || data.message || `Güncelleme başarısız (${res.status})`)
                    }
                  } else {
                    const res = await fetch("/api/sites", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      await loadSites()
                      setSiteDialogOpen(false)
                    } else {
                      const msg = data.error || data.message || (res.status === 500 ? "Veritabanı hatası. .env.local ve PostgreSQL bağlantısını kontrol edin." : `Ekleme başarısız (${res.status})`)
                      alert(msg)
                    }
                  }
                } catch (e) {
                  const err = e instanceof Error ? e.message : String(e)
                  console.error("Şantiye kaydetme hatası:", e)
                  alert("İstek gönderilemedi: " + err)
                }
              }}
            >
              {t("save")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={addDbUserDialogOpen} onClose={() => setAddDbUserDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Yeni kullanıcı (yetkili kişi)</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" fullWidth label="Kullanıcı adı" value={addDbUserForm.username} onChange={(e) => setAddDbUserForm((p) => ({ ...p, username: e.target.value }))} />
            <TextField margin="dense" fullWidth type="password" label="Şifre" value={addDbUserForm.password} onChange={(e) => setAddDbUserForm((p) => ({ ...p, password: e.target.value }))} />
            <FormControl fullWidth margin="dense">
              <InputLabel>Rol</InputLabel>
              <Select value={addDbUserForm.role} label="Rol" onChange={(e) => setAddDbUserForm((p) => ({ ...p, role: e.target.value }))}>
                <MenuItem value="user">Kullanıcı</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense">
              <InputLabel>Sorumlu olduğu şantiye</InputLabel>
              <Select value={addDbUserForm.siteId === "" ? "" : addDbUserForm.siteId} label="Sorumlu olduğu şantiye" onChange={(e) => setAddDbUserForm((p) => ({ ...p, siteId: e.target.value === "" ? "" : Number(e.target.value) }))}>
                <MenuItem value="">— Yok</MenuItem>
                {dbSites.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddDbUserDialogOpen(false)}>İptal</Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (!addDbUserForm.username.trim()) {
                  alert("Kullanıcı adı gerekli.")
                  return
                }
                if (!addDbUserForm.password.trim()) {
                  alert("Şifre gerekli.")
                  return
                }
                try {
                  const res = await fetch("/api/users", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      username: addDbUserForm.username.trim(),
                      password: addDbUserForm.password,
                      role: addDbUserForm.role,
                      siteId: addDbUserForm.siteId === "" ? null : addDbUserForm.siteId,
                    }),
                  })
                  const data = await res.json().catch(() => ({}))
                  if (res.ok) {
                    setAddDbUserDialogOpen(false)
                    await loadUsersAndProjects()
                  } else {
                    alert(data.error || "Kullanıcı eklenemedi.")
                  }
                } catch (e) {
                  alert("İstek gönderilemedi.")
                }
              }}
            >
              Ekle
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
      </Container>
    </Box>
  )
}

export default function AdminPage() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider>
        <AdminPanel />
      </LanguageProvider>
    </ThemeProvider>
  )
}
