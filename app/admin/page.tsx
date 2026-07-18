"use client"

import type React from "react"

import Link from "next/link"
import { useState, useEffect, useRef, useMemo } from "react"
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
  AppBar,
  Toolbar,
  Divider,
  CircularProgress,
} from "@mui/material"
import { Delete, Add, Edit, Assessment, Place, TrendingUp, Refresh, Visibility, Notifications, NotificationsActive, Close, Engineering, ArrowBack, Construction, Email } from "@mui/icons-material"
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

/** Şantiye operatör seçiminde: görevi operatör olan personel. */
function personelIsOperatör(p: { gorev: string }) {
  const g = (p.gorev || "").toLowerCase()
  return g.includes("operat")
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
    engineer: "Mühendis",
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

type SseNotification = {
  id: string
  type: string
  title: string
  message: string
  siteName?: string
  siteCode?: string | null
  reportId?: number
  date?: string
  anomalyCount?: number
  machineName?: string
  timestamp: number
}

type DashboardPeriod =
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom"

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getDashboardRangeForPeriod(period: Exclude<DashboardPeriod, "custom">, now = new Date()): { start: string; end: string } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  if (period === "7d") {
    start.setDate(start.getDate() - 6)
  } else if (period === "30d") {
    start.setDate(start.getDate() - 29)
  } else if (period === "90d") {
    start.setDate(start.getDate() - 89)
  } else if (period === "this_month") {
    start.setDate(1)
  } else if (period === "last_month") {
    start.setMonth(start.getMonth() - 1, 1)
    end.setDate(0) // last day of previous month
  } else if (period === "this_year") {
    start.setMonth(0, 1)
  }
  return { start: formatLocalYmd(start), end: formatLocalYmd(end) }
}

const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  "7d": "Son 7 gün",
  "30d": "Son 30 gün",
  "90d": "Son 90 gün",
  this_month: "Bu ay",
  last_month: "Geçen ay",
  this_year: "Bu yıl",
  custom: "Özel aralık",
}

