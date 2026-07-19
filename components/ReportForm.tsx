"use client"

import { useState, useEffect } from "react"
import { Container, Paper, Stepper, Step, StepLabel, Box, Button, Typography, Grid, Table, TableBody, TableCell, TableHead, TableRow, Alert, Snackbar } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"
import LanguageSelector from "@/components/language-selector"
import { useFormDraft, loadDraft, clearDraft } from "@/lib/use-form-draft"
import BasicInfoStep, { type SiteSummaryForForm } from "@/components/steps/basic-info-step"
import ProductionSummaryStep from "@/components/steps/production-summary-step"
import PileDetailsStep from "@/components/steps/pile-details-step"
import PersonnelStep from "@/components/steps/personnel-step"
import VehiclesStep from "@/components/steps/vehicles-step"
import FuelStep from "@/components/steps/fuel-step"
import ExpensesStep from "@/components/steps/expenses-step"
import DailyInfoStep from "@/components/steps/daily-info-step"
import ReviewStep from "@/components/steps/review-step"
import { type FormData, type Machine, type MachineBasicInfo, type MachineProductionSummary, initialFormData, AVAILABLE_MACHINES } from "@/types/form-data"
import { shrinkDailyInfoImagesForSubmit } from "@/lib/image-webp-client"
import { estimateJsonPayloadBytes, readResponseJsonSafe, buildReportSubmitUserMessage } from "@/lib/report-submit-client"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import CircularProgress from "@mui/material/CircularProgress"

const steps = [
  "basic_info",
  "production_summary",
  "personnel_vehicles",
  "fuel",
  "expenses",
  "daily_info",
  "review",
]

const stepsRestricted = [
  "info_and_entry",
  "personnel_vehicles",
  "fuel",
  "expenses",
  "daily_info",
  "review",
]

export interface ReportFormProps {
  initialSiteId?: number
  initialSiteName?: string
  lockedSiteId?: number
}

function numFieldOk(s: string | undefined): boolean {
  const t = String(s ?? "").trim()
  if (t === "") return false
  const n = Number(t.replace(",", "."))
  return Number.isFinite(n)
}

function reportBasicErrors(fd: FormData): string[] {
  const e: string[] = []
  if (fd.basicInfo.siteId == null) e.push("Şantiye seçin.")
  if (!String(fd.basicInfo.date ?? "").trim()) e.push("Rapor tarihi girin.")
  return e
}

function reportProductionErrors(fd: FormData): string[] {
  const e: string[] = []
  if (fd.productionSummary.length === 0) e.push("Şantiye için makine listesi yüklenemedi; şantiye seçimini kontrol edin.")
  for (const m of fd.productionSummary) {
    const label = m.machineName || "Makine"
    if (!numFieldOk(m.dailyDrilledPiles)) e.push(`${label}: O gün yapılan kazık (delgi, Ad.) — çalışma yoksa 0 yazın.`)
    if (!numFieldOk(m.totalProduction)) e.push(`${label}: Kazık imalatı (m) — çalışma yoksa 0 yazın.`)
    if (!numFieldOk(m.preBorehole)) e.push(`${label}: Ön foraj (Ad.) — çalışma yoksa 0 yazın.`)
    if (!numFieldOk(m.emptyBorehole)) e.push(`${label}: Boş foraj (Ad.) — çalışma yoksa 0 yazın.`)
  }
  if (!numFieldOk(fd.siteConcretePouredPiles)) e.push("Beton dökülen kazık (şantiye toplamı, Ad.) — yoksa 0 yazın.")
  const beton = parseInt(String(fd.siteConcretePouredPiles ?? "").trim(), 10) || 0
  const filledRows = (fd.pileDetails || []).filter((p) => String(p.drilled ?? "").trim() || String(p.notes ?? "").trim()).length
  if (beton > 0 && filledRows < beton) {
    e.push(`Kazık detayları: ${beton} betonlu kazık için en az ${beton} satırda delik veya not girilmeli (şu an ${filledRows} satır).`)
  }
  const machineIds = fd.productionSummary.filter((m) => m.machineId).map((m) => m.machineId)
  if (machineIds.length > 1) {
    const bad = fd.pileDetails.some((p) => p.concretePoured === true && (!(p.machineIds && p.machineIds.length)))
    if (bad) e.push("Kazık detayları: Beton döküldü işaretli satırlarda hangi makineye ait olduğunu işaretleyin.")
  }
  return e
}

