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
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  FormLabel,
} from "@mui/material"
import { Delete, Add, Edit, Assessment, Place, TrendingUp, Refresh, Visibility, Notifications, NotificationsActive, Close } from "@mui/icons-material"
import Badge from "@mui/material/Badge"
import Snackbar from "@mui/material/Snackbar"
import Alert from "@mui/material/Alert"
import Drawer from "@mui/material/Drawer"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { theme } from "@/lib/theme"
import { LanguageProvider, useLanguage } from "@/contexts/language-context"
import LanguageSelector from "@/components/language-selector"
import { useAuth } from "@/contexts/auth-context"

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

const USER_MODULE_DEFS: { key: string; label: string }[] = [
  { key: "personel", label: "Personel" },
  { key: "envanter", label: "Envanter" },
  { key: "harcamalar", label: "Harcamalar" },
  { key: "puantaj", label: "Puantaj" },
  { key: "bilgi_giris", label: "Bilgi girişi (rapor)" },
  { key: "yonetici_panel", label: "Yönetici paneli" },
  { key: "makineler", label: "Makineler" },
]

type ModPermLevel = "off" | "view" | "write"

function defaultDbUserModulePerms(): Record<string, ModPermLevel> {
  return Object.fromEntries(USER_MODULE_DEFS.map((d) => [d.key, "off" as ModPermLevel]))
}

function roleLabelTr(role: string): string {
  const m: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Yönetici",
    manager: "Manager",
    user: "İdari / Kullanıcı",
    personel: "Personel",
    operator: "Operatör",
  }
  return m[role] || role
}

function normalizeModulePerms(raw: unknown): Record<string, ModPermLevel> {
  const base = defaultDbUserModulePerms()
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const k of Object.keys(base)) {
      const v = (raw as Record<string, unknown>)[k]
      if (v === "view" || v === "write" || v === "off") base[k] = v
    }
    // Preserve view_all_sites (set by "Genel" site selection, not in UI module defs)
    const vas = (raw as Record<string, unknown>).view_all_sites
    if (vas === "view" || vas === "write" || vas === "off") base.view_all_sites = vas
  }
  return base
}