function AdminPanel() {
  const { user } = useAuth()
  const currentRole = String(user?.role ?? "")
  const isSuperAdmin = currentRole === "super_admin"
  const isAdminOrSuper = currentRole === "super_admin" || currentRole === "admin"
  const isSuperAdminRef = useRef(isSuperAdmin)
  useEffect(() => {
    isSuperAdminRef.current = isSuperAdmin
  }, [isSuperAdmin])
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
  const [notifications, setNotifications] = useState<SseNotification[]>([])
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false)
  const [newNotifSnack, setNewNotifSnack] = useState<{ open: boolean; message: string; severity: "info" | "warning" }>({ open: false, message: "", severity: "info" })
  /** Super admin: yeni rapor geldiğinde modal popup */
  const [notifPopup, setNotifPopup] = useState<SseNotification | null>(null)
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
    secondarySiteId: "" as string | number,
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
  const operatörPersonelList = useMemo(() => personelList.filter(personelIsOperatör), [personelList])
  const [siteDialogOpen, setSiteDialogOpen] = useState(false)
  const [idariMachineOptions, setIdariMachineOptions] = useState<{ id: number; name: string; machine_type: string; marka?: string | null; model?: string | null; plaka_no?: string | null; seri_no?: string | null; status?: string | null; current_site_id: number | null }[]>([])
  const [siteDialogData, setSiteDialogData] = useState<{
    id?: number
    name: string
    code: string
    country: string
    timezone: string
    emailList: string[]
    totalPiles: string
    iqdPerUsd: string
    contractUnitPrice: string
    authorizedPerson: string
    employer: string
    projectStartDate: string
    isOngoing: boolean
    initialPilesDone: string
    initialEmptyBorehole: string
    assignedMachineIds: string[]
    assignedOperatorIds: number[]
    assignedMachineOperators: { machineId: string; personelId: number }[]
    isActive: boolean
    releaseMachinesWhenClosed: boolean
  }>({
    name: "",
    code: "",
    country: "",
    timezone: "",
    emailList: [],
    totalPiles: "",
    iqdPerUsd: "1320",
    contractUnitPrice: "",
    authorizedPerson: "",
    employer: "",
    projectStartDate: "",
    isOngoing: false,
    initialPilesDone: "",
    initialEmptyBorehole: "",
    assignedMachineIds: [],
    assignedOperatorIds: [],
    assignedMachineOperators: [],
    isActive: true,
    releaseMachinesWhenClosed: true,
  })
  const [siteRemainingRecalcLoading, setSiteRemainingRecalcLoading] = useState(false)
  const [makinelerRefreshToken, setMakinelerRefreshToken] = useState(0)
  const [quickMachineName, setQuickMachineName] = useState("")
  const [quickMachineSaving, setQuickMachineSaving] = useState(false)

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
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("90d")
  const [dashboardStartDate, setDashboardStartDate] = useState(() => getDashboardRangeForPeriod("90d").start)
  const [dashboardEndDate, setDashboardEndDate] = useState(() => getDashboardRangeForPeriod("90d").end)
  const [siteDashboardSummary, setSiteDashboardSummary] = useState<{
    sites: {
      siteId: number
      siteName: string
      siteCode: string
      todayPiles: number
      todayProduction: number
      totalProduction: number
      remainingToday: number | null
      remainingLatest: number | null
    }[]
    machines: { id: number; name: string; machineType: string | null; siteId: number; siteName: string; siteCode: string }[]
  } | null>(null)

  // Raporlar sekmesi
  const [reportList, setReportList] = useState<any[]>([])
  const [reportListLoading, setReportListLoading] = useState(false)
  const [reportFilterStart, setReportFilterStart] = useState("")
  const [reportFilterEnd, setReportFilterEnd] = useState("")
  const [reportFilterSiteId, setReportFilterSiteId] = useState<string>("")
  const [reportEditDialog, setReportEditDialog] = useState<{ open: boolean; report: any }>({ open: false, report: null })
  const [reportEditForm, setReportEditForm] = useState<{ date: string; project: string; notes: string; totalProductionSummary: string; dailyPileCount: string; remainingPiles: string; dailyFuelUsage: string; personnelTotal: string }>({ date: "", project: "", notes: "", totalProductionSummary: "", dailyPileCount: "", remainingPiles: "", dailyFuelUsage: "", personnelTotal: "" })
  const [reportEditRawJson, setReportEditRawJson] = useState("")
  /** Super admin: varsayılan form alanlarıyla kayıt; işaretlenirse JSON’daki tüm work_reports kolonları uygulanır */
  const [reportSaveFromFullJson, setReportSaveFromFullJson] = useState(false)
  const [reportDeleteId, setReportDeleteId] = useState<number | null>(null)
  const [reportResendingId, setReportResendingId] = useState<number | null>(null)
  const [emailSnack, setEmailSnack] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" })
  const [webpMigrateLoading, setWebpMigrateLoading] = useState(false)

  // Super admin — operatör girişleri sekmesi
  const [operatorEntriesList, setOperatorEntriesList] = useState<Record<string, unknown>[]>([])
  const [operatorEntriesLoading, setOperatorEntriesLoading] = useState(false)
  const [opFilterStart, setOpFilterStart] = useState("")
  const [opFilterEnd, setOpFilterEnd] = useState("")
  const [opFilterSiteId, setOpFilterSiteId] = useState("")
  const [opDetailOpen, setOpDetailOpen] = useState(false)
  const [opDetailRow, setOpDetailRow] = useState<Record<string, unknown> | null>(null)
  /** Super admin: operatör girişi CRUD */
  const [opCrudOpen, setOpCrudOpen] = useState(false)
  const [opCrudMode, setOpCrudMode] = useState<"create" | "edit">("create")
  const [opCrudId, setOpCrudId] = useState<number | null>(null)
  const [opCrudSaving, setOpCrudSaving] = useState(false)
  const [opCrudMachines, setOpCrudMachines] = useState<{ id: number; name: string }[]>([])
  const [opCrudForm, setOpCrudForm] = useState({
    siteId: "",
    reportDate: "",
    userId: "",
    machineId: "",
    machineName: "",
    dbMachineId: "" as string | number,
    machineHours: "",
    startTime: "",
    endTime: "",
    motorSaatBinis: "",
    motorSaatInis: "",
    pileDepthsJson: "[]",
    usedFuel: "",
    workDone: "",
    note: "",
    dailyPileCount: "",
    totalProduction: "",
    emptyBorehole: "",
    preBorehole: "",
    concretePoured: "",
    elmasMiktar: "",
    elmasDegisimYok: false,
    bentonitMiktar: "",
    kullanilanMalzeme: "",
    malzemeIhtiyaci: false,
    servisIhtiyaci: false,
    image1: "",
    image2: "",
    notes: "",
  })
  const [opDeleteConfirmId, setOpDeleteConfirmId] = useState<number | null>(null)

  const operatorUsersForCrud = useMemo(
    () => (Array.isArray(dbUsers) ? dbUsers.filter((u: { role?: string }) => String(u?.role ?? "").toLowerCase() === "operator") : []),
    [dbUsers],
  )

  /** Rapor önizleme: aynı sayfada tam ekran iframe */
  const [reportPreviewId, setReportPreviewId] = useState<number | null>(null)

  const { t } = useLanguage()

  const openReportPreview = (id: number) => {
    setReportPreviewId(id)
    setNotifPopup(null)
    setNotifDrawerOpen(false)
  }

  useEffect(() => {
    loadSettings()
    loadUsersAndProjects()
    loadSites()
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [dashboardSiteId, dashboardStartDate, dashboardEndDate])

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
    fetch("/api/idari/makineler", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: number; name: string; machine_type: string; marka?: string | null; model?: string | null; plaka_no?: string | null; seri_no?: string | null; status?: string | null; current_site_id: number | null }[]) => {
        setIdariMachineOptions(Array.isArray(list) ? list : [])
      })
      .catch(() => setIdariMachineOptions([]))
  }, [siteDialogOpen, makinelerRefreshToken])

  useEffect(() => {
    if (!siteDialogOpen) return
    fetch("/api/idari/personel?limit=500")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res: { data?: { id: number; ad: string; soyad: string; gorev: string }[] } | { id: number; ad: string; soyad: string; gorev: string }[]) => {
        setPersonelList(Array.isArray(res) ? res : (res.data ?? []))
      })
      .catch(() => {})
  }, [siteDialogOpen])
  useEffect(() => {
    if (tabValue === 4) loadReportList()
  }, [tabValue])

  useEffect(() => {
    if (!isSuperAdmin && tabValue === 5) setTabValue(0)
  }, [isSuperAdmin, tabValue])

  const loadOperatorEntries = async () => {
    setOperatorEntriesLoading(true)
    try {
      const params = new URLSearchParams({ limit: "200" })
      if (opFilterStart) params.set("startDate", opFilterStart)
      if (opFilterEnd) params.set("endDate", opFilterEnd)
      if (opFilterSiteId) params.set("siteId", opFilterSiteId)
      const res = await fetch(`/api/admin/operator-entries?${params}`)
      const data = await res.json().catch(() => ({}))
      setOperatorEntriesList(Array.isArray(data.entries) ? data.entries : [])
    } catch {
      setOperatorEntriesList([])
    } finally {
      setOperatorEntriesLoading(false)
    }
  }

  useEffect(() => {
    if (!opCrudOpen) return
    const sid = parseInt(String(opCrudForm.siteId), 10)
    if (!Number.isInteger(sid) || sid < 1) {
      setOpCrudMachines([])
      return
    }
    let cancelled = false
    fetch(`/api/idari/makineler?siteId=${sid}&status=aktif`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { id: number; name: string }[]) => {
        if (!cancelled) setOpCrudMachines(Array.isArray(list) ? list.map((m) => ({ id: m.id, name: m.name })) : [])
      })
      .catch(() => {
        if (!cancelled) setOpCrudMachines([])
      })
    return () => {
      cancelled = true
    }
  }, [opCrudOpen, opCrudForm.siteId])

  const openOpCrudCreate = () => {
    setOpCrudMode("create")
    setOpCrudId(null)
    setOpCrudForm({
      siteId: opFilterSiteId || (dbSites[0]?.id != null ? String(dbSites[0].id) : ""),
      reportDate: new Date().toISOString().slice(0, 10),
      userId: "",
      machineId: "",
      machineName: "",
      dbMachineId: "",
      machineHours: "",
      startTime: "",
      endTime: "",
      motorSaatBinis: "",
      motorSaatInis: "",
      pileDepthsJson: "[]",
      usedFuel: "",
      workDone: "",
      note: "",
      dailyPileCount: "",
      totalProduction: "",
      emptyBorehole: "",
      preBorehole: "",
      concretePoured: "",
      elmasMiktar: "",
      elmasDegisimYok: false,
      bentonitMiktar: "",
      kullanilanMalzeme: "",
      malzemeIhtiyaci: false,
      servisIhtiyaci: false,
      image1: "",
      image2: "",
      notes: "",
    })
    setOpCrudOpen(true)
  }

  const openOpCrudEdit = async (row: Record<string, unknown>) => {
    const id = Number(row.id)
    if (!Number.isInteger(id)) return
    setOpCrudSaving(true)
    try {
      const res = await fetch(`/api/admin/operator-entries/${id}`, { credentials: "same-origin" })
      const data = await res.json().catch(() => ({}))
      const e = (data as { entry?: Record<string, unknown> }).entry
      if (!res.ok || !e) {
        alert((data as { error?: string }).error || "Kayıt yüklenemedi.")
        return
      }
      const pd = e.pile_depths
      let pileJson = "[]"
      try {
        pileJson = pd != null ? JSON.stringify(pd, null, 2) : "[]"
      } catch {
        pileJson = "[]"
      }
      const rd =
        e.report_date instanceof Date ? e.report_date.toISOString().slice(0, 10) : String(e.report_date ?? "").slice(0, 10)
      setOpCrudMode("edit")
      setOpCrudId(id)
      setOpCrudForm({
        siteId: e.site_id != null ? String(e.site_id) : "",
        reportDate: rd,
        userId: e.user_id != null ? String(e.user_id) : "",
        machineId: String(e.machine_id ?? ""),
        machineName: String(e.machine_name ?? ""),
        dbMachineId: e.db_machine_id != null ? Number(e.db_machine_id) : "",
        machineHours: String(e.machine_hours ?? ""),
        startTime: String(e.start_time ?? ""),
        endTime: String(e.end_time ?? ""),
        motorSaatBinis: String(e.motor_saat_binis ?? ""),
        motorSaatInis: String(e.motor_saat_inis ?? ""),
        pileDepthsJson: pileJson,
        usedFuel: String(e.used_fuel ?? ""),
        workDone: String(e.work_done ?? ""),
        note: String(e.note ?? ""),
        dailyPileCount: String(e.daily_pile_count ?? ""),
        totalProduction: String(e.total_production ?? ""),
        emptyBorehole: String(e.empty_borehole ?? ""),
        preBorehole: String(e.pre_borehole ?? ""),
        concretePoured: String(e.concrete_poured ?? ""),
        elmasMiktar: String(e.elmas_miktar ?? ""),
        elmasDegisimYok: e.elmas_degisim_yok === true,
        bentonitMiktar: String(e.bentonit_miktar ?? ""),
        kullanilanMalzeme: String(e.kullanilan_malzeme ?? ""),
        malzemeIhtiyaci: e.malzeme_ihtiyaci === true,
        servisIhtiyaci: e.servis_ihtiyaci === true,
        image1: typeof e.image1 === "string" ? e.image1 : "",
        image2: typeof e.image2 === "string" ? e.image2 : "",
        notes: String(e.notes ?? ""),
      })
      setOpCrudOpen(true)
    } finally {
      setOpCrudSaving(false)
    }
  }

  const submitOpCrud = async () => {
    const siteId = parseInt(String(opCrudForm.siteId), 10)
    const userId = parseInt(String(opCrudForm.userId), 10)
    if (!Number.isInteger(siteId) || siteId < 1) {
      alert("Şantiye seçin.")
      return
    }
    if (!Number.isInteger(userId) || userId < 1) {
      alert("Operatör seçin.")
      return
    }
    let pileDepths: unknown = []
    try {
      pileDepths = JSON.parse(opCrudForm.pileDepthsJson || "[]")
    } catch {
      alert("Kazık derinlikleri geçerli JSON olmalı.")
      return
    }
    const mid = opCrudForm.machineId.trim()
    const dbMid = opCrudForm.dbMachineId === "" ? null : Number(opCrudForm.dbMachineId)
    const machineId = mid || (dbMid != null && !Number.isNaN(dbMid) ? `DB_${dbMid}` : "")
    const machineName = opCrudForm.machineName.trim()
    if (!machineName) {
      alert("Makine adı gerekli.")
      return
    }
    if (!machineId) {
      alert("Makine seçin veya makine kimliği girin.")
      return
    }
    const payload = {
      siteId,
      userId,
      reportDate: opCrudForm.reportDate.slice(0, 10),
      machineId,
      machineName,
      dbMachineId: dbMid != null && !Number.isNaN(dbMid) ? dbMid : null,
      machineHours: opCrudForm.machineHours,
      startTime: opCrudForm.startTime,
      endTime: opCrudForm.endTime,
      motorSaatBinis: opCrudForm.motorSaatBinis,
      motorSaatInis: opCrudForm.motorSaatInis,
      pileDepths,
      usedFuel: opCrudForm.usedFuel,
      workDone: opCrudForm.workDone,
      note: opCrudForm.note,
      dailyPileCount: opCrudForm.dailyPileCount,
      totalProduction: opCrudForm.totalProduction,
      emptyBorehole: opCrudForm.emptyBorehole,
      preBorehole: opCrudForm.preBorehole,
      concretePoured: opCrudForm.concretePoured,
      elmasMiktar: opCrudForm.elmasMiktar || null,
      elmasDegisimYok: opCrudForm.elmasDegisimYok,
      bentonitMiktar: opCrudForm.bentonitMiktar || null,
      kullanilanMalzeme: opCrudForm.kullanilanMalzeme,
      malzemeIhtiyaci: opCrudForm.malzemeIhtiyaci,
      servisIhtiyaci: opCrudForm.servisIhtiyaci,
      image1: opCrudForm.image1 || null,
      image2: opCrudForm.image2 || null,
      notes: opCrudForm.notes,
    }
    setOpCrudSaving(true)
    try {
      const url = opCrudMode === "create" ? "/api/admin/operator-entries" : `/api/admin/operator-entries/${opCrudId}`
      const method = opCrudMode === "create" ? "POST" : "PATCH"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((data as { error?: string }).error || "Kayıt başarısız.")
        return
      }
      setOpCrudOpen(false)
      void loadOperatorEntries()
    } finally {
      setOpCrudSaving(false)
    }
  }

  const deleteOpEntry = async (id: number) => {
    setOpDeleteConfirmId(null)
    try {
      const res = await fetch(`/api/admin/operator-entries/${id}`, { method: "DELETE", credentials: "same-origin" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((data as { error?: string }).error || "Silinemedi.")
        return
      }
      void loadOperatorEntries()
    } catch {
      alert("Silme isteği başarısız.")
    }
  }

  useEffect(() => {
    if (tabValue === 5 && isSuperAdmin) loadOperatorEntries()
  }, [tabValue, isSuperAdmin])

  // SSE bağlantısı
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream")
    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data) as SseNotification & { type: string; _replay?: boolean }
        if (raw.type === "connected") return
        const isReplay = raw._replay === true
        const n: SseNotification = {
          id: raw.id,
          type: raw.type,
          title: raw.title,
          message: raw.message,
          siteName: raw.siteName,
          siteCode: raw.siteCode,
          reportId: raw.reportId,
          date: raw.date,
          anomalyCount: raw.anomalyCount,
          machineName: raw.machineName,
          timestamp: raw.timestamp,
        }
        setNotifications((prev) => {
          if (prev.some((x) => x.id === n.id)) return prev
          return [n, ...prev].slice(0, 50)
        })
        if (isReplay) return
        const severity = (n.anomalyCount ?? 0) > 0 ? "warning" : "info"
        if (isSuperAdminRef.current && (n.type === "new_report" || n.type === "anomaly" || n.type === "operator_entry")) {
          setNotifPopup(n)
        } else {
          setNewNotifSnack({ open: true, message: `${n.title}: ${n.message}`, severity })
        }
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

  const handleResendReportEmail = async (reportId: number) => {
    if (reportResendingId != null) return
    setReportResendingId(reportId)
    try {
      const res = await fetch("/api/send-report/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reportId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setEmailSnack({
          open: true,
          severity: "success",
          message: `Rapor e-postası gönderildi${Array.isArray(data.recipients) && data.recipients.length ? `: ${data.recipients.join(", ")}` : "."}`,
        })
      } else {
        setEmailSnack({
          open: true,
          severity: "error",
          message: data.error || data.emailError || data.detail || "E-posta gönderilemedi.",
        })
      }
    } catch (e) {
      setEmailSnack({ open: true, severity: "error", message: "Bağlantı hatası: e-posta gönderilemedi." })
    } finally {
      setReportResendingId(null)
    }
  }

  const applyDashboardPeriod = (period: DashboardPeriod) => {
    setDashboardPeriod(period)
    if (period === "custom") return
    const range = getDashboardRangeForPeriod(period)
    setDashboardStartDate(range.start)
    setDashboardEndDate(range.end)
  }

  const loadDashboard = async () => {
    setDashboardLoading(true)
    try {
      let startDate = dashboardStartDate
      let endDate = dashboardEndDate
      if (!startDate || !endDate) {
        const fallback = getDashboardRangeForPeriod("90d")
        startDate = startDate || fallback.start
        endDate = endDate || fallback.end
      }
      if (startDate > endDate) {
        const tmp = startDate
        startDate = endDate
        endDate = tmp
      }
      const params = new URLSearchParams({ startDate, endDate })
      if (dashboardSiteId) params.set("siteId", dashboardSiteId)
      const siteDashParams = new URLSearchParams()
      if (dashboardSiteId) siteDashParams.set("siteId", dashboardSiteId)
      const [statsRes, rawRes, siteDashRes] = await Promise.all([
        fetch(`/api/reports?${params}`),
        fetch(`/api/reports?${params}&raw=1&limit=10`),
        fetch(`/api/admin/site-dashboard?${siteDashParams}`),
      ])
      if (siteDashRes.ok) {
        const sd = await siteDashRes.json()
        setSiteDashboardSummary({
          sites: Array.isArray(sd.sites) ? sd.sites : [],
          machines: Array.isArray(sd.machines) ? sd.machines : [],
        })
      } else {
        setSiteDashboardSummary(null)
      }
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
      const res = await fetch("/api/sites?withReportCount=1&includeInactive=1")
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
      let data: { ok?: boolean; message?: string; error?: string; detail?: string } = {}
      try {
        data = await res.json()
      } catch {
        setTestEmailMsg({ ok: false, text: `Sunucu yanıtı okunamadı (HTTP ${res.status}).` })
        return
      }
      if (res.ok && data.ok) {
        setTestEmailMsg({ ok: true, text: data.message || "Test e-postası gönderildi." })
      } else {
        const parts = [data.error, data.detail].filter((s): s is string => Boolean(s && String(s).trim()))
        setTestEmailMsg({
          ok: false,
          text: parts.length > 0 ? parts.join(" — ") : `İstek başarısız (HTTP ${res.status}).`,
        })
      }
    } catch {
      setTestEmailMsg({ ok: false, text: "İstek gönderilemedi (ağ veya tarayıcı)." })
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
        secondarySiteId: user.secondary_site_id != null ? Number(user.secondary_site_id) : "",
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
        secondarySiteId: "",
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
      {reportPreviewId != null && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            bgcolor: "#fff",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <AppBar position="static" elevation={1} sx={{ bgcolor: "#1a237e" }}>
            <Toolbar>
              <IconButton edge="start" color="inherit" onClick={() => setReportPreviewId(null)} aria-label="Geri" size="large">
                <ArrowBack />
              </IconButton>
              <Typography variant="h6" sx={{ flexGrow: 1, ml: 1, fontWeight: 600 }}>
                Rapor önizleme
              </Typography>
            </Toolbar>
          </AppBar>
          <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
            <iframe
              title="Rapor önizleme"
              src={`/api/reports/${reportPreviewId}/preview`}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
            />
          </Box>
        </Box>
      )}

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
            {isSuperAdmin && <Tab label="Operatör girişleri" icon={<Engineering />} iconPosition="start" />}
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
                  <Card sx={{ background: "linear-gradient(135deg, #4caf50 0%, #43a047 100%)", color: "#fff", borderRadius: 2, height: "100%" }}>
                    <CardContent sx={{ pb: "16px !important" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.9, mb: 0.5 }}>
                        <Assessment fontSize="small" /> Bugünkü kazık (adet)
                      </Box>
                      <Typography variant="caption" sx={{ display: "block", opacity: 0.85, mb: 1 }}>
                        Aktif şantiyeler — bugün rapordaki toplam
                      </Typography>
                      <Box sx={{ maxHeight: 240, overflow: "auto", pr: 0.5 }}>
                        {(siteDashboardSummary?.sites?.length ?? 0) === 0 ? (
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>Şantiye özeti yok</Typography>
                        ) : (
                          siteDashboardSummary!.sites.map((s, idx) => (
                            <Box key={s.siteId}>
                              {idx > 0 && <Divider sx={{ borderColor: "rgba(255,255,255,0.25)", my: 1 }} />}
                              <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, display: "block" }}>
                                {s.siteName} ({s.siteCode})
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{s.todayPiles.toLocaleString("tr-TR")} ad.</Typography>
                            </Box>
                          ))
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ background: "linear-gradient(135deg, #ec407a 0%, #e91e63 100%)", color: "#fff", borderRadius: 2, height: "100%" }}>
                    <CardContent sx={{ pb: "16px !important" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.9, mb: 0.5 }}>
                        <Place fontSize="small" /> Kalan kazık (adet)
                      </Box>
                      <Typography variant="caption" sx={{ display: "block", opacity: 0.85, mb: 1 }}>
                        Bugünkü rapor / son rapor (günlük / toplam)
                      </Typography>
                      <Box sx={{ maxHeight: 240, overflow: "auto", pr: 0.5 }}>
                        {(siteDashboardSummary?.sites?.length ?? 0) === 0 ? (
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>Şantiye özeti yok</Typography>
                        ) : (
                          siteDashboardSummary!.sites.map((s, idx) => {
                            const g = s.remainingToday != null ? s.remainingToday.toLocaleString("tr-TR") : "—"
                            const t = s.remainingLatest != null ? s.remainingLatest.toLocaleString("tr-TR") : "—"
                            return (
                              <Box key={s.siteId}>
                                {idx > 0 && <Divider sx={{ borderColor: "rgba(255,255,255,0.25)", my: 1 }} />}
                                <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, display: "block" }}>
                                  {s.siteName} ({s.siteCode})
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {g} / {t} ad.
                                </Typography>
                              </Box>
                            )
                          })
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ background: "linear-gradient(135deg, #ffc107 0%, #ffb300 100%)", color: "#1a1a1a", borderRadius: 2, height: "100%" }}>
                    <CardContent sx={{ pb: "16px !important" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.85, mb: 0.5 }}>
                        <TrendingUp fontSize="small" /> Kazık imalatı (m)
                      </Box>
                      <Typography variant="caption" sx={{ display: "block", opacity: 0.8, mb: 1 }}>
                        Günlük / şimdiye kadar (tüm raporlar toplamı)
                      </Typography>
                      <Box sx={{ maxHeight: 240, overflow: "auto", pr: 0.5 }}>
                        {(siteDashboardSummary?.sites?.length ?? 0) === 0 ? (
                          <Typography variant="body2">Şantiye özeti yok</Typography>
                        ) : (
                          siteDashboardSummary!.sites.map((s, idx) => (
                            <Box key={s.siteId}>
                              {idx > 0 && <Divider sx={{ borderColor: "rgba(0,0,0,0.12)", my: 1 }} />}
                              <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                                {s.siteName} ({s.siteCode})
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {s.todayProduction.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} / {s.totalProduction.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} m
                              </Typography>
                            </Box>
                          ))
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", color: "#fff", borderRadius: 2, height: "100%" }}>
                    <CardContent sx={{ pb: "16px !important" }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, opacity: 0.9, mb: 0.5 }}>
                        <Construction fontSize="small" /> Aktif makineler
                      </Box>
                      <Typography variant="caption" sx={{ display: "block", opacity: 0.85, mb: 1 }}>
                        Şu an şantiyede (atanmış, durum aktif)
                      </Typography>
                      <Box sx={{ maxHeight: 240, overflow: "auto", pr: 0.5 }}>
                        {(siteDashboardSummary?.machines?.length ?? 0) === 0 ? (
                          <Typography variant="body2" sx={{ opacity: 0.9 }}>Atanmış aktif makine yok</Typography>
                        ) : (
                          (() => {
                            const machines = siteDashboardSummary!.machines
                            const bySite = new Map<number, (typeof machines)[number][]>()
                            for (const m of machines) {
                              const list = bySite.get(m.siteId) ?? []
                              list.push(m)
                              bySite.set(m.siteId, list)
                            }
                            const entries = [...bySite.entries()]
                            return entries.map(([sid, list], idx) => (
                              <Box key={sid}>
                                {idx > 0 && <Divider sx={{ borderColor: "rgba(255,255,255,0.25)", my: 1 }} />}
                                <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 600, display: "block" }}>
                                  {list[0].siteName} ({list[0].siteCode})
                                </Typography>
                                {list.map((m) => (
                                  <Typography key={m.id} variant="body2" sx={{ pl: 0.5, fontWeight: 500 }}>
                                    • {m.name}
                                    {m.machineType ? ` — ${m.machineType}` : ""}
                                  </Typography>
                                ))}
                              </Box>
                            ))
                          })()
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="dashboard-period-label">Zaman dilimi</InputLabel>
                  <Select
                    labelId="dashboard-period-label"
                    label="Zaman dilimi"
                    value={dashboardPeriod}
                    onChange={(e) => applyDashboardPeriod(e.target.value as DashboardPeriod)}
                    sx={{ background: "#fff" }}
                  >
                    <MenuItem value="7d">Son 7 gün</MenuItem>
                    <MenuItem value="30d">Son 30 gün</MenuItem>
                    <MenuItem value="90d">Son 90 gün</MenuItem>
                    <MenuItem value="this_month">Bu ay</MenuItem>
                    <MenuItem value="last_month">Geçen ay</MenuItem>
                    <MenuItem value="this_year">Bu yıl</MenuItem>
                    <MenuItem value="custom">Özel aralık</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  type="date"
                  label="Başlangıç"
                  value={dashboardStartDate}
                  onChange={(e) => {
                    setDashboardPeriod("custom")
                    setDashboardStartDate(e.target.value)
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ background: "#fff", minWidth: 160 }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="Bitiş"
                  value={dashboardEndDate}
                  onChange={(e) => {
                    setDashboardPeriod("custom")
                    setDashboardEndDate(e.target.value)
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ background: "#fff", minWidth: 160 }}
                />
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
                <Typography variant="caption" sx={{ color: "#64748b", width: "100%" }}>
                  Grafikler: {dashboardStartDate} — {dashboardEndDate}
                  {dashboardPeriod !== "custom" ? ` (${DASHBOARD_PERIOD_LABELS[dashboardPeriod]})` : ""}
                </Typography>
              </Box>
              {(dashboardStats?.daily?.length ?? 0) === 0 && (
                <Paper sx={{ p: 3, mb: 3, background: "#fff", border: "1px solid var(--icsp-nav-border)", textAlign: "center" }}>
                  <Typography variant="body2" sx={{ color: "#64748b" }}>
                    Seçilen dönemde ({dashboardStartDate} — {dashboardEndDate}) grafik verisi bulunamadı.
                  </Typography>
                </Paper>
              )}
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
                    Makine karşılaştırması ({dashboardStartDate} — {dashboardEndDate})
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
                      <TableCell sx={{ color: "var(--icsp-lacivert)", borderColor: "var(--icsp-nav-border)", fontWeight: 600 }}>Gönderen</TableCell>
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
                        <TableCell colSpan={10} sx={{ color: "#616161", borderColor: "var(--icsp-nav-border)" }}>
                          Henüz rapor yok
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentReports.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.date}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.project}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.site_name || "—"}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>{r.submitted_by_username ?? (r.submitted_by_user_id != null ? `#${r.submitted_by_user_id}` : "—")}</TableCell>
                          <TableCell sx={{ borderColor: "var(--icsp-nav-border)" }}>
                            {String(r.machine_names_list ?? r.selected_machine_name ?? "").trim() || "—"}
                          </TableCell>
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
                      {(user as { secondary_site_name?: string }).secondary_site_name ? (
                        <> + <strong>{(user as { secondary_site_name?: string }).secondary_site_name}</strong></>
                      ) : null}
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
                      if (!confirm(`"${user.username}" kullanıcısını silmek istediğinize emin misiniz?`)) return
                      try {
                        const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
                        const data = await res.json().catch(() => ({}))
                        if (res.ok) {
                          await loadUsersAndProjects()
                        } else {
                          alert([data.error || "Silinemedi.", data.detail].filter(Boolean).join("\n"))
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
                setSiteDialogData({ name: "", code: "", country: "", timezone: "", emailList: [], totalPiles: "", iqdPerUsd: "1320", contractUnitPrice: "", authorizedPerson: "", employer: "", projectStartDate: "", isOngoing: false, initialPilesDone: "", initialEmptyBorehole: "", assignedMachineIds: [], assignedOperatorIds: [], assignedMachineOperators: [], isActive: true, releaseMachinesWhenClosed: true })
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
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <span>{`${site.name} (${site.code})`}</span>
                      {(site as { is_active?: boolean }).is_active === false && (
                        <Chip size="small" label="Kapalı / iş bitti" color="default" variant="outlined" />
                      )}
                    </Box>
                  }
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
                    aria-label="Şantiyeyi pasifleştir"
                    sx={{ color: "#b71c1c" }}
                    onClick={() => {
                      if (
                        !confirm(
                          "Bu şantiye pasif yapılacak (formlarda ve proje listesinde görünmez). Makineler depoya çekilsin ve açık operatör atamaları kapatılsın mı?\n\nİptal derseniz işlem yapılmaz.",
                        )
                      ) {
                        return
                      }
                      void (async () => {
                        try {
                          const res = await fetch(`/api/sites/${site.id}`, {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ releaseMachines: true }),
                          })
                          const data = await res.json().catch(() => ({}))
                          if (res.ok) await loadSites()
                          else alert(data.error || "İşlem başarısız.")
                        } catch (e) {
                          console.error(e)
                          alert("İstek gönderilemedi.")
                        }
                      })()
                    }}
                  >
                    <Delete />
                  </IconButton>
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
                      iqdPerUsd: (site as any).iqd_per_usd != null ? String((site as any).iqd_per_usd) : "1320",
                      contractUnitPrice: (site as any).contract_unit_price != null ? String((site as any).contract_unit_price) : "",
                      authorizedPerson: (site as any).authorized_person != null ? String((site as any).authorized_person) : "",
                      employer: (site as any).employer != null ? String((site as any).employer) : "",
                      projectStartDate: (site as any).project_start_date ? String((site as any).project_start_date).slice(0, 10) : "",
                      isOngoing: (site as any).is_ongoing === true,
                      initialPilesDone: (site as any).initial_piles_done != null ? String((site as any).initial_piles_done) : "",
                      initialEmptyBorehole: (site as any).initial_empty_borehole != null ? String((site as any).initial_empty_borehole) : "",
                      assignedMachineIds: assignedIds,
                      assignedOperatorIds: Array.isArray((site as any).assigned_operator_ids) ? (site as any).assigned_operator_ids.map((x: unknown) => Number(x)).filter((n: number) => !Number.isNaN(n)) : [],
                      assignedMachineOperators: ops.map((o: any) => ({ machineId: String(o.machineId ?? o.machine_id ?? ""), personelId: Number(o.personelId ?? o.personel_id ?? 0) })).filter((o: { machineId: string; personelId: number }) => o.machineId && o.personelId > 0),
                      isActive: (site as { is_active?: boolean }).is_active !== false,
                      releaseMachinesWhenClosed: true,
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
          {isAdminOrSuper && (
            <Paper sx={{ p: 2, mb: 2, borderLeft: "4px solid #00796b", background: "#f1f8f6" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Eski fotoğrafları WebP&apos;ye çevir
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Yeni yüklemeler (günlük rapor, operatör, envanter, personel) tarayıcıda WebP veya JPEG olarak küçültülür. Veritabanında kalan büyük JPEG/PNG data URL
                kayıtlarını sunucuda WebP&apos;ye dönüştürmek için her tıklamada sınırlı sayıda satır işlenir; tüm kayıtlar bitene kadar düğmeyi tekrarlayın.
              </Typography>
              <Button
                variant="contained"
                size="small"
                disabled={webpMigrateLoading}
                onClick={async () => {
                  setWebpMigrateLoading(true)
                  try {
                    const res = await fetch("/api/admin/migrate-images-to-webp", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "same-origin",
                      body: JSON.stringify({ limit: 50 }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) {
                      alert(data.error || "Migrasyon başarısız.")
                      return
                    }
                    const wr = data.workReports
                    const oe = data.operatorEntries
                    const pe = data.personeller
                    const en = data.envanter
                    const lines = [
                      `Toplam güncellenen: ${data.totalUpdated ?? 0}`,
                      wr && `work_reports: +${wr.updated} (taranan ${wr.scanned}, atlanan ${wr.skipped})`,
                      oe && `operator_entries: +${oe.updated} (taranan ${oe.scanned})`,
                      pe && `personeller: +${pe.updated} (taranan ${pe.scanned})`,
                      en && `envanter: +${en.updated} (taranan ${en.scanned})`,
                    ].filter(Boolean)
                    if (Array.isArray(data.errors) && data.errors.length) {
                      lines.push(`Hatalar: ${data.errors.length} (konsol / sunucu log)`)
                    }
                    alert(lines.join("\n"))
                  } catch {
                    alert("İstek gönderilemedi.")
                  } finally {
                    setWebpMigrateLoading(false)
                  }
                }}
                sx={{ background: "#00796b", "&:hover": { background: "#00695c" } }}
              >
                {webpMigrateLoading ? "İşleniyor…" : "Bir parti WebP migrasyonu çalıştır"}
              </Button>
            </Paper>
          )}
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
                  <TableCell sx={{ fontWeight: 600 }}>Gönderen</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Makine</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Kazık Sayısı</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Kalan</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>İşlemler</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reportListLoading ? (
                  <TableRow><TableCell colSpan={8}>Yükleniyor...</TableCell></TableRow>
                ) : reportList.length === 0 ? (
                  <TableRow><TableCell colSpan={8}>Rapor bulunamadı.</TableCell></TableRow>
                ) : (
                  reportList.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{typeof r.date === "string" ? r.date.slice(0, 10) : r.date}</TableCell>
                      <TableCell>{r.project ?? "—"}</TableCell>
                      <TableCell>{r.site_name ?? "—"}</TableCell>
                      <TableCell>{r.submitted_by_username ?? (r.submitted_by_user_id != null ? `#${r.submitted_by_user_id}` : "—")}</TableCell>
                      <TableCell>
                        {String(r.machine_names_list ?? r.selected_machine_name ?? "").trim() || "—"}
                      </TableCell>
                      <TableCell>{[r.daily_pile_count, r.total_pile_count, r.concrete_poured].find((v) => v != null && String(v).trim() !== "") ?? "—"}</TableCell>
                      <TableCell>{r.remaining_piles != null && String(r.remaining_piles).trim() !== "" ? r.remaining_piles : "—"}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => openReportPreview(Number(r.id))} title="Görüntüle" sx={{ color: "#1976d2" }}>
                          <Visibility />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleResendReportEmail(Number(r.id))}
                          disabled={reportResendingId != null}
                          title="E-posta gönder"
                          sx={{ color: "#2e7d32" }}
                        >
                          {reportResendingId === Number(r.id) ? <CircularProgress size={18} /> : <Email />}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setReportEditDialog({ open: true, report: r })
                            setReportSaveFromFullJson(false)
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
                            const stripJoin = (row: Record<string, unknown>) => {
                              const { site_name: _sn, site_code: _sc, submitted_by_username: _su, ...rest } = row
                              return rest
                            }
                            if (isSuperAdmin && r.id != null) {
                              void fetch(`/api/reports/${r.id}`, { credentials: "same-origin" })
                                .then((res) => (res.ok ? res.json() : null))
                                .then((data: { report?: Record<string, unknown> } | null) => {
                                  if (data?.report && typeof data.report === "object") {
                                    setReportEditRawJson(JSON.stringify(stripJoin(data.report), null, 2))
                                  } else {
                                    setReportEditRawJson(JSON.stringify(stripJoin(r as Record<string, unknown>), null, 2))
                                  }
                                })
                                .catch(() => setReportEditRawJson(JSON.stringify(stripJoin(r as Record<string, unknown>), null, 2)))
                            } else {
                              setReportEditRawJson("")
                            }
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

        {isSuperAdmin && (
          <TabPanel value={tabValue} index={5}>
            <Typography variant="h6" sx={{ color: "#1a237e", fontWeight: 600, mb: 1 }}>
              Operatör makine girişleri
            </Typography>
            <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
              Operatörlerin uygulamada kaydettiği makine / saha girişleri (günlük çalışma raporundan ayrı listedir).
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
              <TextField
                size="small"
                type="date"
                label="Başlangıç"
                value={opFilterStart}
                onChange={(e) => setOpFilterStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ background: "#fff", minWidth: 160 }}
              />
              <TextField
                size="small"
                type="date"
                label="Bitiş"
                value={opFilterEnd}
                onChange={(e) => setOpFilterEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ background: "#fff", minWidth: 160 }}
              />
              <FormControl size="small" sx={{ minWidth: 200, background: "#fff" }}>
                <InputLabel>Şantiye</InputLabel>
                <Select value={opFilterSiteId} label="Şantiye" onChange={(e) => setOpFilterSiteId(e.target.value)}>
                  <MenuItem value="">Tümü</MenuItem>
                  {dbSites.map((s: { id: number; name: string; code: string }) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="contained" onClick={() => loadOperatorEntries()} disabled={operatorEntriesLoading}>
                {operatorEntriesLoading ? "Yükleniyor..." : "Listele"}
              </Button>
              <Button variant="outlined" color="primary" onClick={openOpCrudCreate} sx={{ ml: 1 }}>
                Yeni kayıt
              </Button>
            </Box>
            <Paper sx={{ background: "#fff", border: "1px solid var(--icsp-nav-border)", overflow: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Tarih</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Şantiye</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Operatör</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Makine</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Saat / motor</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Kazık / üretim</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Yakıt</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Detay</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>İşlemler</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operatorEntriesLoading ? (
                    <TableRow>
                      <TableCell colSpan={9}>Yükleniyor...</TableCell>
                    </TableRow>
                  ) : operatorEntriesList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9}>Kayıt yok.</TableCell>
                    </TableRow>
                  ) : (
                    operatorEntriesList.map((row) => {
                      const id = Number(row.id)
                      const rd = row.report_date instanceof Date ? row.report_date.toISOString().slice(0, 10) : String(row.report_date ?? "").slice(0, 10)
                      const motor = [row.motor_saat_binis, row.motor_saat_inis].filter(Boolean).join(" → ") || "—"
                      const hours = [row.start_time, row.end_time].filter(Boolean).join("–") || String(row.machine_hours ?? "—")
                      const pile = [row.daily_pile_count, row.total_production, row.concrete_poured].find((v) => v != null && String(v).trim() !== "") ?? "—"
                      return (
                        <TableRow key={id}>
                          <TableCell>{rd || "—"}</TableCell>
                          <TableCell>
                            {String(row.site_name ?? "—")}
                            {row.site_code ? (
                              <Typography component="span" variant="caption" sx={{ color: "#94a3b8", display: "block" }}>
                                {String(row.site_code)}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell>{String(row.operator_username ?? row.user_id ?? "—")}</TableCell>
                          <TableCell>{String(row.machine_name ?? "—")}</TableCell>
                          <TableCell>
                            <Typography variant="body2">{hours}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {motor}
                            </Typography>
                          </TableCell>
                          <TableCell>{String(pile)}</TableCell>
                          <TableCell>{String(row.used_fuel ?? "—")}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              title="Tüm alanlar"
                              onClick={() => {
                                setOpDetailRow(row)
                                setOpDetailOpen(true)
                              }}
                              sx={{ color: "#1976d2" }}
                            >
                              <Visibility />
                            </IconButton>
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" title="Düzenle" onClick={() => void openOpCrudEdit(row)} sx={{ color: "#ed6c02" }}>
                              <Edit />
                            </IconButton>
                            <IconButton size="small" title="Sil" onClick={() => setOpDeleteConfirmId(id)} sx={{ color: "#d32f2f" }}>
                              <Delete />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </Paper>
          </TabPanel>
        )}

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
            <TextField margin="dense" fullWidth label="Döviz kuru: 1 USD kaç IQD" value={siteDialogData.iqdPerUsd} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, iqdPerUsd: e.target.value }))} placeholder="1320" variant="outlined" size="small" type="number" inputProps={{ min: 1, step: 0.0001 }} helperText="Bilgi girişi ve harcamalarda çevrim için kullanılır" />

            <TextField margin="dense" fullWidth label="Yetkili kişi" value={siteDialogData.authorizedPerson} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, authorizedPerson: e.target.value }))} placeholder="Şantiye yetkilisi" variant="outlined" size="small" />
            <TextField margin="dense" fullWidth label="İşveren" value={siteDialogData.employer} onChange={(e) => setSiteDialogData((prev) => ({ ...prev, employer: e.target.value }))} placeholder="İşveren / firma" variant="outlined" size="small" />

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>Makineler ve operatörler</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
              Liste İdari → Makineler’de tanımlı kazık makinelerinden gelir. Yeni makine yoksa önce tanımlayın veya aşağıdan hızlı ekleyin. En az bir makine seçimi zorunludur.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1 }}>
              <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={() => setMakinelerRefreshToken((t) => t + 1)}>
                Listeyi yenile
              </Button>
              <Button size="small" component={Link} href="/idari/makineler" target="_blank" rel="noopener noreferrer" variant="text">
                İdari → Makineler
              </Button>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", mb: 1.5 }}>
              <TextField
                size="small"
                label="Hızlı: yeni kazık makinesi adı"
                value={quickMachineName}
                onChange={(e) => setQuickMachineName(e.target.value)}
                sx={{ flex: "1 1 200px", minWidth: 180 }}
                placeholder="Örn: KM-03"
              />
              <Button
                size="small"
                variant="contained"
                disabled={!quickMachineName.trim() || quickMachineSaving}
                sx={{ background: "var(--icsp-lacivert)" }}
                onClick={async () => {
                  const name = quickMachineName.trim()
                  if (!name) return
                  setQuickMachineSaving(true)
                  try {
                    const res = await fetch("/api/idari/makineler", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name, machine_type: "Kazık Makinesi", status: "depoda" }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      setQuickMachineName("")
                      setMakinelerRefreshToken((t) => t + 1)
                    } else {
                      alert(data.error || "Makine eklenemedi (yetki veya doğrulama).")
                    }
                  } catch (e) {
                    console.error(e)
                    alert("İstek gönderilemedi.")
                  } finally {
                    setQuickMachineSaving(false)
                  }
                }}
              >
                {quickMachineSaving ? "Ekleniyor…" : "Makineyi ekle"}
              </Button>
            </Box>
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
                          const p = operatörPersonelList.find((p) => p.id === id) ?? personelList.find((p) => p.id === id)
                          return p ? `${p.ad} ${p.soyad}` : String(id)
                        }).join(", ") || "— Seçin"}
                      >
                        {operatörPersonelList.map((p) => (
                          <MenuItem key={p.id} value={p.id}>{p.ad} {p.soyad} ({p.gorev})</MenuItem>
                        ))}
                      </Select>
                      {operatörPersonelList.length === 0 && (
                        <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5, maxWidth: 360 }}>
                          Listede görevi operatör olan personel yok. İdari → Personel’de görev alanına &quot;Operatör&quot; yazın.
                        </Typography>
                      )}
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
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.5 }} color="text.secondary">Şantiye durumu</Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={siteDialogData.isActive}
                  onChange={(e) => setSiteDialogData((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
              }
              label="Şantiye açık (bilgi girişi ve proje listesinde görünsün)"
            />
            {!siteDialogData.isActive && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={siteDialogData.releaseMachinesWhenClosed}
                    onChange={(e) => setSiteDialogData((prev) => ({ ...prev, releaseMachinesWhenClosed: e.target.checked }))}
                  />
                }
                label="Kayıtta makineleri şantiyeden kaldır ve bu makinelerdeki açık operatör atamalarını kapat"
              />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              İş bittiğinde şantiyeyi kapatabilirsiniz. Listeden tamamen düşürmek için şantiye satırındaki çöp simgesi şantiyeyi pasif yapar (rapor geçmişi kalır).
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }} color="text.secondary">Proje durumu</Typography>
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
              label="Devam Eden (rapor başlamadan önce yapılan kazık sayıları girilecek)"
            />
            {siteDialogData.isOngoing && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 0.5 }}>
                <TextField
                  margin="dense"
                  fullWidth
                  type="number"
                  label="Rapor öncesi boş foraj (Ad.)"
                  value={siteDialogData.initialEmptyBorehole}
                  onChange={(e) => setSiteDialogData((prev) => ({ ...prev, initialEmptyBorehole: e.target.value }))}
                  placeholder="Rapor başlamadan önce yapılan boş foraj"
                  inputProps={{ min: 0 }}
                />
                <TextField
                  margin="dense"
                  fullWidth
                  type="number"
                  label="Rapor öncesi yapılan kazık (Ad.)"
                  value={siteDialogData.initialPilesDone}
                  onChange={(e) => setSiteDialogData((prev) => ({ ...prev, initialPilesDone: e.target.value }))}
                  placeholder="Rapor öncesi kümülatif yapılan kazık"
                  inputProps={{ min: 0 }}
                  helperText="Kalan kazık = Proje toplamı − yapılan kazık − günlük yapılanlar (boş foraj bu hesaba katılmaz). Kaydettikten sonra alttaki düğmeyle eski raporlardaki kalan kazıkları güncelleyin."
                />
              </Box>
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
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
            <Button onClick={() => setSiteDialogOpen(false)}>{t("cancel")}</Button>
            {siteDialogData.id ? (
              <Button
                type="button"
                variant="outlined"
                disabled={siteRemainingRecalcLoading || !siteDialogData.totalPiles.trim()}
                onClick={async () => {
                  if (!siteDialogData.id) return
                  if (!siteDialogData.totalPiles.trim()) {
                    alert("Proje toplam kazık sayısı tanımlı olmalı. Önce şantiyeyi kaydedin.")
                    return
                  }
                  if (
                    !confirm(
                      "Bu şantiye için veritabanındaki tüm raporlarda kalan kazık, kayıtlı şantiye ayarına göre yeniden hesaplanacak. Devam edilsin mi?"
                    )
                  ) {
                    return
                  }
                  setSiteRemainingRecalcLoading(true)
                  try {
                    const res = await fetch("/api/admin/recalculate-site-remaining", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ siteId: siteDialogData.id }),
                    })
                    const data = await res.json().catch(() => ({}))
                    if (res.ok) {
                      alert(
                        data.updatedCount > 0
                          ? `${data.updatedCount} raporda kalan kazık güncellendi.`
                          : "Tüm raporlar zaten güncel görünüyor (değişen satır yok)."
                      )
                    } else {
                      alert(data.error || "İşlem başarısız.")
                    }
                  } catch (e) {
                    console.error(e)
                    alert("İstek gönderilemedi.")
                  } finally {
                    setSiteRemainingRecalcLoading(false)
                  }
                }}
              >
                {siteRemainingRecalcLoading ? "Hesaplanıyor…" : "Kalan kazıkları yeniden hesapla"}
              </Button>
            ) : null}
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
                if (kazikIds.length === 0 && siteDialogData.isActive) {
                  alert("Açık şantiye için en az bir kazık makinesi seçmelisiniz (İdari → Makineler’de tanımlı olmalı).")
                  return
                }
                const payload = {
                  name: siteDialogData.name.trim(),
                  code: siteDialogData.code.trim(),
                  country: siteDialogData.country.trim() || null,
                  timezone: siteDialogData.timezone.trim() || null,
                  emailList: Array.isArray(siteDialogData.emailList) ? siteDialogData.emailList : [],
                  totalPiles: siteDialogData.totalPiles.trim() ? parseInt(siteDialogData.totalPiles, 10) || null : null,
                  iqdPerUsd: siteDialogData.iqdPerUsd.trim() ? Number(siteDialogData.iqdPerUsd) : 1320,
                  authorizedPerson: siteDialogData.authorizedPerson.trim() || null,
                  employer: siteDialogData.employer.trim() || null,
                  projectStartDate: siteDialogData.projectStartDate.trim() || null,
                  isOngoing: siteDialogData.isOngoing,
                  initialPilesDone: siteDialogData.isOngoing && siteDialogData.initialPilesDone.trim() ? parseInt(siteDialogData.initialPilesDone, 10) || null : null,
                  initialEmptyBorehole: siteDialogData.isOngoing && siteDialogData.initialEmptyBorehole.trim() ? parseInt(siteDialogData.initialEmptyBorehole, 10) || null : null,
                  ...(isSuperAdmin ? { contractUnitPrice: siteDialogData.contractUnitPrice.trim() ? Number(siteDialogData.contractUnitPrice) : null } : {}),
                  assignedMachineIds: kazikIds,
                  assignedOperatorIds: siteDialogData.assignedOperatorIds || [],
                  assignedMachineOperators: (siteDialogData.assignedMachineOperators || []).filter((o) => o.personelId > 0 && kazikIds.includes(o.machineId)),
                  isActive: siteDialogData.isActive,
                  releaseMachinesFromSite: !siteDialogData.isActive && siteDialogData.releaseMachinesWhenClosed,
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

        <Dialog
          open={reportEditDialog.open}
          onClose={() => {
            setReportEditDialog({ open: false, report: null })
            setReportEditRawJson("")
            setReportSaveFromFullJson(false)
          }}
          maxWidth="sm"
          fullWidth
        >
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
                {isSuperAdmin && (
                  <>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={reportSaveFromFullJson}
                          onChange={(_, checked) => setReportSaveFromFullJson(checked)}
                          size="small"
                        />
                      }
                      label="Kaydı JSON içeriğine göre tam uygula (tüm work_reports kolonları; dikkatli kullanın)"
                    />
                    <TextField
                      size="small"
                      label="Super admin — work_reports JSON (yalnızca yukarıdaki kutuyu işaretlerseniz kayıtta kullanılır)"
                      multiline
                      rows={10}
                      value={reportEditRawJson}
                      onChange={(e) => setReportEditRawJson(e.target.value)}
                      fullWidth
                    />
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setReportEditDialog({ open: false, report: null }); setReportEditRawJson(""); setReportSaveFromFullJson(false) }}>İptal</Button>
            <Button
              variant="contained"
              onClick={async () => {
                if (!reportEditDialog.report?.id) return
                try {
                  let body: Record<string, unknown>
                  if (isSuperAdmin && reportSaveFromFullJson) {
                    if (!reportEditRawJson.trim()) {
                      alert("Tam JSON kaydı için metin alanı dolu olmalıdır.")
                      return
                    }
                    let parsed: unknown
                    try {
                      parsed = JSON.parse(reportEditRawJson)
                    } catch {
                      alert("JSON geçersiz. Lütfen düzeltip tekrar deneyin.")
                      return
                    }
                    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                      alert("JSON nesne formatında olmalıdır.")
                      return
                    }
                    body = { fullUpdate: true, rawData: parsed as Record<string, unknown> }
                  } else {
                    const pt =
                      reportEditForm.personnelTotal.trim() !== ""
                        ? parseInt(reportEditForm.personnelTotal, 10)
                        : undefined
                    body = {
                      date: reportEditForm.date || undefined,
                      project: reportEditForm.project || undefined,
                      totalProductionSummary: reportEditForm.totalProductionSummary || undefined,
                      dailyPileCount: reportEditForm.dailyPileCount || undefined,
                      remainingPiles: reportEditForm.remainingPiles || undefined,
                      dailyFuelUsage: reportEditForm.dailyFuelUsage || undefined,
                      personnelTotal: pt !== undefined && Number.isFinite(pt) ? pt : undefined,
                      notes: reportEditForm.notes !== undefined ? reportEditForm.notes : undefined,
                    }
                  }
                  const res = await fetch(`/api/reports/${reportEditDialog.report.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify(body),
                  })
                  if (res.ok) {
                    setReportEditDialog({ open: false, report: null })
                    setReportEditRawJson("")
                    setReportSaveFromFullJson(false)
                    loadReportList()
                  } else {
                    const data = await res.json().catch(() => ({}))
                    const detail = typeof (data as { detail?: string }).detail === "string" ? (data as { detail: string }).detail : ""
                    alert([data.error || "Güncelleme başarısız.", detail].filter(Boolean).join("\n"))
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
                      secondarySiteId: "",
                      modulePerms: { ...p.modulePerms, view_all_sites: "write" },
                    }))
                  } else {
                    setDbUserForm((p) => ({
                      ...p,
                      siteId: val === "" ? "" : Number(val),
                      secondarySiteId:
                        p.secondarySiteId !== "" && Number(p.secondarySiteId) === Number(val) ? "" : p.secondarySiteId,
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
            {dbUserForm.siteId !== "" && dbUserForm.siteId !== "genel" && (
              <FormControl fullWidth margin="dense" size="small" variant="outlined">
                <InputLabel>İkinci şantiye (opsiyonel)</InputLabel>
                <Select
                  value={dbUserForm.secondarySiteId === "" ? "" : dbUserForm.secondarySiteId}
                  label="İkinci şantiye (opsiyonel)"
                  onChange={(e) => {
                    const val = e.target.value
                    setDbUserForm((p) => ({
                      ...p,
                      secondarySiteId: val === "" ? "" : Number(val),
                    }))
                  }}
                >
                  <MenuItem value="">— Yok —</MenuItem>
                  {dbSites
                    .filter((s) => s.id !== dbUserForm.siteId)
                    .map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth margin="dense" size="small" variant="outlined">
              <InputLabel>Kullanıcı tipi (oturum rolü)</InputLabel>
              <Select value={dbUserForm.role} label="Kullanıcı tipi (oturum rolü)" onChange={(e) => setDbUserForm((p) => ({ ...p, role: e.target.value }))}>
                {(isSuperAdmin || dbUserForm.role === "super_admin") && <MenuItem value="super_admin">Super Admin</MenuItem>}
                <MenuItem value="admin">Yönetici</MenuItem>
                <MenuItem value="manager">Manager</MenuItem>
                <MenuItem value="user">İdari / Kullanıcı</MenuItem>
                <MenuItem value="personel">Personel</MenuItem>
                <MenuItem value="operator">Operatör</MenuItem>
                <MenuItem value="engineer">Mühendis</MenuItem>
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
                  if (
                  dbUserForm.siteId !== "" &&
                  dbUserForm.siteId !== "genel" &&
                  dbUserForm.secondarySiteId !== "" &&
                  Number(dbUserForm.siteId) === Number(dbUserForm.secondarySiteId)
                ) {
                  alert("İkinci şantiye birinciden farklı olmalıdır.")
                  return
                }
                const secondarySitePayload =
                  dbUserForm.siteId === "" || dbUserForm.siteId === "genel" || dbUserForm.secondarySiteId === ""
                    ? null
                    : dbUserForm.secondarySiteId
                if (dbUserEditingId != null) {
                    const body: Record<string, unknown> = {
                      role: dbUserForm.role,
                      siteId: (dbUserForm.siteId === "" || dbUserForm.siteId === "genel") ? null : dbUserForm.siteId,
                      secondarySiteId: secondarySitePayload,
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
                        secondarySiteId: secondarySitePayload,
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

      {/* Super admin: yeni rapor popup */}
      <Dialog open={notifPopup != null} onClose={() => setNotifPopup(null)} maxWidth="sm" fullWidth>
        {notifPopup && (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "#1a237e", fontWeight: 700 }}>
              <NotificationsActive color="primary" />
              {notifPopup.title}
            </DialogTitle>
            <DialogContent>
              {(notifPopup.anomalyCount ?? 0) > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {notifPopup.anomalyCount} adet dikkat uyarısı
                </Alert>
              )}
              <Typography variant="body1" sx={{ mb: 1 }}>
                {notifPopup.message}
              </Typography>
              {notifPopup.siteName && (
                <Typography variant="body2" color="text.secondary">
                  Şantiye: {notifPopup.siteName}
                  {notifPopup.siteCode ? ` (${notifPopup.siteCode})` : ""}
                </Typography>
              )}
              {notifPopup.type === "operator_entry" && notifPopup.machineName && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Makine: {notifPopup.machineName}
                </Typography>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setNotifPopup(null)}>Kapat</Button>
              {notifPopup.reportId != null && (
                <Button variant="contained" onClick={() => openReportPreview(notifPopup.reportId!)}>
                  Raporu aç
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Operatör girişi satır detayı */}
      <Dialog open={opDetailOpen} onClose={() => setOpDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ color: "#1a237e", fontWeight: 600 }}>Operatör girişi detayı</DialogTitle>
        <DialogContent dividers>
          {opDetailRow && (
            <Table size="small">
              <TableBody>
                {Object.entries(opDetailRow)
                  .filter(([, v]) => v != null && String(v).trim() !== "")
                  .map(([k, v]) => {
                    let str = typeof v === "object" ? JSON.stringify(v) : String(v)
                    if (str.length > 200) str = `${str.slice(0, 200)}…`
                    const label = k.replace(/_/g, " ")
                    return (
                      <TableRow key={k}>
                        <TableCell sx={{ fontWeight: 600, width: 200, verticalAlign: "top" }}>{label}</TableCell>
                        <TableCell sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{str}</TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpDetailOpen(false)}>Kapat</Button>
        </DialogActions>
      </Dialog>

      {/* Operatör girişi CRUD */}
      <Dialog open={opCrudOpen} onClose={() => !opCrudSaving && setOpCrudOpen(false)} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle sx={{ color: "#1a237e", fontWeight: 600 }}>
          {opCrudMode === "create" ? "Yeni operatör girişi" : "Operatör girişini düzenle"}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1, maxHeight: "70vh", overflow: "auto" }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
                <InputLabel>Şantiye</InputLabel>
                <Select
                  label="Şantiye"
                  value={opCrudForm.siteId}
                  onChange={(e) => setOpCrudForm((p) => ({ ...p, siteId: e.target.value }))}
                >
                  {dbSites.map((s: { id: number; name: string; code: string }) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Rapor tarihi"
                type="date"
                value={opCrudForm.reportDate}
                onChange={(e) => setOpCrudForm((p) => ({ ...p, reportDate: e.target.value.slice(0, 10) }))}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 160 }}
              />
            </Box>
            <FormControl size="small" fullWidth>
              <InputLabel>Operatör kullanıcı</InputLabel>
              <Select
                label="Operatör kullanıcı"
                value={opCrudForm.userId}
                onChange={(e) => setOpCrudForm((p) => ({ ...p, userId: e.target.value }))}
              >
                <MenuItem value="">Seçin</MenuItem>
                {operatorUsersForCrud.map((u: { id: number; username: string }) => (
                  <MenuItem key={u.id} value={String(u.id)}>{u.username}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Makine (şantiye kayıtlı)</InputLabel>
              <Select
                label="Makine (şantiye kayıtlı)"
                value={opCrudForm.dbMachineId === "" ? "" : String(opCrudForm.dbMachineId)}
                onChange={(e) => {
                  const v = e.target.value
                  const m = opCrudMachines.find((x) => String(x.id) === v)
                  if (m) {
                    setOpCrudForm((p) => ({
                      ...p,
                      dbMachineId: m.id,
                      machineId: `DB_${m.id}`,
                      machineName: m.name,
                    }))
                  } else {
                    setOpCrudForm((p) => ({ ...p, dbMachineId: "", machineId: "", machineName: "" }))
                  }
                }}
              >
                <MenuItem value="">— Elle makine kimliği gir —</MenuItem>
                {opCrudMachines.map((m) => (
                  <MenuItem key={m.id} value={String(m.id)}>{m.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              fullWidth
              label="Makine kimliği (örn. DB_12)"
              value={opCrudForm.machineId}
              onChange={(e) => setOpCrudForm((p) => ({ ...p, machineId: e.target.value }))}
              helperText="Listeden seçim yapınca dolar; gerekirse manuel düzenleyin."
            />
            <TextField
              size="small"
              fullWidth
              label="Makine adı"
              value={opCrudForm.machineName}
              onChange={(e) => setOpCrudForm((p) => ({ ...p, machineName: e.target.value }))}
              required
            />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              <TextField size="small" label="Başlangıç saati" value={opCrudForm.startTime} onChange={(e) => setOpCrudForm((p) => ({ ...p, startTime: e.target.value }))} placeholder="08:30" />
              <TextField size="small" label="Bitiş saati" value={opCrudForm.endTime} onChange={(e) => setOpCrudForm((p) => ({ ...p, endTime: e.target.value }))} />
              <TextField size="small" label="Motor saat (biniş)" value={opCrudForm.motorSaatBinis} onChange={(e) => setOpCrudForm((p) => ({ ...p, motorSaatBinis: e.target.value }))} />
              <TextField size="small" label="Motor saat (iniş)" value={opCrudForm.motorSaatInis} onChange={(e) => setOpCrudForm((p) => ({ ...p, motorSaatInis: e.target.value }))} />
            </Box>
            <TextField size="small" fullWidth label="Makine saatleri (metin)" value={opCrudForm.machineHours} onChange={(e) => setOpCrudForm((p) => ({ ...p, machineHours: e.target.value }))} />
            <TextField size="small" fullWidth label="Yakıt (L)" value={opCrudForm.usedFuel} onChange={(e) => setOpCrudForm((p) => ({ ...p, usedFuel: e.target.value }))} />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              <TextField size="small" label="Günlük kazık / adet" value={opCrudForm.dailyPileCount} onChange={(e) => setOpCrudForm((p) => ({ ...p, dailyPileCount: e.target.value }))} />
              <TextField size="small" label="Üretim (m)" value={opCrudForm.totalProduction} onChange={(e) => setOpCrudForm((p) => ({ ...p, totalProduction: e.target.value }))} />
              <TextField size="small" label="Beton dökülen (ad.)" value={opCrudForm.concretePoured} onChange={(e) => setOpCrudForm((p) => ({ ...p, concretePoured: e.target.value }))} />
            </Box>
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={3}
              label="Kazık derinlikleri (JSON)"
              value={opCrudForm.pileDepthsJson}
              onChange={(e) => setOpCrudForm((p) => ({ ...p, pileDepthsJson: e.target.value }))}
              helperText='Örn: [{"depth":"12.5","onForaj":false,"bosForaj":false}]'
            />
            <TextField size="small" fullWidth label="Yapılan iş / work_done" value={opCrudForm.workDone} onChange={(e) => setOpCrudForm((p) => ({ ...p, workDone: e.target.value }))} />
            <TextField size="small" fullWidth label="Makine notu" value={opCrudForm.note} onChange={(e) => setOpCrudForm((p) => ({ ...p, note: e.target.value }))} />
            <TextField size="small" fullWidth multiline minRows={2} label="Genel notlar" value={opCrudForm.notes} onChange={(e) => setOpCrudForm((p) => ({ ...p, notes: e.target.value }))} />
            <FormControlLabel control={<Checkbox checked={opCrudForm.malzemeIhtiyaci} onChange={(e) => setOpCrudForm((p) => ({ ...p, malzemeIhtiyaci: e.target.checked }))} />} label="Malzeme ihtiyacı" />
            <FormControlLabel control={<Checkbox checked={opCrudForm.servisIhtiyaci} onChange={(e) => setOpCrudForm((p) => ({ ...p, servisIhtiyaci: e.target.checked }))} />} label="Servis ihtiyacı" />
            <Typography variant="caption" color="text.secondary">
              Resim alanları çok büyük olabilir; gerekirse mevcut kaydı düzenlerken olduğu gibi bırakın veya boşaltın.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpCrudOpen(false)} disabled={opCrudSaving}>İptal</Button>
          <Button variant="contained" onClick={() => void submitOpCrud()} disabled={opCrudSaving}>
            {opCrudSaving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={opDeleteConfirmId != null} onClose={() => setOpDeleteConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Operatör girişini sil</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Bu kayıt kalıcı olarak silinecek. Devam edilsin mi?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpDeleteConfirmId(null)}>İptal</Button>
          <Button color="error" variant="contained" onClick={() => opDeleteConfirmId != null && void deleteOpEntry(opDeleteConfirmId)}>
            Sil
          </Button>
        </DialogActions>
      </Dialog>

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
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{n.title}</Typography>
                      {n.anomalyCount && n.anomalyCount > 0 && (
                        <Chip label={`${n.anomalyCount} uyarı`} size="small" sx={{ background: "#fef3c7", color: "#92400e", fontSize: "0.65rem" }} />
                      )}
                      {n.reportId != null && (
                        <Button
                          size="small"
                          variant="text"
                          sx={{ minWidth: 0, p: 0, fontSize: "0.75rem" }}
                          onClick={() => openReportPreview(n.reportId!)}
                        >
                          Raporu aç
                        </Button>
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

      {/* Rapor e-posta gönderim sonucu */}
      <Snackbar
        open={emailSnack.open}
        autoHideDuration={6000}
        onClose={() => setEmailSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={emailSnack.severity}
          onClose={() => setEmailSnack((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {emailSnack.message}
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