export default function ReportForm({ initialSiteId, initialSiteName, lockedSiteId }: ReportFormProps) {
  const isRestricted = lockedSiteId != null
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [stepErrors, setStepErrors] = useState<string[]>([])
  const [siteSummary, setSiteSummary] = useState<SiteSummaryForForm | null>(null)
  const [assignedOperatorNames, setAssignedOperatorNames] = useState<string[]>([])
  const [showPrevDayPlannedDialog, setShowPrevDayPlannedDialog] = useState(false)
  const [prevDayPlannedText, setPrevDayPlannedText] = useState<string | null>(null)
  type OperatorEntryRow = {
    id?: number
    machine_id?: string
    machine_name?: string
    username?: string
    machine_hours?: string
    used_fuel?: string
    work_done?: string
    note?: string
    daily_pile_count?: string
    total_production?: string
    empty_borehole?: string
    pre_borehole?: string
    concrete_poured?: string
    pile_depths?: Array<{ depth?: string | number; onForaj?: boolean; bosForaj?: boolean }>
  }
  const [operatorEntriesForDate, setOperatorEntriesForDate] = useState<OperatorEntryRow[]>([])
  const [reportMachineOptions, setReportMachineOptions] = useState<Machine[]>(AVAILABLE_MACHINES)
  const [machineReloadToken, setMachineReloadToken] = useState(0)
  const [draftSnack, setDraftSnack] = useState<{ open: boolean; savedAt?: number }>({ open: false })
  const [draftRestoreSnack, setDraftRestoreSnack] = useState(false)
  // Two-step save/email flow
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false)
  const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [savedReportId, setSavedReportId] = useState<number | null>(null)
  const [savedRecipients, setSavedRecipients] = useState<string[]>([])
  const { t } = useLanguage()
  const stepsToUse = isRestricted ? stepsRestricted : steps

  // Taslak otomatik kayıt
  const siteIdForDraft = formData.basicInfo?.siteId ?? initialSiteId ?? null
  const { clear: clearDraftFn } = useFormDraft(
    formData,
    siteIdForDraft,
    formData.basicInfo?.siteName,
    formData.basicInfo?.date,
    true,
  )

  // Sayfa açıldığında taslak var mı kontrol et
  useEffect(() => {
    // 2sn bekle — initialSiteId zaten setlendikten sonra kontrol et
    const timer = setTimeout(() => {
      const siteId = formData.basicInfo?.siteId ?? initialSiteId ?? null
      const draft = loadDraft(siteId)
      if (draft && draft.meta.savedAt) {
        setDraftSnack({ open: true, savedAt: draft.meta.savedAt })
      }
    }, 800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // siteId'yi şantiye adı API'den gelmeden hemen yaz (aksi halde siteId null kalır, gönderim 403 verir)
  useEffect(() => {
    if (initialSiteId == null) return
    setFormData((prev) => ({
      ...prev,
      basicInfo: {
        ...prev.basicInfo,
        siteId: initialSiteId,
        ...(initialSiteName
          ? { siteName: initialSiteName, project: initialSiteName }
          : {}),
      },
    }))
  }, [initialSiteId, initialSiteName])

  useEffect(() => {
    const sid = formData.basicInfo.siteId ?? initialSiteId ?? lockedSiteId ?? null
    if (sid == null) return
    let cancelled = false
    fetch(`/api/sites/${sid}/last-report`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((d: { iqd_per_usd?: number | null }) => {
        if (cancelled) return
        const iq = d.iqd_per_usd != null && Number(d.iqd_per_usd) > 0 ? Number(d.iqd_per_usd) : 1320
        setSiteSummary((prev) => ({
          totalPiles: prev?.totalPiles ?? null,
          lastDate: prev?.lastDate ?? null,
          remainingPiles: prev?.remainingPiles ?? null,
          projectStartDate: prev?.projectStartDate ?? null,
          isOngoing: prev?.isOngoing ?? false,
          initialPilesDone: prev?.initialPilesDone ?? null,
          initialEmptyBorehole: prev?.initialEmptyBorehole ?? null,
          iqdPerUsd: iq,
        }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [formData.basicInfo.siteId, initialSiteId, lockedSiteId])

  // Şantiye seçilince atanmış tüm aktif makineleri yükle (assigned_machine_ids + current_site_id)
  useEffect(() => {
    const siteId = formData.basicInfo?.siteId
    if (siteId == null || !siteId) {
      setReportMachineOptions(AVAILABLE_MACHINES)
      return
    }
    let cancelled = false
    const mapRow = (m: {
      id: number
      name: string
      machine_type: string
      marka?: string | null
      model?: string | null
      plaka_no?: string | null
      seri_no?: string | null
      status?: string | null
      notlar?: string | null
    }): Machine => ({
      id: String(m.id),
      name: m.name,
      type: m.machine_type || "Kazık Makinesi",
      marka: m.marka ?? undefined,
      model: m.model ?? undefined,
      plaka_no: m.plaka_no ?? undefined,
      seri_no: m.seri_no ?? undefined,
      status: m.status ?? undefined,
      notlar: m.notlar ?? undefined,
    })
    // Şantiye atama listesi (hurda hariç tüm durumlar) + idari liste birleşimi
    Promise.all([
      fetch(`/api/sites/${siteId}/machines`).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/idari/makineler?siteId=${siteId}`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([siteList, idariList]) => {
        if (cancelled) return
        const byId = new Map<string, Machine>()
        for (const raw of [...(Array.isArray(siteList) ? siteList : []), ...(Array.isArray(idariList) ? idariList : [])]) {
          if (!raw || raw.id == null) continue
          // Hurda makineleri bilgi girişine alma
          if (String(raw.status ?? "").toLowerCase() === "hurda") continue
          const m = mapRow(raw)
          byId.set(String(m.id), m)
        }
        const merged = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"))
        // Bilgi girişi: kazık makineleri öncelikli; yoksa tüm atanmışlar
        const isKazik = (m: Machine) => {
          const t = (m.type || "").toLocaleLowerCase("tr-TR")
          return t.includes("kazık") || t.includes("kazik")
        }
        const kazik = merged.filter(isKazik)
        // Atanmış birden fazla makine varsa hepsini göster (tip filtresi yüzünden tekine düşmesin)
        const fromDb = merged.length > 1 ? (kazik.length > 1 ? kazik : merged) : (kazik.length > 0 ? kazik : merged)
        const options = fromDb.length > 0 ? fromDb : AVAILABLE_MACHINES
        setReportMachineOptions(options)
        setFormData((prev) => {
          const siteChanged = Number(prev.basicInfo.siteId) !== Number(siteId)
          const mapProduction = (m: Machine): MachineProductionSummary => {
            const old = prev.productionSummary.find((p) => String(p.machineId) === String(m.id))
            return old
              ? {
                  ...old,
                  machineId: m.id,
                  machineName: m.name,
                  dailyDrilledPiles: old.dailyDrilledPiles ?? "",
                }
              : {
                  machineId: m.id,
                  machineName: m.name,
                  totalProduction: "",
                  emptyBorehole: "",
                  preBorehole: "",
                  concretePoured: "",
                  dailyDrilledPiles: "",
                }
          }
          const mapBasic = (m: Machine): MachineBasicInfo => {
            const old = prev.basicInfo.machines.find((b) => String(b.machineId) === String(m.id))
            return old
              ? { ...old, machineId: m.id, machineName: m.name }
              : {
                  machineId: m.id,
                  machineName: m.name,
                  machineHours: "",
                  usedFuel: "",
                  changedDiamondCount: "",
                  note: "",
                }
          }
          // Şantiye makineleri her zaman tam liste; eski taslak tek makineye düşürmesin
          const productionSummary = options.map(mapProduction)
          const machines = options.map(mapBasic)
          const validIds = new Set(options.map((m) => String(m.id)))
          const pileDetails = (prev.pileDetails || []).map((p) => {
            const nextIds = (p.machineIds ?? []).filter((id) => validIds.has(String(id)))
            if (siteChanged) {
              return { ...p, machineIds: options.length === 1 ? [options[0].id] : nextIds }
            }
            return { ...p, machineIds: nextIds.length > 0 ? nextIds : (options.length === 1 ? [options[0].id] : nextIds) }
          })
          return {
            ...prev,
            siteConcretePouredPiles: siteChanged ? "" : (prev.siteConcretePouredPiles ?? ""),
            pileDetails,
            machineSelection: {
              ...prev.machineSelection,
              selectedMachine: options[0] ?? null,
              additionalMachines: options.slice(1),
            },
            basicInfo: { ...prev.basicInfo, machines },
            productionSummary,
          }
        })
      })
      .catch(() => {
        if (!cancelled) setReportMachineOptions(AVAILABLE_MACHINES)
      })
    return () => {
      cancelled = true
    }
  }, [formData.basicInfo?.siteId, machineReloadToken])

  // Kullanıcı/Personel: atanmış operatör isimleri ve dünkü planlanan işler pop-up
  useEffect(() => {
    if (!isRestricted || initialSiteId == null) return
    fetch(`/api/sites/${initialSiteId}/assigned-operators`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { id: number; username: string }[]) => setAssignedOperatorNames(list.map((u) => u.username)))
      .catch(() => {})
    fetch(`/api/reports/prev-day-planned?siteId=${initialSiteId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { nextDayPlanned?: string | null } | null) => {
        if (data?.nextDayPlanned) {
          setPrevDayPlannedText(data.nextDayPlanned)
          setShowPrevDayPlannedDialog(true)
        }
      })
      .catch(() => {})
  }, [isRestricted, initialSiteId])

  // Şantiye + tarih seçildiğinde operatör girişlerini al (hem manager hem kullanıcı/personel için)
  useEffect(() => {
    const siteId = formData.basicInfo?.siteId
    const rawDate = formData.basicInfo?.date
    if (siteId == null || !rawDate) {
      setOperatorEntriesForDate([])
      return
    }
    const reportDate = String(rawDate).slice(0, 10)
    let cancelled = false
    fetch(`/api/operator-entry?siteId=${siteId}&reportDate=${encodeURIComponent(reportDate)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: OperatorEntryRow[]) => {
        if (!cancelled) setOperatorEntriesForDate(Array.isArray(list) ? list : [])
      })
      .catch(() => { if (!cancelled) setOperatorEntriesForDate([]) })
    return () => { cancelled = true }
  }, [formData.basicInfo?.siteId, formData.basicInfo?.date])

  const handleNext = () => {
    setStepErrors([])
    if (isRestricted) {
      if (activeStep === 0) {
        const errs = [...reportBasicErrors(formData), ...reportProductionErrors(formData)]
        if (errs.length) {
          setStepErrors(errs)
          return
        }
        setActiveStep(1)
        return
      }
      setActiveStep((prev) => prev + 1)
      return
    }
    if (activeStep === 0) {
      const errs = reportBasicErrors(formData)
      if (errs.length) {
        setStepErrors(errs)
        return
      }
      setActiveStep(1)
      return
    }
    if (activeStep === 1) {
      const errs = reportProductionErrors(formData)
      if (errs.length) {
        setStepErrors(errs)
        return
      }
      setActiveStep(2)
      return
    }
    setActiveStep((prev) => prev + 1)
  }

  const handleBack = () => setActiveStep((prev) => Math.max(0, prev - 1))

  // Step 1: "Kaydet" butonuna basıldığında onay dialogu göster
  const handleSubmit = () => {
    setShowSaveConfirmDialog(true)
  }

  // Step 2: Onay sonrası raporu kaydet (e-posta olmadan)
  const handleConfirmSave = async () => {
    setShowSaveConfirmDialog(false)
    setIsSaving(true)
    try {
      const prepared = await shrinkDailyInfoImagesForSubmit(formData)
      const payload = { ...prepared, skipEmail: true }
      const approxBytes = estimateJsonPayloadBytes(payload)
      if (approxBytes > 10 * 1024 * 1024) {
        alert(t("report_submit_error_too_large"))
        return
      }
      const timeoutSignal =
        typeof AbortSignal !== "undefined" && typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === "function"
          ? (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout(180000)
          : undefined
      let response: Response
      try {
        response = await fetch("/api/send-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
          ...(timeoutSignal ? { signal: timeoutSignal } : {}),
        })
      } catch (err) {
        console.error("Error saving report (fetch):", err)
        alert(buildReportSubmitUserMessage(t, null, null, err))
        return
      }
      const data = await readResponseJsonSafe(response)
      if (response.ok && data && (data as { success?: boolean }).success === true) {
        const ok = data as { success?: boolean; reportId?: number; recipients?: string[] }
        clearDraftFn()
        clearDraft(siteIdForDraft)
        setSavedReportId(ok.reportId ?? null)
        setSavedRecipients(Array.isArray(ok.recipients) ? ok.recipients : [])
        setFormData(initialFormData)
        setActiveStep(0)
        setShowEmailConfirmDialog(true)
      } else {
        alert(buildReportSubmitUserMessage(t, response, data, null))
      }
    } catch (error) {
      console.error("Error saving report:", error)
      alert(buildReportSubmitUserMessage(t, null, null, error))
    } finally {
      setIsSaving(false)
    }
  }

  // Step 3: E-posta gönder
  const handleConfirmEmail = async () => {
    setShowEmailConfirmDialog(false)
    if (!savedReportId) return
    setIsSendingEmail(true)
    try {
      const timeoutSignal =
        typeof AbortSignal !== "undefined" && typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === "function"
          ? (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout(120000)
          : undefined
      let response: Response
      try {
        response = await fetch("/api/send-report/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ reportId: savedReportId }),
          ...(timeoutSignal ? { signal: timeoutSignal } : {}),
        })
      } catch (err) {
        alert(buildReportSubmitUserMessage(t, null, null, err))
        return
      }
      const data = await readResponseJsonSafe(response)
      if (response.ok && data && (data as { emailSent?: boolean }).emailSent) {
        alert(`E-posta gönderildi: ${((data as { recipients?: string[] }).recipients ?? []).join(", ")}`)
      } else {
        const d = data as { error?: string; emailError?: string } | null
        alert(d?.error || d?.emailError || buildReportSubmitUserMessage(t, response, data, null))
      }
    } catch (error) {
      console.error("Error sending email:", error)
      alert(buildReportSubmitUserMessage(t, null, null, error))
    } finally {
      setIsSendingEmail(false)
      setSavedReportId(null)
    }
  }

  const updateFormData = (section: keyof FormData, data: any) => {
    setFormData((prev) => ({ ...prev, [section]: data }))
  }

  const projectTotalPiles = siteSummary?.totalPiles ?? undefined
  const remainingValid = siteSummary?.remainingPiles != null && String(siteSummary.remainingPiles).trim() !== ""
  const totalCompletedBeforeToday =
    siteSummary?.totalPiles != null && remainingValid
      ? siteSummary.totalPiles - (parseInt(siteSummary.remainingPiles!, 10) || 0)
      : (siteSummary?.initialPilesDone != null ? siteSummary.initialPilesDone : 0)

  const renderStepContent = (step: number) => {
    const machineNamesHeader = formData.basicInfo.machines.map((m) => m.machineName).filter(Boolean).join(", ") || "—"

    const operatorReadonlyPaper = (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          Operatör girişi (bilgi amaçlı; rapor üretimini etkilemez)
        </Typography>
        {operatorEntriesForDate.length > 0 ? (
          <Box sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Makine</strong></TableCell>
                  <TableCell><strong>Operatör</strong></TableCell>
                  <TableCell><strong>Kazık (Ad.)</strong></TableCell>
                  <TableCell><strong>İmalat (m)</strong></TableCell>
                  <TableCell><strong>Boş Foraj</strong></TableCell>
                  <TableCell><strong>Ön Foraj</strong></TableCell>
                  <TableCell><strong>Beton Dökülen</strong></TableCell>
                  <TableCell><strong>Not</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {operatorEntriesForDate.map((row, idx) => (
                  <TableRow key={row.id ?? idx}>
                    <TableCell>{row.machine_name ?? "—"}</TableCell>
                    <TableCell>{row.username ?? "—"}</TableCell>
                    <TableCell>{row.daily_pile_count ?? "—"}</TableCell>
                    <TableCell>{row.total_production ?? "—"}</TableCell>
                    <TableCell>{row.empty_borehole ?? "—"}</TableCell>
                    <TableCell>{row.pre_borehole ?? "—"}</TableCell>
                    <TableCell>{row.concrete_poured ?? "—"}</TableCell>
                    <TableCell sx={{ maxWidth: 180 }}>{row.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Alert severity="info">
            Bu şantiye ve tarih için henüz operatör girişi yok. Üretim özeti aşağıda şantiye sorumlusu tarafından girilir.
          </Alert>
        )}
      </Paper>
    )

    const productionAndPiles = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <ProductionSummaryStep
          data={formData.productionSummary}
          onChange={(d) => updateFormData("productionSummary", d)}
          siteConcretePouredPiles={formData.siteConcretePouredPiles ?? ""}
          onSiteConcreteChange={(v) => setFormData((p) => ({ ...p, siteConcretePouredPiles: v }))}
          machinesAvailableToAdd={reportMachineOptions}
          onAddMachine={(machine) => {
            const newProductionSummary: MachineProductionSummary = {
              machineId: machine.id,
              machineName: machine.name,
              totalProduction: "",
              emptyBorehole: "",
              preBorehole: "",
              concretePoured: "",
              dailyDrilledPiles: "",
            }
            const newBasicInfoMachine: MachineBasicInfo = {
              machineId: machine.id,
              machineName: machine.name,
              machineHours: "",
              usedFuel: "",
              changedDiamondCount: "",
              note: "",
            }
            updateFormData("productionSummary", [...formData.productionSummary, newProductionSummary])
            updateFormData("basicInfo", { ...formData.basicInfo, machines: [...formData.basicInfo.machines, newBasicInfoMachine] })
            updateFormData("machineSelection", {
              ...formData.machineSelection,
              additionalMachines: [...formData.machineSelection.additionalMachines, machine],
              showAddMachineAfterStep2: true,
            })
          }}
          projectTotalPiles={projectTotalPiles}
          totalCompletedBeforeToday={totalCompletedBeforeToday}
        />
        {operatorReadonlyPaper}
        <PileDetailsStep
          data={formData.pileDetails}
          onChange={(d) => updateFormData("pileDetails", d)}
          productionSummary={formData.productionSummary}
          siteConcretePouredPiles={formData.siteConcretePouredPiles}
        />
      </Box>
    )

    if (isRestricted) {
      if (step === 0) {
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Paper sx={{ p: 2, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", border: "1px solid #2196f3" }}>
              <Typography variant="subtitle1" sx={{ color: "#1565c0", fontWeight: 600, mb: 1.5 }}>
                Şantiye, makineler ve operatör (otomatik atandı)
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
                <Typography variant="body2">
                  <strong>Şantiye:</strong> {formData.basicInfo.siteName || "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Makineler:</strong> {machineNamesHeader}
                </Typography>
                <Typography variant="body2">
                  <strong>Operatör:</strong> {assignedOperatorNames.length ? assignedOperatorNames.join(", ") : "—"}
                </Typography>
              </Box>
            </Paper>
            <BasicInfoStep
              data={formData.basicInfo}
              onChange={(d) => updateFormData("basicInfo", d)}
              currentMachineIndex={0}
              currentMachine={formData.basicInfo.machines[0] || null}
              allMachines={formData.basicInfo.machines}
              onMachineChange={(machineData) => {
                const updatedMachines = [...formData.basicInfo.machines]
                if (updatedMachines.length) updatedMachines[0] = machineData
                else updatedMachines.push(machineData)
                updateFormData("basicInfo", { ...formData.basicInfo, machines: updatedMachines })
              }}
              onSiteSummaryChange={(s) => setSiteSummary(s)}
              lockedSiteId={lockedSiteId ?? undefined}
            />
            {productionAndPiles}
          </Box>
        )
      }
      switch (step) {
        case 1:
          return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <PersonnelStep
                data={formData.personnel}
                onChange={(d) => updateFormData("personnel", d)}
                puantaj={formData.puantaj ?? []}
                onPuantajChange={(entries) => updateFormData("puantaj", entries)}
                siteId={formData.basicInfo.siteId}
                tarih={formData.basicInfo.date}
              />
              <VehiclesStep data={formData.vehicles} onChange={(d) => updateFormData("vehicles", d)} />
            </Box>
          )
        case 2:
          return (
            <FuelStep
              data={formData.fuel}
              onChange={(d) => updateFormData("fuel", d)}
              selectedMachine={formData.machineSelection.selectedMachine}
              additionalMachines={formData.machineSelection.additionalMachines}
              basicInfoMachines={formData.basicInfo.machines}
            />
          )
        case 3:
          return <ExpensesStep data={formData.expenses} onChange={(d) => updateFormData("expenses", d)} iqdPerUsd={siteSummary?.iqdPerUsd} />
        case 4:
          return <DailyInfoStep data={formData.dailyInfo} onChange={(d) => updateFormData("dailyInfo", d)} />
        case 5:
          return <ReviewStep data={formData} onSubmit={handleSubmit} siteSummary={siteSummary ?? undefined} />
        default:
          return null
      }
    }
    switch (step) {
      case 0:
        return (
          <BasicInfoStep
            data={formData.basicInfo}
            onChange={(d) => updateFormData("basicInfo", d)}
            currentMachineIndex={formData.machineSelection.currentMachineIndex}
            currentMachine={formData.basicInfo.machines[formData.machineSelection.currentMachineIndex] || null}
            allMachines={formData.basicInfo.machines}
            onMachineChange={(machineData) => {
              const updatedMachines = [...formData.basicInfo.machines]
              const idx = formData.machineSelection.currentMachineIndex
              if (updatedMachines[idx]) updatedMachines[idx] = machineData
              else updatedMachines.push(machineData)
              updateFormData("basicInfo", { ...formData.basicInfo, machines: updatedMachines })
            }}
            onAddMachine={(machine) => {
              const newProductionSummary: MachineProductionSummary = {
                machineId: machine.id,
                machineName: machine.name,
                totalProduction: "",
                emptyBorehole: "",
                preBorehole: "",
                concretePoured: "",
                dailyDrilledPiles: "",
              }
              const newBasicInfoMachine: MachineBasicInfo = {
                machineId: machine.id,
                machineName: machine.name,
                machineHours: "",
                usedFuel: "",
                changedDiamondCount: "",
                note: "",
              }
              updateFormData("productionSummary", [...formData.productionSummary, newProductionSummary])
              updateFormData("basicInfo", { ...formData.basicInfo, machines: [...formData.basicInfo.machines, newBasicInfoMachine] })
              updateFormData("machineSelection", {
                ...formData.machineSelection,
                additionalMachines: [...formData.machineSelection.additionalMachines, machine],
                showAddMachineAfterStep2: true,
              })
            }}
            onMachineIndexChange={(index) => updateFormData("machineSelection", { ...formData.machineSelection, currentMachineIndex: index })}
            onSiteSummaryChange={(s) => setSiteSummary(s)}
            lockedSiteId={lockedSiteId}
          />
        )
      case 1:
        return productionAndPiles
      case 2:
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <PersonnelStep
              data={formData.personnel}
              onChange={(d) => updateFormData("personnel", d)}
              puantaj={formData.puantaj ?? []}
              onPuantajChange={(entries) => updateFormData("puantaj", entries)}
              siteId={formData.basicInfo.siteId}
              tarih={formData.basicInfo.date}
            />
            <VehiclesStep data={formData.vehicles} onChange={(d) => updateFormData("vehicles", d)} />
          </Box>
        )
      case 3:
        return (
          <FuelStep
            data={formData.fuel}
            onChange={(d) => updateFormData("fuel", d)}
            selectedMachine={formData.machineSelection.selectedMachine}
            additionalMachines={formData.machineSelection.additionalMachines}
            basicInfoMachines={formData.basicInfo.machines}
          />
        )
      case 4:
        return <ExpensesStep data={formData.expenses} onChange={(d) => updateFormData("expenses", d)} iqdPerUsd={siteSummary?.iqdPerUsd} />
      case 5:
        return <DailyInfoStep data={formData.dailyInfo} onChange={(d) => updateFormData("dailyInfo", d)} />
      case 6:
        return <ReviewStep data={formData} onSubmit={handleSubmit} siteSummary={siteSummary ?? undefined} />
      default:
        return null
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 2 }, minHeight: "100vh", background: "#fafafa", maxWidth: "100%", overflow: "hidden" }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 4 },
          borderRadius: 2,
          background: "#ffffff",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          border: "1px solid var(--icsp-nav-border)",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", mb: 2 }}>
          <LanguageSelector />
        </Box>
        <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, mb: 3 }}>
          {t("daily_work_report")}
        </Typography>
        {/* Masaüstü: tam stepper, mobil: adım X / Y göstergesi */}
        <Box sx={{ display: { xs: "none", sm: "block" }, mb: 4 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {stepsToUse.map((label) => (
              <Step key={label}>
                <StepLabel sx={{ "& .MuiStepLabel-label": { fontWeight: 500, fontSize: "0.85rem" }, "& .MuiStepIcon-root": { fontSize: "1.4rem" } }}>
                  {t(label)}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
        {/* Mobil adım göstergesi */}
        <Box sx={{ display: { xs: "block", sm: "none" }, mb: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "var(--icsp-lacivert)" }}>
              {t(stepsToUse[activeStep])}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {activeStep + 1} / {stepsToUse.length}
            </Typography>
          </Box>
          <Box sx={{ width: "100%", height: 6, borderRadius: 3, bgcolor: "#e0e0e0", overflow: "hidden" }}>
            <Box
              sx={{
                height: "100%",
                borderRadius: 3,
                bgcolor: "var(--icsp-lacivert)",
                width: `${((activeStep + 1) / stepsToUse.length) * 100}%`,
                transition: "width 0.3s ease",
              }}
            />
          </Box>
        </Box>
        <Box sx={{ minHeight: { xs: 200, sm: 400 }, mb: 4, p: { xs: 1, sm: 3 }, backgroundColor: "background.paper", borderRadius: 2, border: "1px solid #e0e0e0", width: "100%", maxWidth: "100%", boxSizing: "border-box", overflowX: "auto" }}>
          {renderStepContent(activeStep)}
        </Box>
        <Grid container spacing={2} sx={{ width: "100%" }}>
          <Grid size={{ xs: 6 }}>
            <Button fullWidth disabled={activeStep === 0} onClick={handleBack} variant="outlined" sx={{ py: 1.5, fontSize: { xs: 14, sm: 16 } }}>
              {t("previous")}
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            {activeStep < stepsToUse.length - 1 && (
              <Button fullWidth variant="contained" onClick={handleNext} sx={{ py: 1.5, fontSize: { xs: 14, sm: 16 } }}>
                {t("next")}
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>
      <Snackbar
        open={stepErrors.length > 0}
        autoHideDuration={8000}
        onClose={() => setStepErrors([])}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setStepErrors([])} sx={{ width: "100%", maxWidth: 560 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Eksik veya hatalı bilgi
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {stepErrors.map((msg, i) => (
              <Typography component="li" key={i} variant="body2">
                {msg}
              </Typography>
            ))}
          </Box>
        </Alert>
      </Snackbar>

      {/* Taslak bulundu — yükle / iptal */}
      <Dialog open={draftSnack.open} onClose={() => setDraftSnack({ open: false })} maxWidth="xs" fullWidth>
        <DialogTitle>Kaydedilmemiş Taslak Bulundu</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: "#64748b" }}>
            {draftSnack.savedAt
              ? `${new Date(draftSnack.savedAt).toLocaleString("tr-TR")} tarihinde otomatik kaydedilmiş bir form taslağı var.`
              : "Önceki oturumdan kaydedilmiş bir taslak var."}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: "#64748b" }}>
            Kaldığınız yerden devam etmek ister misiniz?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            clearDraft(siteIdForDraft)
            setDraftSnack({ open: false })
          }} sx={{ color: "#9e9e9e" }}>
            Hayır, Sil
          </Button>
          <Button variant="contained" onClick={() => {
            const draft = loadDraft<typeof formData>(siteIdForDraft)
            if (draft?.formData) {
              const sid =
                draft.formData.basicInfo.siteId ??
                (isRestricted && lockedSiteId != null ? lockedSiteId : initialSiteId) ??
                null
              setFormData({
                ...draft.formData,
                basicInfo: {
                  ...draft.formData.basicInfo,
                  siteId: sid,
                },
              })
              // Taslak tek makine içerebilir; şantiye makinelerini yeniden senkronize et
              setMachineReloadToken((n) => n + 1)
              setDraftRestoreSnack(true)
            }
            setDraftSnack({ open: false })
          }}>
            Evet, Devam Et
          </Button>
        </DialogActions>
      </Dialog>

      {/* Taslak yüklendi bilgisi */}
      <Snackbar
        open={draftRestoreSnack}
        autoHideDuration={3000}
        onClose={() => setDraftRestoreSnack(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setDraftRestoreSnack(false)}>
          Taslak yüklendi. Kaldığınız yerden devam edebilirsiniz.
        </Alert>
      </Snackbar>

      <Dialog open={showPrevDayPlannedDialog} onClose={() => setShowPrevDayPlannedDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Dün kaydettiğiniz bir sonraki gün planlanan işler</DialogTitle>
        <DialogContent>
          {prevDayPlannedText && (
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {prevDayPlannedText.split(/\r?\n/).filter((line) => line.trim()).map((line, i) => (
                <Typography component="li" key={i} sx={{ mb: 0.5 }}>{line.trim()}</Typography>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPrevDayPlannedDialog(false)} variant="contained">Tamam</Button>
        </DialogActions>
      </Dialog>

      {/* Adım 1: Kaydet onayı */}
      <Dialog open={showSaveConfirmDialog} onClose={() => !isSaving && setShowSaveConfirmDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Raporu Kaydet</DialogTitle>
        <DialogContent>
          <Typography>
            Raporu kaydetmek istiyor musunuz?
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Kaydettikten sonra e-posta göndermek isteyip istemediğiniz sorulacak.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowSaveConfirmDialog(false)} disabled={isSaving}>İptal</Button>
          <Button
            variant="contained"
            onClick={handleConfirmSave}
            disabled={isSaving}
            sx={{ background: "var(--icsp-lacivert)", minWidth: 120 }}
          >
            {isSaving ? <CircularProgress size={20} color="inherit" /> : "Evet, Kaydet"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Adım 2: E-posta gönder onayı */}
      <Dialog open={showEmailConfirmDialog} onClose={() => !isSendingEmail && setShowEmailConfirmDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>✅ Rapor Kaydedildi</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontWeight: 500, mb: 1 }}>
            Rapor başarıyla kaydedildi.
          </Typography>
          {savedRecipients.length > 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              E-posta alıcıları: <strong>{savedRecipients.join(", ")}</strong>
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Tanımlı e-posta alıcısı bulunamadı.
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            Raporu e-posta ile göndermek ister misiniz?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => { setShowEmailConfirmDialog(false); setSavedReportId(null) }}
            disabled={isSendingEmail}
          >
            Hayır, Gönderme
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmEmail}
            disabled={isSendingEmail || savedRecipients.length === 0}
            sx={{ background: "var(--icsp-lacivert)", minWidth: 140 }}
          >
            {isSendingEmail ? <CircularProgress size={20} color="inherit" /> : "Evet, E-posta Gönder"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