function AdminPanel() {
  const { user } = useAuth()
  const currentRole = String(user?.role ?? "")
  const isSuperAdmin = currentRole === "super_admin"
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

  // SSE bildirimleri
  const [notifications, setNotifications] = useState<{ id: string; type: string; title: string; message: string; siteName?: string; anomalyCount?: number; timestamp: number }[]>([])
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false)
  const [newNotifSnack, setNewNotifSnack] = useState<{ open: boolean; message: string; severity: "info" | "warning" }>({ open: false, message: "", severity: "info" })
  const unreadCount = notifications.filter(n => n.timestamp > (typeof window !== "undefined" ? parseInt(localStorage.getItem("notif_last_read") || "0", 10) : 0)).length

  // E-posta araçları
  const [testEmailLoading, setTestEmailLoading] = useState(false)
  const [testEmailMsg, setTestEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false)
  const [dailySummaryMsg, setDailySummaryMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Kullanıcı yönetimi için state'ler
  const [dbUsers, setDbUsers] = useState<any[]>([])
  const [dbProjects, setDbProjects] = useState<any[]>([])
  const [userProjects, setUserProjects] = useState<{[key: number]: number[]}>({})
  const [dbUserDialogOpen, setDbUserDialogOpen] = useState(false)
  const [dbUserEditingId, setDbUserEditingId] = useState<number | null>(null)
  const [dbUserForm, setDbUserForm] = useState({
    username: "",
    password: "",
    email: "",
    role: "user" as string,
    siteId: "" as string | number,
    personelMode: "none" as "none" | "list" | "new",
    personelId: "" as string | number,
    newPersonelAd: "",
    newPersonelSoyad: "",
    newPersonelGorev: "İşçi",
    modulePerms: defaultDbUserModulePerms(),
  })

  // Şantiye yönetimi
  const [dbSites, setDbSites] = useState<{ id: number; name: string; code: string; email_list: string[]; report_count?: number; total_piles?: number | null; contract_unit_price?: number | null; region?: string | null; city?: string | null; country?: string | null; authorized_person?: string | null; employer?: string | null; assigned_machine_operators?: { machineId: string; personelId: number }[] }[]>([])
  const [personelList, setPersonelList] = useState<{ id: number; ad: string; soyad: string; gorev: string }[]>([])
  const [siteDialogOpen, setSiteDialogOpen] = useState(false)
  const [idariMachineOptions, setIdariMachineOptions] = useState<{ id: number; name: string; machine_type: string; marka?: string | null; model?: string | null; plaka_no?: string | null; seri_no?: string | null; status?: string | null; current_site_id: number | null }[]>([])
  const [siteDialogData, setSiteDialogData] = useState<{ id?: number; name: string; code: string; country: string; timezone: string; emailList: string[]; totalPiles: string; contractUnitPrice: string; authorizedPerson: string; employer: string; projectStartDate: string; isOngoing: boolean; initialPilesDone: string; assignedMachineIds: string[]; assignedOperatorIds: number[]; assignedMachineOperators: { machineId: string; personelId: number }[] }>({
    name: "",
    code: "",
    country: "",
    timezone: "",
    emailList: [],
    totalPiles: "",
    contractUnitPrice: "",
    authorizedPerson: "",
    employer: "",
    projectStartDate: "",
    isOngoing: false,
    initialPilesDone: "",
    assignedMachineIds: [],
    assignedOperatorIds: [],
    assignedMachineOperators: [],
  })

  // Dashboard
  const [dashboardStats, setDashboardStats] = useState<{
    totalReports: number
    daily: { date: string; dayLabel: string; reportCount: number; piles: number; fuel?: number; production?: number; expenses?: number }[]
    weekly: { week: string; reportCount: number; piles: number }[]
    monthly: { month: string; reportCount: number; piles: number }[]
    machineComparison?: { machineName: string; totalProduction: number; totalPiles: number; reportCount: number }[]
    expenseDistribution?: Record<string, number>
  } | null>(null)
  const [recentReports, setRecentReports] = useState<any[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardSiteId, setDashboardSiteId] = useState<string>("")
  const [dashboardChartMetric, setDashboardChartMetric] = useState<"piles" | "fuel" | "production" | "expenses">("piles")

  // Raporlar sekmesi
  const [reportList, setReportList] = useState<any[]>([])
  const [reportListLoading, setReportListLoading] = useState(false)
  const [reportFilterStart, setReportFilterStart] = useState("")
  const [reportFilterEnd, setReportFilterEnd] = useState("")
  const [reportFilterSiteId, setReportFilterSiteId] = useState<string>("")
  const [reportEditDialog, setReportEditDialog] = useState<{ open: boolean; report: any }>({ open: false, report: null })
  const [reportEditForm, setReportEditForm] = useState<{ date: string; project: string; notes: string; totalProductionSummary: string; dailyPileCount: string; remainingPiles: string; dailyFuelUsage: string; personnelTotal: string }>({ date: "", project: "", notes: "", totalProductionSummary: "", dailyPileCount: "", remainingPiles: "", dailyFuelUsage: "", personnelTotal: "" })
  const [reportDeleteId, setReportDeleteId] = useState<number | null>(null)

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
    if (tabValue === 2 || tabValue === 3) {
      if (tabValue === 3) loadSites()
      fetch("/api/idari/personel?limit=500")
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((res: { data?: { id: number; ad: string; soyad: string; gorev: string }[] } | { id: number; ad: string; soyad: string; gorev: string }[]) => {
          setPersonelList(Array.isArray(res) ? res : (res.data ?? []))
        })
        .catch(() => setPersonelList([]))
    }
  }, [tabValue])

  useEffect(() => {
    if (!siteDialogOpen) return
    fetch("/api/idari/makineler")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: number; name: string; machine_type: string; marka?: string | null; model?: string | null; plaka_no?: string | null; seri_no?: string | null; status?: string | null; current_site_id: number | null }[]) => {
        setIdariMachineOptions(Array.isArray(list) ? list : [])
      })
      .catch(() => setIdariMachineOptions([]))
  }, [siteDialogOpen])
  useEffect(() => {
    if (tabValue === 4) loadReportList()
  }, [tabValue])

  // SSE bağlantısı
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream")
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "connected") return
        setNotifications((prev) => {
          // Tekrar önleme
          if (prev.some((n) => n.id === data.id)) return prev
          return [data, ...prev].slice(0, 50)
        })
        const severity = data.anomalyCount > 0 ? "warning" : "info"
        setNewNotifSnack({ open: true, message: `${data.title}: ${data.message}`, severity })
      } catch {}
    }
    es.onerror = () => {
      // Bağlantı koptu — tarayıcı otomatik yeniden bağlanır
    }
    return () => es.close()
  }, [])

  const loadReportList = async () => {
    setReportListLoading(true)
    try {
      const params = new URLSearchParams({ raw: "1", limit: "50" })
      if (reportFilterStart) params.set("startDate", reportFilterStart)
      if (reportFilterEnd) params.set("endDate", reportFilterEnd)
      if (reportFilterSiteId) params.set("siteId", reportFilterSiteId)
      const res = await fetch(`/api/reports?${params}`)
      if (res.ok) {
        const data = await res.json()
        setReportList(Array.isArray(data) ? data : [])
      } else {
        setReportList([])
      }
    } catch (e) {
      console.error("Report list load error:", e)
      setReportList([])
    } finally {
      setReportListLoading(false)
    }
  }

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
          expenseDistribution: data.expenseDistribution ?? {},
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

  const handleTestEmail = async () => {
    setTestEmailLoading(true)
    setTestEmailMsg(null)
    try {
      const res = await fetch("/api/admin/test-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      const data = await res.json()
      if (data.ok) {
        setTestEmailMsg({ ok: true, text: data.message || "Test e-postası gönderildi." })
      } else {
        setTestEmailMsg({ ok: false, text: data.error || "Gönderilemedi." })
      }
    } catch {
      setTestEmailMsg({ ok: false, text: "Bağlantı hatası." })
    } finally {
      setTestEmailLoading(false)
    }
  }

  const handleDailySummary = async () => {
    setDailySummaryLoading(true)
    setDailySummaryMsg(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch("/api/admin/daily-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, recipients: emails.filter(e => e.trim()) }),
      })
      const data = await res.json()
      if (data.ok && data.emailSent) {
        setDailySummaryMsg({ ok: true, text: `Günlük özet ${data.recipients?.join(", ")} adreslerine gönderildi. (${data.totalReports} rapor)` })
      } else if (data.ok) {
        setDailySummaryMsg({ ok: false, text: data.emailError || "SMTP yapılandırılmamış. Özet oluşturuldu ama gönderilemedi." })
      } else {
        setDailySummaryMsg({ ok: false, text: data.error || "Hata oluştu." })
      }
    } catch {
      setDailySummaryMsg({ ok: false, text: "Bağlantı hatası." })
    } finally {
      setDailySummaryLoading(false)
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

  const openDbUserDialog = (user?: Record<string, unknown>) => {
    if (user?.id != null) {
      setDbUserEditingId(Number(user.id))
      setDbUserForm({
        username: String(user.username ?? ""),
        password: "",
        email: String(user.email ?? ""),
        role: String(user.role ?? "user"),
        siteId: user.site_id != null
          ? Number(user.site_id)
          : ((user.module_permissions as Record<string, string> | null)?.view_all_sites === "write" ? "genel" : ""),
        personelMode: "none",
        personelId: "",
        newPersonelAd: "",
        newPersonelSoyad: "",
        newPersonelGorev: "İşçi",
        modulePerms: normalizeModulePerms(user.module_permissions),
      })
    } else {
      setDbUserEditingId(null)
      setDbUserForm({
        username: "",
        password: "",
        email: "",
        role: "user",
        siteId: "",
        personelMode: "none",
        personelId: "",
        newPersonelAd: "",
        newPersonelSoyad: "",
        newPersonelGorev: "İşçi",
        modulePerms: defaultDbUserModulePerms(),
      })
    }
    setDbUserDialogOpen(true)
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
    <Box sx={{ minHeight: "100vh", background: "#f5f5f5", py: { xs: 1, sm: 3 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 3 },
            borderRadius: 2,
            background: "#fff",
            border: "1px solid #e0e0e0",
            color: "#333",
            "& .MuiListItemText-primary": { color: "#333" },
            "& .MuiListItemText-secondary": { color: "#616161" },
            "& .MuiChip-label": { color: "#1a1a1a" },
            "& .MuiInputLabel-root": { color: "rgba(0,0,0,0.6)" },
            "& .MuiInputLabel-root.Mui-focused": { color: "#1a237e" },
            "& .MuiFormLabel-root": { color: "rgba(0,0,0,0.6)" },
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#1a237e", fontWeight: 600 }}>
              {t("admin_panel")}
            </Typography>
            <IconButton
              onClick={() => {
                setNotifDrawerOpen(true)
                if (typeof window !== "undefined") localStorage.setItem("notif_last_read", String(Date.now()))
              }}
              sx={{ color: notifications.length > 0 ? "#1a237e" : "#9e9e9e" }}
            >
              <Badge badgeContent={unreadCount} color="error" max={9}>
                {unreadCount > 0 ? <NotificationsActive /> : <Notifications />}
              </Badge>
            </IconButton>
          </Box>

        {error && (
          <Box sx={{ mb: 2, p: 2, backgroundColor: "#ffebee", color: "#c62828", borderRadius: 1 }}>
            <Typography>{error}</Typography>
          </Box>
        )}

        <Box sx={{ borderBottom: 1, borderColor: "#e0e0e0" }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              "& .MuiTab-root": { color: "#616161", minWidth: { xs: 80, sm: 120 }, fontSize: { xs: "0.75rem", sm: "0.875rem" }, px: { xs: 1, sm: 2 } },
              "& .Mui-selected": { color: "#1a237e", fontWeight: 600 },
              "& .MuiTabs-indicator": { backgroundColor: "#1a237e" },
            }}
          >
            <Tab label="Dashboard" icon={<Assessment />} iconPosition="start" />
            <Tab label={t("email_settings")} />
            <Tab label={t("user_management")} />
            <Tab label="Şantiyeler" />
            <Tab label="Raporlar" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#1a237e", fontWeight: 600 }}>
              Dashboard
            </Typography>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={() => loadDashboard()}
              disabled={dashboardLoading}
              sx={{ color: "#616161" }}
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
                    <MenuItem value="piles">Kazık Sayısı (Ad.)</MenuItem>
                    <MenuItem value="fuel">Mazot Miktarı (lt)</MenuItem>
                    <MenuItem value="production">Kazık İmalatı (m)</MenuItem>
                    <MenuItem value="expenses">Harcama (IQD)</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {(dashboardStats?.daily?.length ?? 0) > 0 && (
                <>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12 }}>
                      <Paper sx={{ p: 2, background: "#fff", border: "1px solid var(--icsp-nav-border)", height: "100%" }}>
                        <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>
                          Günlük — {dashboardChartMetric === "piles" ? "Kazık Sayısı (Ad.)" : dashboardChartMetric === "fuel" ? "Mazot Miktarı (lt)" : dashboardChartMetric === "production" ? "Kazık İmalatı (m)" : "Harcama (IQD)"}
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
                              name={dashboardChartMetric === "piles" ? "Kazık Sayısı (Ad.)" : dashboardChartMetric === "fuel" ? "Mazot Miktarı (lt)" : dashboardChartMetric === "production" ? "Kazık İmalatı (m)" : "Harcama (IQD)"}
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
                          <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>Aylık Kazık Sayısı (Ad.) / Kazık İmalatı (m)</Typography>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={dashboardStats?.monthly ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                              <XAxis dataKey="month" tick={{ fill: "#616161", fontSize: 10 }} />
                              <YAxis tick={{ fill: "#616161", fontSize: 10 }} />
                              <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--icsp-nav-border)" }} />
                              <Legend />
                              <Bar dataKey="piles" fill="var(--icsp-lacivert)" name="Kazık Sayısı (Ad.)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Paper sx={{ p: 2, background: "#fff", border: "1px solid var(--icsp-nav-border)", height: "100%" }}>
                          <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>Aylık Mazot Miktarı (lt) & Harcama (IQD)</Typography>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={dashboardStats?.monthly ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                              <XAxis dataKey="month" tick={{ fill: "#616161", fontSize: 10 }} />
                              <YAxis tick={{ fill: "#616161", fontSize: 10 }} />
                              <Tooltip contentStyle={{ background: "#fff", border: "1px solid var(--icsp-nav-border)" }} />
                              <Legend />
                              <Bar dataKey="fuel" fill="var(--icsp-kirmizi)" name="Mazot Miktarı (lt)" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="expenses" fill="#ed6c02" name="Harcama (IQD)" radius={[4, 4, 0, 0]} />
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
                      <Bar dataKey="totalProduction" fill="var(--icsp-lacivert)" name="Kazık İmalatı (m)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="totalPiles" fill="var(--icsp-kirmizi)" name="Kazık Sayısı (Ad.)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              )}
              {(() => {
                const dist = dashboardStats?.expenseDistribution ?? {}
                const expenseLabels: Record<string, string> = { santiye: "Şantiye", makine: "Makine (Kazık makinesi)", personel: "Personel", yakit: "Yakıt", diger: "Diğer" }
                const pieData = ["santiye", "makine", "personel", "yakit", "diger"].map((key) => ({ name: expenseLabels[key], value: dist[key] || 0 })).filter((d) => d.value > 0)
                const totalExpense = pieData.reduce((s, d) => s + d.value, 0)
                const colors = ["#4caf50", "#2196f3", "#ff9800", "#9c27b0", "#607d8b"]
                return (totalExpense > 0 && (
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, md: 5 }}>
                      <Paper sx={{ p: 2, background: "#fff", border: "1px solid var(--icsp-nav-border)", height: "100%" }}>
                        <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>Harcama dağılımı (grafik)</Typography>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${e.name}: ${(e.value / totalExpense * 100).toFixed(0)}%`}>
                              {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => [v.toLocaleString() + " IQD", "Tutar"]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 7 }}>
                      <Paper sx={{ p: 2, background: "#fff", border: "1px solid var(--icsp-nav-border)", height: "100%" }}>
                        <Typography variant="subtitle2" sx={{ color: "var(--icsp-lacivert)", mb: 2, fontWeight: 600 }}>Harcama tutarları (türe göre)</Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 600 }}>Harcama türü</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Tutar (IQD)</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>Oran</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {pieData.map((row) => (
                              <TableRow key={row.name}>
                                <TableCell>{row.name}</TableCell>
                                <TableCell align="right">{row.value.toLocaleString()}</TableCell>
                                <TableCell align="right">{totalExpense > 0 ? ((row.value / totalExpense) * 100).toFixed(1) : "0"}%</TableCell>
                              </TableRow>
                            ))}
                            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                              <TableCell sx={{ fontWeight: 600 }}>Toplam</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>{totalExpense.toLocaleString()}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>100%</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </Paper>
                    </Grid>
                  </Grid>
                ))
              })()}
              <Paper sx={{ background: "#fff", border: "1px solid var(--icsp-nav-border)", overflow: "hidden" }}>
                <Typography variant="subtitle1" sx={{ color: "var(--icsp-lacivert)", p: 2, borderBottom: "1px solid var(--icsp-nav-border)", fontWeight: 600 }}>
                  Son raporlar (bilgi girişi kayıtları)
                </Typography>
                <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Tarih</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Proje</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Şantiye</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Makine</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Kazık İmalatı (m)</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Kazık Sayısı (Ad.)</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Beton dökülen</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Kalan kazık (Ad.)</TableCell>
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Mazot (lt) / not</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} sx={{ color: "#616161", borderColor: "var(--icsp-nav-border)" }}>
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
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{[r.daily_pile_count, r.total_pile_count, r.concrete_poured].find((v) => v != null && String(v).trim() !== "") ?? "—"}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.concrete_poured != null && String(r.concrete_poured).trim() !== "" ? r.concrete_poured : "—"}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.remaining_piles != null && String(r.remaining_piles).trim() !== "" ? r.remaining_piles : "—"}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.daily_fuel_usage != null && String(r.daily_fuel_usage).trim() !== "" ? r.daily_fuel_usage : "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </Box>
              </Paper>
            </>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#1a237e", fontWeight: 600 }}>{t("email_recipients")}</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("email")}>
              {t("add_email")}
            </Button>
          </Box>
          <List>
            {emails.map((email, index) => (
              <ListItem key={index} divider>
                <ListItemText primary={email} />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => handleEdit("email", index, email)} sx={{ color: "#616161" }}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete("email", index)} sx={{ color: "#616161" }}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>

          {/* E-posta araçları */}
          <Box sx={{ mt: 3, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, background: "#f8fafc" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#1a237e", mb: 1.5 }}>
              E-posta Araçları
            </Typography>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleTestEmail}
                disabled={testEmailLoading}
                sx={{ borderColor: "#2563eb", color: "#2563eb" }}
              >
                {testEmailLoading ? "Gönderiliyor..." : "✉️ Test E-postası Gönder"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleDailySummary}
                disabled={dailySummaryLoading}
                sx={{ borderColor: "#16a34a", color: "#16a34a" }}
              >
                {dailySummaryLoading ? "Oluşturuluyor..." : "📊 Bugünkü Özeti Gönder"}
              </Button>
            </Box>
            {testEmailMsg && (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, background: testEmailMsg.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${testEmailMsg.ok ? "#bbf7d0" : "#fecaca"}` }}>
                <Typography variant="caption" sx={{ color: testEmailMsg.ok ? "#16a34a" : "#dc2626" }}>
                  {testEmailMsg.ok ? "✅ " : "❌ "}{testEmailMsg.text}
                </Typography>
              </Box>
            )}
            {dailySummaryMsg && (
              <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, background: dailySummaryMsg.ok ? "#f0fdf4" : "#fffbeb", border: `1px solid ${dailySummaryMsg.ok ? "#bbf7d0" : "#fde68a"}` }}>
                <Typography variant="caption" sx={{ color: dailySummaryMsg.ok ? "#16a34a" : "#d97706" }}>
                  {dailySummaryMsg.ok ? "✅ " : "⚠️ "}{dailySummaryMsg.text}
                </Typography>
              </Box>
            )}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#1a237e" }}>Kullanıcı Yönetimi</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => openDbUserDialog()} sx={{ background: "var(--icsp-lacivert)" }}>
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
                      {(user as { email?: string }).email ? `${(user as { email?: string }).email} · ` : ""}
                      Şantiye: {(user as { site_name?: string }).site_name ? <strong>{(user as { site_name?: string }).site_name}</strong> : "—"}
                      {" · "}
                      Kullanıcı tipi: {roleLabelTr(String(user.role))}
                    </>
                  }
                />
                <ListItemSecondaryAction sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <IconButton onClick={() => openDbUserDialog(user as Record<string, unknown>)} sx={{ color: "#616161" }} title="Düzenle">
                    <Edit />
                  </IconButton>
                  <IconButton
                    onClick={async () => {
                      if (!confirm("Bu veritabanı kullanıcısını silmek istediğinize emin misiniz?")) return
                      try {
                        const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
                        if (res.ok) await loadUsersAndProjects()
                        else {
                          const data = await res.json().catch(() => ({}))
                          alert(data.error || "Silinemedi.")
                        }
                      } catch {
                        alert("İstek gönderilemedi.")
                      }
                    }}
                    sx={{ color: "#616161" }}
                    title="Sil"
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ color: "#1a237e" }}>{t("authorized_users")}</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("user")}>
              {t("add_user")}
            </Button>
          </Box>
          <List>
            {users.map((user, index) => (
              <ListItem key={index} divider>
                <ListItemText primary={user} />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => handleEdit("user", index, user)} sx={{ color: "#616161" }}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete("user", index)} sx={{ color: "#616161" }}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="subtitle2" sx={{ color: "#616161", mb: 2 }}>
            Farklı şantiyeler tek veritabanında toplanır. Her şantiye için rapor e-postası alacak adresleri tanımlayın.
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h6" sx={{ color: "#1a237e", fontWeight: 600 }}>Şantiyeler</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                setSiteDialogData({ name: "", code: "", country: "", timezone: "", emailList: [], totalPiles: "", contractUnitPrice: "", authorizedPerson: "", employer: "", projectStartDate: "", isOngoing: false, initialPilesDone: "", assignedMachineIds: [], assignedOperatorIds: [], assignedMachineOperators: [] })
                if (personelList.length === 0) fetch("/api/idari/personel?limit=500").then((r) => (r.ok ? r.json() : { data: [] })).then((res: any) => setPersonelList(Array.isArray(res) ? res : (res.data ?? []))).catch(() => {})
                setSiteDialogOpen(true)
              }}
            >
              Şantiye Ekle
            </Button>
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
                      {site.total_piles != null ? ` · Proje toplam kazık sayısı (Ad.): ${site.total_piles}` : ""}
                      {isSuperAdmin && site.contract_unit_price != null ? ` · Birim fiyat: ${Number(site.contract_unit_price).toLocaleString("tr-TR")} /m` : ""}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                sx={{ color: "#1a237e" }}
                onClick={() => {
                  const run = async () => {
                    const ops = Array.isArray((site as any).assigned_machine_operators) ? (site as any).assigned_machine_operators : []
                    let assignedIds = Array.isArray((site as any).assigned_machine_ids)
                      ? (site as any).assigned_machine_ids.map((x: unknown) => String(x))
                      : []
                    try {
                      const r = await fetch(`/api/idari/makineler?siteId=${site.id}`)
                      if (r.ok) {
                        const list = await r.json()
                        if (Array.isArray(list)) {
                          const fromDb = list
                            .filter((m: { machine_type: string }) => m.machine_type === "Kazık Makinesi")
                            .map((m: { id: number }) => String(m.id))
                          assignedIds = [...new Set([...assignedIds, ...fromDb])]
                        }
                      }
                    } catch { /* ignore */ }
                    setSiteDialogData({
                      id: site.id,
                      name: site.name,
                      code: site.code,
                      country: (site as any).country != null ? String((site as any).country) : "",
                      timezone: (site as any).timezone != null ? String((site as any).timezone) : "",
                      emailList: site.email_list || [],
                      totalPiles: site.total_piles != null ? String(site.total_piles) : "",
                      contractUnitPrice: (site as any).contract_unit_price != null ? String((site as any).contract_unit_price) : "",
                      authorizedPerson: (site as any).authorized_person != null ? String((site as any).authorized_person) : "",
                      employer: (site as any).employer != null ? String((site as any).employer) : "",
                      projectStartDate: (site as any).project_start_date ? String((site as any).project_start_date).slice(0, 10) : "",
                      isOngoing: (site as any).is_ongoing === true,
                      initialPilesDone: (site as any).initial_piles_done != null ? String((site as any).initial_piles_done) : "",
                      assignedMachineIds: assignedIds,
                      assignedOperatorIds: Array.isArray((site as any).assigned_operator_ids) ? (site as any).assigned_operator_ids.map((x: unknown) => Number(x)).filter((n: number) => !Number.isNaN(n)) : [],
                      assignedMachineOperators: ops.map((o: any) => ({ machineId: String(o.machineId ?? o.machine_id ?? ""), personelId: Number(o.personelId ?? o.personel_id ?? 0) })).filter((o: { machineId: string; personelId: number }) => o.machineId && o.personelId > 0),
                    })
                    setSiteDialogOpen(true)
                  }
                  void run()
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

        <TabPanel value={tabValue} index={4}>
          <Typography variant="h6" sx={{ color: "#1a237e", fontWeight: 600, mb: 2 }}>Raporlar</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
            <TextField
              size="small"
              type="date"
              label="Başlangıç tarihi"
              value={reportFilterStart}
              onChange={(e) => setReportFilterStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ background: "#fff", minWidth: 160 }}
            />
            <TextField
              size="small"
              type="date"
              label="Bitiş tarihi"
              value={reportFilterEnd}
              onChange={(e) => setReportFilterEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ background: "#fff", minWidth: 160 }}
            />
            <FormControl size="small" sx={{ minWidth: 200, background: "#fff" }}>
              <InputLabel>Şantiye</InputLabel>
              <Select
                value={reportFilterSiteId}
                label="Şantiye"
                onChange={(e) => setReportFilterSiteId(e.target.value)}
              >
                <MenuItem value="">Tümü</MenuItem>
                {dbSites.map((s: any) => (
                  <MenuItem key={s.id} value={String(s.id)}>{s.name} ({s.code})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={loadReportList} disabled={reportListLoading}>
              {reportListLoading ? "Yükleniyor..." : "Filtrele / Listele"}
            </Button>
          </Box>
          <Paper sx={{ background: "#fff", border: "1px solid var(--icsp-nav-border)", overflow: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Tarih</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Proje</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Şantiye</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Makine</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Kazık Sayısı</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Kalan</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportListLoading ? (
                  <TableRow><TableCell colSpan={7}>Yükleniyor...</TableCell></TableRow>
                ) : reportList.length === 0 ? (
                  <TableRow><TableCell colSpan={7}>Rapor bulunamadı.</TableCell></TableRow>
                ) : (
                  reportList.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{typeof r.date === "string" ? r.date.slice(0, 10) : r.date}</TableCell>
                      <TableCell>{r.project ?? "—"}</TableCell>
                      <TableCell>{r.site_name ?? "—"}</TableCell>
                      <TableCell>{r.selected_machine_name ?? "—"}</TableCell>
                      <TableCell>{[r.daily_pile_count, r.total_pile_count, r.concrete_poured].find((v) => v != null && String(v).trim() !== "") ?? "—"}</TableCell>
                      <TableCell>{r.remaining_piles != null && String(r.remaining_piles).trim() !== "" ? r.remaining_piles : "—"}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => window.open(`/api/reports/${r.id}/preview`, "_blank")} title="Görüntüle" sx={{ color: "#1976d2" }}>
                          <Visibility />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setReportEditDialog({ open: true, report: r })
                            const d = r.date && String(r.date).slice(0, 10)
                            const dailyVal = [r.daily_pile_count, r.total_pile_count, r.concrete_poured].find((v) => v != null && String(v).trim() !== "")
                            setReportEditForm({
                              date: d || "",
                              project: r.project || "",
                              notes: r.notes || "",
                              totalProductionSummary: r.total_production_summary || "",
                              dailyPileCount: dailyVal != null ? String(dailyVal) : "",
                              remainingPiles: r.remaining_piles != null && String(r.remaining_piles).trim() !== "" ? String(r.remaining_piles) : "",
                              dailyFuelUsage: r.daily_fuel_usage || "",
                              personnelTotal: r.personnel_total != null ? String(r.personnel_total) : "",
                            })
                          }}
                          title="Düzenle"
                          sx={{ color: "#ed6c02" }}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton size="small" onClick={() => setReportDeleteId(r.id)} title="Sil" sx={{ color: "#d32f2f" }}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        </TabPanel>

        {/* Ayarları kaydet butonu yalnızca E-posta Ayarları sekmesinde görünür */}
        {tabValue === 1 && (
          <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
            <Button variant="contained" size="large" onClick={saveSettings} disabled={loading}>
              {loading ? "Kaydediliyor..." : t("save_settings")}
            </Button>
          </Box>
        )}

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
          <DialogTitle sx={{ color: "var(--icsp-lacivert)", fontWeight: 600 }}>{siteDialogData.id ? "Şantiye düzenle" : "Şantiye ekle"}</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Temel bilgiler</Typography>
            <TextField
              autoFocus
              margin="dense"
              fullWidth
              label="Şantiye adı"
              value={siteDialogData.name}
              onChange={(e) => setSiteDialogData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Örn: SHAQLAWA Şantiyesi"
              variant="outlined"
              size="small"
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
              variant="outlined"
              size="small"
            />
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>Bölgesel saat (operatör biniş/iniş kaydı)</Typography>
            <TextField margin="dense" fullWidth label="Ülke (kodu veya adı)" value={siteDialogData.country} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, country: e.target.value }))} placeholder="Örn: TR, IQ" variant="outlined" size="small" helperText="Zaman dilimi ülkeye göre belirlenir" />
            <TextField margin="dense" fullWidth label="Zaman dilimi (opsiyonel)" value={siteDialogData.timezone} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, timezone: e.target.value }))} placeholder="Örn: Europe/Istanbul" variant="outlined" size="small" />

            <TextField margin="dense" fullWidth label="Yetkili kişi" value={siteDialogData.authorizedPerson} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, authorizedPerson: e.target.value }))} placeholder="Şantiye yetkilisi" variant="outlined" size="small" />
            <TextField margin="dense" fullWidth label="İşveren" value={siteDialogData.employer} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, employer: e.target.value }))} placeholder="İşveren / firma" variant="outlined" size="small" />

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>Makineler ve operatörler</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Liste İdari → Makineler’de tanımlı kazık makinelerinden gelir. En az bir makine seçimi zorunludur.
            </Typography>
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel>Bu şantiyedeki makineler</InputLabel>
              <Select
                multiple
                value={siteDialogData.assignedMachineIds}
                label="Bu şantiyedeki makineler"
                onChange={(e) => {
                  const next = e.target.value as string[]
                  setSiteDialogData((prev) => ({
                    ...prev,
                    assignedMachineIds: next,
                    assignedMachineOperators: prev.assignedMachineOperators.filter((o) => next.includes(o.machineId)),
                  }))
                }}
                renderValue={(sel) =>
                  (sel as string[])
                    .map((id) => idariMachineOptions.find((m) => String(m.id) === id)?.name ?? id)
                    .join(", ") || "Seçin"}
              >
                {idariMachineOptions
                  .filter((m) => m.machine_type === "Kazık Makinesi")
                  .map((m) => (
                    <MenuItem key={m.id} value={String(m.id)}>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {m.name}
                          {m.current_site_id != null && m.current_site_id !== siteDialogData.id ? " (başka şantiyede — seçerseniz bu şantiyeye alınır)" : ""}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[m.machine_type, m.marka, m.model, m.plaka_no ? `Plaka: ${m.plaka_no}` : "", m.seri_no ? `Seri: ${m.seri_no}` : "", m.status ? `Durum: ${m.status}` : ""]
                            .filter(Boolean)
                            .join(" • ")}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            {siteDialogData.assignedMachineIds.length > 0 && (
              <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                {siteDialogData.assignedMachineIds.map((machineId) => {
                  const assignedIds = siteDialogData.assignedMachineOperators
                    .filter((o) => o.machineId === machineId)
                    .map((o) => o.personelId)
                  return (
                  <Box key={machineId} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Box sx={{ minWidth: 240 }}>
                      <Typography variant="body2" fontWeight={600}>{idariMachineOptions.find((m) => String(m.id) === machineId)?.name ?? machineId}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(() => {
                          const m = idariMachineOptions.find((x) => String(x.id) === machineId)
                          if (!m) return "—"
                          return [m.machine_type, m.marka, m.model, m.plaka_no ? `Plaka: ${m.plaka_no}` : "", m.seri_no ? `Seri: ${m.seri_no}` : ""]
                            .filter(Boolean)
                            .join(" • ")
                        })()}
                      </Typography>
                    </Box>
                    <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
                      <InputLabel>Operatörler (birden fazla seçilebilir)</InputLabel>
                      <Select
                        multiple
                        value={assignedIds}
                        label="Operatörler (birden fazla seçilebilir)"
                        onChange={(e) => {
                          const ids = (e.target.value as number[]).filter((n) => n > 0)
                          setSiteDialogData((prev) => ({
                            ...prev,
                            assignedMachineOperators: [
                              ...prev.assignedMachineOperators.filter((o) => o.machineId !== machineId),
                              ...ids.map((personelId) => ({ machineId, personelId })),
                            ],
                          }))
                        }}
                        renderValue={(sel) => (sel as number[]).map((id) => {
                          const p = personelList.find((p) => p.id === id)
                          return p ? `${p.ad} ${p.soyad}` : String(id)
                        }).join(", ") || "— Seçin"}
                      >
                        {personelList.map((p) => (
                          <MenuItem key={p.id} value={p.id}>{p.ad} {p.soyad} ({p.gorev})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  )
                })}
              </Box>
            )}

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 0.5 }}>Proje</Typography>
            <TextField
              margin="dense"
              fullWidth
              type="number"
              label="Projedeki toplam kazık sayısı (Ad.)"
              value={siteDialogData.totalPiles}
              onChange={(e) => setSiteDialogData((prev) => ({ ...prev, totalPiles: e.target.value }))}
              placeholder="Örn: 150"
              inputProps={{ min: 0 }}
            />
            {isSuperAdmin && (
              <TextField
                margin="dense"
                fullWidth
                type="number"
                label="Sözleşme birim fiyatı (metre başı)"
                value={siteDialogData.contractUnitPrice}
                onChange={(e) => setSiteDialogData((prev) => ({ ...prev, contractUnitPrice: e.target.value }))}
                placeholder="Örn: 250"
                inputProps={{ min: 0, step: "0.01" }}
              />
            )}
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }} color="text.secondary">Proje durumu</Typography>
            <TextField
              margin="dense"
              fullWidth
              type="date"
              label="İşin başlama tarihi"
              value={siteDialogData.projectStartDate}
              onChange={(e) => setSiteDialogData((prev) => ({ ...prev, projectStartDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={siteDialogData.isOngoing}
                  onChange={(e) => setSiteDialogData((prev) => ({ ...prev, isOngoing: e.target.checked }))}
                />
              }
              label="Devam Eden (rapor başlamadan önce yapılan kazık sayısı girilecek)"
            />
            {siteDialogData.isOngoing && (
              <TextField
                margin="dense"
                fullWidth
                type="number"
                label="Raporların başladığı gün yapılan toplam kazık sayısı (Ad.)"
                value={siteDialogData.initialPilesDone}
                onChange={(e) => setSiteDialogData((prev) => ({ ...prev, initialPilesDone: e.target.value }))}
                placeholder="Rapor öncesi kümülatif yapılan"
                inputProps={{ min: 0 }}
                helperText="Kalan kazık = Proje toplamı − bu değer − günlük yapılanlar"
              />
            )}
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
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setSiteDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              type="button"
              variant="contained"
              sx={{ background: "var(--icsp-lacivert)" }}
              onClick={async () => {
                if (!siteDialogData.name.trim() || !siteDialogData.code.trim()) {
                  alert("Şantiye adı ve kod zorunludur.")
                  return
                }
                const kazikIds = siteDialogData.assignedMachineIds.filter((id) =>
                  idariMachineOptions.some((m) => String(m.id) === id && m.machine_type === "Kazık Makinesi"),
                )
                if (kazikIds.length === 0) {
                  alert("En az bir kazık makinesi seçmelisiniz (İdari → Makineler’de tanımlı olmalı).")
                  return
                }
                const payload = {
                  name: siteDialogData.name.trim(),
                  code: siteDialogData.code.trim(),
                  country: siteDialogData.country.trim() || null,
                  timezone: siteDialogData.timezone.trim() || null,
                  emailList: Array.isArray(siteDialogData.emailList) ? siteDialogData.emailList : [],
                  totalPiles: siteDialogData.totalPiles.trim() ? parseInt(siteDialogData.totalPiles, 10) || null : null,
                  authorizedPerson: siteDialogData.authorizedPerson.trim() || null,
                  employer: siteDialogData.employer.trim() || null,
                  projectStartDate: siteDialogData.projectStartDate.trim() || null,
                  isOngoing: siteDialogData.isOngoing,
                  initialPilesDone: siteDialogData.isOngoing && siteDialogData.initialPilesDone.trim() ? parseInt(siteDialogData.initialPilesDone, 10) || null : null,
                  ...(isSuperAdmin ? { contractUnitPrice: siteDialogData.contractUnitPrice.trim() ? Number(siteDialogData.contractUnitPrice) : null } : {}),
                  assignedMachineIds: kazikIds,
                  assignedOperatorIds: siteDialogData.assignedOperatorIds || [],
                  assignedMachineOperators: (siteDialogData.assignedMachineOperators || []).filter((o) => o.personelId > 0 && kazikIds.includes(o.machineId)),
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
                      const msg = data.error || data.message || (res.status === 500 ? "Veritabanı hatası." : `Ekleme başarısız (${res.status})`)
                      alert(msg)
                    }
                  }
                } catch (e) {
                  console.error("Şantiye kaydetme hatası:", e)
                  alert("İstek gönderilemedi.")
                }
              }}
            >
              {t("save")}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={reportEditDialog.open} onClose={() => setReportEditDialog({ open: false, report: null })} maxWidth="sm" fullWidth>
          <DialogTitle>Rapor düzenle</DialogTitle>
          <DialogContent>
            {reportEditDialog.report && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 1 }}>
                <TextField size="small" label="Tarih" type="date" value={reportEditForm.date} onChange={(e) => setReportEditForm((p) => ({ ...p, date: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                <TextField size="small" label="Proje" value={reportEditForm.project} onChange={(e) => setReportEditForm((p) => ({ ...p, project: e.target.value }))} fullWidth />
                <TextField size="small" label="Kazık İmalatı (m)" value={reportEditForm.totalProductionSummary} onChange={(e) => setReportEditForm((p) => ({ ...p, totalProductionSummary: e.target.value }))} fullWidth />
                <TextField size="small" label="Kazık Sayısı (Ad.)" value={reportEditForm.dailyPileCount} onChange={(e) => setReportEditForm((p) => ({ ...p, dailyPileCount: e.target.value }))} fullWidth />
                <TextField size="small" label="Kalan kazık (Ad.)" value={reportEditForm.remainingPiles} onChange={(e) => setReportEditForm((p) => ({ ...p, remainingPiles: e.target.value }))} fullWidth />
                <TextField size="small" label="Mazot (lt) / not" value={reportEditForm.dailyFuelUsage} onChange={(e) => setReportEditForm((p) => ({ ...p, dailyFuelUsage: e.target.value }))} fullWidth />
                <TextField size="small" label="Personel toplam" value={reportEditForm.personnelTotal} onChange={(e) => setReportEditForm((p) => ({ ...p, personnelTotal: e.target.value }))} fullWidth />
                <TextField size="small" label="Notlar" multiline rows={3} value={reportEditForm.notes} onChange={(e) => setReportEditForm((p) => ({ ...p, notes: e.target.value }))} fullWidth />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReportEditDialog({ open: false, report: null })}>İptal</Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (!reportEditDialog.report?.id) return
                try {
                  const res = await fetch(`/api/reports/${reportEditDialog.report.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      date: reportEditForm.date || undefined,
                      project: reportEditForm.project || undefined,
                      totalProductionSummary: reportEditForm.totalProductionSummary || undefined,
                      dailyPileCount: reportEditForm.dailyPileCount || undefined,
                      remainingPiles: reportEditForm.remainingPiles || undefined,
                      dailyFuelUsage: reportEditForm.dailyFuelUsage || undefined,
                      personnelTotal: reportEditForm.personnelTotal !== "" ? parseInt(reportEditForm.personnelTotal, 10) : undefined,
                      notes: reportEditForm.notes !== undefined ? reportEditForm.notes : undefined,
                    }),
                  })
                  if (res.ok) {
                    setReportEditDialog({ open: false, report: null })
                    loadReportList()
                  } else {
                    const data = await res.json().catch(() => ({}))
                    alert(data.error || "Güncelleme başarısız.")
                  }
                } catch (e) {
                  console.error(e)
                  alert("İstek gönderilemedi.")
                }
              }}
            >
              Kaydet
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={reportDeleteId != null} onClose={() => setReportDeleteId(null)}>
          <DialogTitle>Raporu sil</DialogTitle>
          <DialogContent>Bu raporu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.</DialogContent>
          <DialogActions>
            <Button onClick={() => setReportDeleteId(null)}>İptal</Button>
            <Button
              color="error"
              variant="contained"
              onClick={async () => {
                if (reportDeleteId == null) return
                try {
                  const res = await fetch(`/api/reports/${reportDeleteId}`, { method: "DELETE" })
                  if (res.ok) {
                    setReportDeleteId(null)
                    loadReportList()
                  } else {
                    const data = await res.json().catch(() => ({}))
                    alert(data.error || "Silme başarısız.")
                  }
                } catch (e) {
                  console.error(e)
                  alert("İstek gönderilemedi.")
                }
              }}
            >
              Sil
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={dbUserDialogOpen} onClose={() => setDbUserDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ color: "var(--icsp-lacivert)", fontWeight: 600 }}>
            {dbUserEditingId != null ? "Kullanıcıyı düzenle" : "Yeni kullanıcı"}
          </DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Kullanıcı bilgileri</Typography>
            <TextField
              autoFocus={dbUserEditingId == null}
              margin="dense"
              fullWidth
              label="Kullanıcı adı (giriş)"
              value={dbUserForm.username}
              onChange={(e) => setDbUserForm((p) => ({ ...p, username: e.target.value }))}
              variant="outlined"
              size="small"
              disabled={dbUserEditingId != null}
            />
            <TextField
              margin="dense"
              fullWidth
              type="password"
              label={dbUserEditingId != null ? "Yeni şifre (değiştirmek için doldurun)" : "Şifre"}
              value={dbUserForm.password}
              onChange={(e) => setDbUserForm((p) => ({ ...p, password: e.target.value }))}
              variant="outlined"
              size="small"
              placeholder="En az 6 karakter"
            />
            <TextField
              margin="dense"
              fullWidth
              label="E-posta"
              value={dbUserForm.email}
              onChange={(e) => setDbUserForm((p) => ({ ...p, email: e.target.value }))}
              variant="outlined"
              size="small"
            />
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel>Sorumlu şantiye</InputLabel>
              <Select
                value={dbUserForm.siteId === "" ? "" : dbUserForm.siteId}
                label="Sorumlu şantiye"
                onChange={(e) => {
                  const val = e.target.value
                  if (val === "genel") {
                    // "Genel" → site_id=null + view_all_sites permission
                    setDbUserForm((p) => ({
                      ...p,
                      siteId: "genel",
                      modulePerms: { ...p.modulePerms, view_all_sites: "write" },
                    }))
                  } else {
                    setDbUserForm((p) => ({
                      ...p,
                      siteId: val === "" ? "" : Number(val),
                      modulePerms: { ...p.modulePerms, view_all_sites: "off" },
                    }))
                  }
                }}
              >
                <MenuItem value="">— Yok</MenuItem>
                <MenuItem value="genel">— Genel (tüm şantiyeleri görebilir) —</MenuItem>
                {dbSites.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel>Kullanıcı tipi (oturum rolü)</InputLabel>
              <Select value={dbUserForm.role} label="Kullanıcı tipi (oturum rolü)" onChange={(e) => setDbUserForm((p) => ({ ...p, role: e.target.value }))}>
                {(isSuperAdmin || dbUserForm.role === "super_admin") && <MenuItem value="super_admin">Super Admin</MenuItem>}
                <MenuItem value="admin">Yönetici</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="user">İdari / Kullanıcı</MenuItem>
                <MenuItem value="personel">Personel</MenuItem>
                <MenuItem value="operator">Operatör</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 0.5 }}>Personel eşlemesi</Typography>
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel>Kaynak</InputLabel>
              <Select
                value={dbUserForm.personelMode}
                label="Kaynak"
                onChange={(e) => setDbUserForm((p) => ({
                  ...p,
                  personelMode: e.target.value as "none" | "list" | "new",
                  personelId: "",
                }))}
              >
                <MenuItem value="none">Personel listesine bağlama</MenuItem>
                <MenuItem value="list">Mevcut personelden seç</MenuItem>
                <MenuItem value="new">Yeni personel oluştur ve bağla</MenuItem>
              </Select>
            </FormControl>
            {dbUserForm.personelMode === "list" && (
              <FormControl fullWidth margin="dense" size="small" variant="outlined">
                <InputLabel>Personel</InputLabel>
                <Select
                  value={dbUserForm.personelId === "" ? "" : dbUserForm.personelId}
                  label="Personel"
                  onChange={(e) => setDbUserForm((p) => ({ ...p, personelId: e.target.value === "" ? "" : Number(e.target.value) }))}
                >
                  <MenuItem value="">— Seçin</MenuItem>
                  {personelList.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.ad} {p.soyad} ({p.gorev})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {dbUserForm.personelMode === "new" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
                <TextField size="small" label="Ad" value={dbUserForm.newPersonelAd} onChange={(e) => setDbUserForm((p) => ({ ...p, newPersonelAd: e.target.value }))} />
                <TextField size="small" label="Soyad" value={dbUserForm.newPersonelSoyad} onChange={(e) => setDbUserForm((p) => ({ ...p, newPersonelSoyad: e.target.value }))} />
                <TextField size="small" label="Görev" value={dbUserForm.newPersonelGorev} onChange={(e) => setDbUserForm((p) => ({ ...p, newPersonelGorev: e.target.value }))} />
                <Typography variant="caption" color="text.secondary">Kayıt sonrası İdari → Personel’den şantiye ataması yapılabilir.</Typography>
              </Box>
            )}

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>Modül yetkileri (bilgi amaçlı — uygulama rolüyle birlikte kullanın)</Typography>
            {USER_MODULE_DEFS.map((mod) => (
              <Box key={mod.key} sx={{ mb: 1.5, pl: 1, borderLeft: "3px solid #e0e0e0" }}>
                <FormLabel component="legend" sx={{ fontSize: "0.875rem", fontWeight: 600 }}>{mod.label}</FormLabel>
                <RadioGroup
                  row
                  value={dbUserForm.modulePerms[mod.key] ?? "off"}
                  onChange={(_, v) => setDbUserForm((p) => ({
                    ...p,
                    modulePerms: { ...p.modulePerms, [mod.key]: v as ModPermLevel },
                  }))}
                >
                  <FormControlLabel value="off" control={<Radio size="small" />} label="Kapalı" />
                  <FormControlLabel value="view" control={<Radio size="small" />} label="Görüntüleme" />
                  <FormControlLabel value="write" control={<Radio size="small" />} label="Yazma" />
                </RadioGroup>
              </Box>
            ))}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDbUserDialogOpen(false)}>İptal</Button>
            <Button
              variant="contained"
              sx={{ background: "var(--icsp-lacivert)" }}
              onClick={async () => {
                if (!dbUserForm.username.trim()) {
                  alert("Kullanıcı adı gerekli.")
                  return
                }
                if (dbUserEditingId == null && !dbUserForm.password.trim()) {
                  alert("Şifre gerekli.")
                  return
                }
                let personelIdToLink: number | null = null
                if (dbUserForm.personelMode === "list" && dbUserForm.personelId !== "") {
                  personelIdToLink = Number(dbUserForm.personelId)
                }
                if (dbUserForm.personelMode === "new") {
                  if (!dbUserForm.newPersonelAd.trim() || !dbUserForm.newPersonelSoyad.trim()) {
                    alert("Yeni personel için ad ve soyad gerekli.")
                    return
                  }
                  try {
                    const pr = await fetch("/api/idari/personel", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ad: dbUserForm.newPersonelAd.trim(),
                        soyad: dbUserForm.newPersonelSoyad.trim(),
                        gorev: dbUserForm.newPersonelGorev.trim() || "İşçi",
                        site_id: (dbUserForm.siteId === "" || dbUserForm.siteId === "genel") ? undefined : Number(dbUserForm.siteId),
                      }),
                    })
                    const pd = await pr.json().catch(() => ({}))
                    if (!pr.ok) {
                      alert(pd.error || "Personel oluşturulamadı.")
                      return
                    }
                    personelIdToLink = Number(pd.id)
                  } catch {
                    alert("Personel isteği başarısız.")
                    return
                  }
                }
                try {
                  if (dbUserEditingId != null) {
                    const body: Record<string, unknown> = {
                      role: dbUserForm.role,
                      siteId: (dbUserForm.siteId === "" || dbUserForm.siteId === "genel") ? null : dbUserForm.siteId,
                      modulePermissions: dbUserForm.modulePerms,
                      email: dbUserForm.email.trim() || null,
                    }
                    if (dbUserForm.password.trim().length >= 6) body.password = dbUserForm.password
                    if (dbUserForm.personelMode === "new" && personelIdToLink != null) {
                      body.personelId = personelIdToLink
                    } else if (dbUserForm.personelMode === "list" && dbUserForm.personelId !== "") {
                      body.personelId = Number(dbUserForm.personelId)
                    }
                    const res = await fetch(`/api/users/${dbUserEditingId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      setDbUserDialogOpen(false)
                      await loadUsersAndProjects()
                    } else {
                      alert(data.error || "Güncellenemedi.")
                    }
                  } else {
                    const res = await fetch("/api/users", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        username: dbUserForm.username.trim(),
                        password: dbUserForm.password,
                        role: dbUserForm.role,
                        siteId: (dbUserForm.siteId === "" || dbUserForm.siteId === "genel") ? null : dbUserForm.siteId,
                        email: dbUserForm.email.trim() || null,
                        modulePermissions: dbUserForm.modulePerms,
                        personelId: personelIdToLink,
                      }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      setDbUserDialogOpen(false)
                      await loadUsersAndProjects()
                    } else {
                      alert(data.error || "Kullanıcı eklenemedi.")
                    }
                  }
                } catch {
                  alert("İstek gönderilemedi.")
                }
              }}
            >
              {dbUserEditingId != null ? "Kaydet" : "Ekle"}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
      </Container>

      {/* Bildirim drawer */}
      <Drawer anchor="right" open={notifDrawerOpen} onClose={() => setNotifDrawerOpen(false)} PaperProps={{ sx: { width: { xs: "100%", sm: 380 }, p: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: "#1a237e" }}>Bildirimler</Typography>
          <IconButton onClick={() => setNotifDrawerOpen(false)}><Close /></IconButton>
        </Box>
        {notifications.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, color: "#9e9e9e" }}>
            <Notifications sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">Henüz bildirim yok.</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((n) => (
              <ListItem key={n.id} divider alignItems="flex-start" sx={{ py: 1.5, px: 0 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{n.title}</Typography>
                      {n.anomalyCount && n.anomalyCount > 0 && (
                        <Chip label={`${n.anomalyCount} uyarı`} size="small" sx={{ background: "#fef3c7", color: "#92400e", fontSize: "0.65rem" }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="caption" display="block" sx={{ color: "#64748b" }}>{n.message}</Typography>
                      <Typography variant="caption" sx={{ color: "#94a3b8" }}>{new Date(n.timestamp).toLocaleTimeString("tr-TR")}</Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
        {notifications.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Button size="small" onClick={() => setNotifications([])} sx={{ color: "#9e9e9e" }}>
              Tümünü temizle
            </Button>
          </Box>
        )}
      </Drawer>

      {/* Yeni bildirim toast */}
      <Snackbar
        open={newNotifSnack.open}
        autoHideDuration={5000}
        onClose={() => setNewNotifSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={newNotifSnack.severity}
          onClose={() => setNewNotifSnack((s) => ({ ...s, open: false }))}
          sx={{ width: "100%", cursor: "pointer" }}
          onClick={() => { setNotifDrawerOpen(true); setNewNotifSnack((s) => ({ ...s, open: false })) }}
        >
          {newNotifSnack.message}
        </Alert>
      </Snackbar>
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
