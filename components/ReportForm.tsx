"use client"

import { useState, useEffect } from "react"
import { Container, Paper, Stepper, Step, StepLabel, Box, Button, Typography, Grid, Table, TableBody, TableCell, TableHead, TableRow, Alert, Snackbar } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"
import LanguageSelector from "@/components/language-selector"
import { useFormDraft, loadDraft, clearDraft } from "@/lib/use-form-draft"
import MachineSelectionStep from "@/components/steps/machine-selection-step"
import BasicInfoStep, { type SiteSummaryForForm } from "@/components/steps/basic-info-step"
import ProductionSummaryStep from "@/components/steps/production-summary-step"
import PileDetailsStep from "@/components/steps/pile-details-step"
import PersonnelStep from "@/components/steps/personnel-step"
import VehiclesStep from "@/components/steps/vehicles-step"
import FuelStep from "@/components/steps/fuel-step"
import ExpensesStep from "@/components/steps/expenses-step"
import DailyInfoStep from "@/components/steps/daily-info-step"
import ReviewStep from "@/components/steps/review-step"
import { type FormData, type Machine, initialFormData, AVAILABLE_MACHINES } from "@/types/form-data"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import CircularProgress from "@mui/material/CircularProgress"

const steps = [
  "machine_selection",
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

export default function ReportForm({ initialSiteId, initialSiteName, lockedSiteId }: ReportFormProps) {
  const isRestricted = lockedSiteId != null
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [showAddMachinePrompt, setShowAddMachinePrompt] = useState(false)
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

  useEffect(() => {
    if (initialSiteId != null && initialSiteName) {
      setFormData((prev) => ({
        ...prev,
        basicInfo: { ...prev.basicInfo, siteId: initialSiteId, siteName: initialSiteName, project: initialSiteName },
      }))
    }
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
          iqdPerUsd: iq,
        }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [formData.basicInfo.siteId, initialSiteId, lockedSiteId])

  // Şantiye seçilince İdari → Makineler kayıtlarından aktif makineleri al ve seçimi güncelle
  useEffect(() => {
    const siteId = formData.basicInfo?.siteId
    if (siteId == null || !siteId) {
      setReportMachineOptions(AVAILABLE_MACHINES)
      return
    }
    let cancelled = false
    fetch(`/api/idari/makineler?siteId=${siteId}&status=aktif`)
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { id: number; name: string; machine_type: string; marka?: string | null; model?: string | null; plaka_no?: string | null; seri_no?: string | null; status?: string | null; notlar?: string | null }[]) => {
        if (cancelled) return
        const fromDb: Machine[] = Array.isArray(list)
          ? list.map((m) => ({
              id: String(m.id),
              name: m.name,
              type: m.machine_type || "Kazık Makinesi",
              marka: m.marka ?? undefined,
              model: m.model ?? undefined,
              plaka_no: m.plaka_no ?? undefined,
              seri_no: m.seri_no ?? undefined,
              status: m.status ?? undefined,
              notlar: m.notlar ?? undefined,
            }))
          : []
        const options = fromDb.length > 0 ? fromDb : AVAILABLE_MACHINES
        setReportMachineOptions(options)
        const ids = options.map((m) => m.id)
        setFormData((prev) => {
          const current = prev.machineSelection.selectedMachine
          if (current && ids.includes(current.id)) return prev
          const machine = options[0]
          if (!machine) return prev
          const initialMachineData = { machineId: machine.id, machineName: machine.name, machineHours: "", usedFuel: "", totalProduction: "", pileCount: "", drilledPile: "", concretePile: "", changedDiamondCount: "", note: "" }
          const initialProductionSummary = { machineId: machine.id, machineName: machine.name, totalProduction: "", emptyBorehole: "", preBorehole: "", concretePoured: "", totalPileCount: "", dailyPileCount: "", totalCompletedPiles: "", remainingPiles: "", steelLoweredPiles: "" }
          const needInit = isRestricted && (prev.basicInfo.machines.length === 0 || prev.productionSummary.length === 0)
          return {
            ...prev,
            machineSelection: {
              ...prev.machineSelection,
              selectedMachine: machine,
              additionalMachines: prev.machineSelection.additionalMachines.filter((m) => ids.includes(m.id)),
            },
            ...(needInit
              ? {
                  basicInfo: { ...prev.basicInfo, machines: [initialMachineData] },
                  productionSummary: [initialProductionSummary],
                }
              : {}),
          }
        })
      })
      .catch(() => {
        if (!cancelled) setReportMachineOptions(AVAILABLE_MACHINES)
      })
    return () => {
      cancelled = true
    }
  }, [formData.basicInfo?.siteId, isRestricted])

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

  // Operatör girişleri varsa productionSummary ve pileDetails (kazık detayları) senkronize et (manager ve kullanıcı için)
  useEffect(() => {
    if (operatorEntriesForDate.length === 0) return
    const next = operatorEntriesForDate.map((e) => ({
      machineId: e.machine_id ?? "",
      machineName: e.machine_name ?? "",
      totalProduction: e.total_production ?? "",
      emptyBorehole: e.empty_borehole ?? "",
      preBorehole: e.pre_borehole ?? "",
      concretePoured: e.concrete_poured ?? "",
      dailyPileCount: e.daily_pile_count ?? "",
    }))
    const allPileDepths: Array<{ depth: string; onForaj: boolean; bosForaj: boolean }> = []
    for (const entry of operatorEntriesForDate) {
      const pd = entry.pile_depths
      const rows = Array.isArray(pd) ? pd : (typeof pd === "string" ? (() => { try { return JSON.parse(pd) } catch { return [] } })() : [])
      rows.forEach((r: any, i: number) => {
        const depth = r.depth != null ? String(r.depth) : ""
        if (!depth.trim()) return
        const parts: string[] = []
        if (r.onForaj) parts.push("Ön foraj")
        if (r.bosForaj) parts.push("Boş foraj")
        allPileDepths.push({
          depth,
          onForaj: !!r.onForaj,
          bosForaj: !!r.bosForaj,
        })
      })
    }
    setFormData((prev) => {
      let nextForm = prev
      if (prev.productionSummary.length !== next.length || !next.every((n, i) => prev.productionSummary[i]?.machineName === n.machineName && prev.productionSummary[i]?.concretePoured === n.concretePoured)) {
        nextForm = { ...nextForm, productionSummary: next }
      }
      if (allPileDepths.length > 0) {
        const fromOperator = allPileDepths.map((r, i) => ({
          pileNumber: i + 1,
          drilled: r.depth,
          notes: [r.onForaj && "Ön foraj", r.bosForaj && "Boş foraj"].filter(Boolean).join(", "),
          concretePoured: false,
        }))
        const current = prev.pileDetails || []
        const currentFilled = current.filter((p) => String(p.drilled ?? "").trim() || String(p.notes ?? "").trim()).length
        if (currentFilled === 0 && fromOperator.length > 0) {
          nextForm = { ...nextForm, pileDetails: fromOperator }
        }
      }
      return nextForm
    })
  }, [operatorEntriesForDate])

  const handleNext = () => {
    if (isRestricted) {
      if (activeStep === 0) {
        const sm = formData.machineSelection.selectedMachine
        if (sm && (formData.basicInfo.machines.length === 0 || formData.productionSummary.length === 0)) {
          const initialMachineData = { machineId: sm.id, machineName: sm.name, machineHours: "", totalProduction: "", pileCount: "", drilledPile: "", concretePile: "", changedDiamondCount: "", note: "" }
          const initialProductionSummary = { machineId: sm.id, machineName: sm.name, totalProduction: "", totalPileCount: "", dailyPileCount: "", totalCompletedPiles: "", remainingPiles: "", steelLoweredPiles: "", concretePoured: "", emptyBorehole: "", preBorehole: "" }
          updateFormData("basicInfo", { ...formData.basicInfo, machines: [initialMachineData] })
          updateFormData("productionSummary", [initialProductionSummary])
        }
        setActiveStep(1)
      } else {
        setActiveStep((prev) => prev + 1)
      }
      return
    }
    if (activeStep === 0 && formData.machineSelection.selectedMachine) {
      const initialMachineData = {
        machineId: formData.machineSelection.selectedMachine.id,
        machineName: formData.machineSelection.selectedMachine.name,
        machineHours: "",
        totalProduction: "",
        pileCount: "",
        drilledPile: "",
        concretePile: "",
      }
      const initialProductionSummary = {
        machineId: formData.machineSelection.selectedMachine.id,
        machineName: formData.machineSelection.selectedMachine.name,
        totalProduction: "",
        totalPileCount: "",
        dailyPileCount: "",
        totalCompletedPiles: "",
        remainingPiles: "",
        steelLoweredPiles: "",
        concretePoured: "",
      }
      updateFormData("basicInfo", { ...formData.basicInfo, machines: [initialMachineData] })
      updateFormData("productionSummary", [initialProductionSummary])
      setActiveStep(1)
    } else if (activeStep === 2) {
      setShowAddMachinePrompt(true)
    } else {
      setActiveStep((prev) => prev + 1)
    }
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
      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, skipEmail: true }),
      })
      const data = response.ok ? await response.json().catch(() => ({})) : null
      if (response.ok && data?.success) {
        // Başarılı kayıt: taslağı temizle
        clearDraftFn()
        clearDraft(siteIdForDraft)
        setSavedReportId(data.reportId ?? null)
        setSavedRecipients(Array.isArray(data.recipients) ? data.recipients : [])
        // Formu sıfırla
        setFormData(initialFormData)
        setActiveStep(0)
        // E-posta onay dialogunu göster
        setShowEmailConfirmDialog(true)
      } else {
        alert(data?.error || t("error_sending_report"))
      }
    } catch (error) {
      console.error("Error saving report:", error)
      alert(t("error_sending_report"))
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
      const response = await fetch("/api/send-report/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: savedReportId }),
      })
      const data = response.ok ? await response.json().catch(() => ({})) : null
      if (data?.emailSent) {
        alert(`E-posta gönderildi: ${(data.recipients ?? []).join(", ")}`)
      } else {
        alert(data?.error || data?.emailError || "E-posta gönderilemedi.")
      }
    } catch (error) {
      console.error("Error sending email:", error)
      alert("E-posta gönderilemedi.")
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
    if (isRestricted) {
      if (step === 0) {
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Paper sx={{ p: 2, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", border: "1px solid #2196f3" }}>
              <Typography variant="subtitle1" sx={{ color: "#1565c0", fontWeight: 600, mb: 1.5 }}>Şantiye, makine ve operatör (otomatik atandı)</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
                <Typography variant="body2"><strong>Şantiye:</strong> {formData.basicInfo.siteName || "—"}</Typography>
                <Typography variant="body2"><strong>Makine:</strong> {formData.machineSelection.selectedMachine?.name || "—"}</Typography>
                <Typography variant="body2"><strong>Operatör:</strong> {assignedOperatorNames.length ? assignedOperatorNames.join(", ") : "—"}</Typography>
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
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Kazık Detayları – Makine Detayları (Operatör girişi)</Typography>
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
                <Alert severity="warning">Operatör giriş yapmamıştır. Lütfen operatörün makine bilgilerini girmesini bekleyin veya raporu yine de kaydedebilirsiniz.</Alert>
              )}
            </Paper>
            <PileDetailsStep
              data={formData.pileDetails}
              onChange={(d) => updateFormData("pileDetails", d)}
              productionSummary={formData.productionSummary}
              projectTotalPiles={projectTotalPiles}
              totalCompletedBeforeToday={totalCompletedBeforeToday}
            />
          </Box>
        )
      }
      switch (step) {
        case 1: return (
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
        case 2: return (
          <FuelStep
            data={formData.fuel}
            onChange={(d) => updateFormData("fuel", d)}
            selectedMachine={formData.machineSelection.selectedMachine}
            additionalMachines={formData.machineSelection.additionalMachines}
            basicInfoMachines={formData.basicInfo.machines}
          />
        )
        case 3: return <ExpensesStep data={formData.expenses} onChange={(d) => updateFormData("expenses", d)} iqdPerUsd={siteSummary?.iqdPerUsd} />
        case 4: return <DailyInfoStep data={formData.dailyInfo} onChange={(d) => updateFormData("dailyInfo", d)} />
        case 5: return <ReviewStep data={formData} onSubmit={handleSubmit} siteSummary={siteSummary ?? undefined} />
        default: return null
      }
    }
    switch (step) {
      case 0:
        return (
          <MachineSelectionStep
            data={formData.machineSelection}
            onChange={(d) => updateFormData("machineSelection", d)}
            machines={formData.basicInfo.siteId ? reportMachineOptions : undefined}
          />
        )
      case 1:
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <BasicInfoStep
              data={formData.basicInfo}
              onChange={(d) => updateFormData("basicInfo", d)}
              currentMachineIndex={formData.machineSelection.currentMachineIndex}
              currentMachine={formData.basicInfo.machines[formData.machineSelection.currentMachineIndex] || null}
              allMachines={formData.basicInfo.machines}
              onMachineChange={(machineData) => {
                const updatedMachines = [...formData.basicInfo.machines]
                updatedMachines[formData.machineSelection.currentMachineIndex] = machineData
                updateFormData("basicInfo", { ...formData.basicInfo, machines: updatedMachines })
              }}
              onAddMachine={(machine) => {
                const newProductionSummary = { machineId: machine.id, machineName: machine.name, totalProduction: "", emptyBorehole: "", preBorehole: "", concretePoured: "" }
                const newBasicInfoMachine = { machineId: machine.id, machineName: machine.name, machineHours: "", usedFuel: "", changedDiamondCount: "", note: "" }
                updateFormData("productionSummary", [...formData.productionSummary, newProductionSummary])
                updateFormData("basicInfo", { ...formData.basicInfo, machines: [...formData.basicInfo.machines, newBasicInfoMachine] })
                updateFormData("machineSelection", { ...formData.machineSelection, additionalMachines: [...formData.machineSelection.additionalMachines, machine], showAddMachineAfterStep2: true })
              }}
              onMachineIndexChange={(index) => updateFormData("machineSelection", { ...formData.machineSelection, currentMachineIndex: index })}
              onSiteSummaryChange={(s) => setSiteSummary(s)}
              lockedSiteId={lockedSiteId}
            />
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Kazık Detayları – Makine Detayları (Operatör girişi)</Typography>
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
                <Alert severity="info">Bu şantiye ve tarih için henüz operatör girişi yok. Operatör makine girişi yaptığında burada görünecektir.</Alert>
              )}
            </Paper>
          </Box>
        )
      case 2: {
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <ProductionSummaryStep
              data={formData.productionSummary}
              onChange={(d) => updateFormData("productionSummary", d)}
              currentMachineIndex={formData.machineSelection.currentMachineIndex}
              additionalMachines={formData.machineSelection.additionalMachines}
              onAddMachine={(machine) => {
                const newProductionSummary = { machineId: machine.id, machineName: machine.name, totalProduction: "", emptyBorehole: "", preBorehole: "", concretePoured: "" }
                const newBasicInfoMachine = { machineId: machine.id, machineName: machine.name, machineHours: "", usedFuel: "", changedDiamondCount: "", note: "" }
                updateFormData("productionSummary", [...formData.productionSummary, newProductionSummary])
                updateFormData("basicInfo", { ...formData.basicInfo, machines: [...formData.basicInfo.machines, newBasicInfoMachine] })
                updateFormData("machineSelection", { ...formData.machineSelection, additionalMachines: [...formData.machineSelection.additionalMachines, machine], showAddMachineAfterStep2: true })
              }}
              onMachineIndexChange={(index) => updateFormData("machineSelection", { ...formData.machineSelection, currentMachineIndex: index })}
            />
            <PileDetailsStep
              data={formData.pileDetails}
              onChange={(d) => updateFormData("pileDetails", d)}
              productionSummary={formData.productionSummary}
              projectTotalPiles={projectTotalPiles}
              totalCompletedBeforeToday={totalCompletedBeforeToday}
            />
          </Box>
        )
      }
      case 3:
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
      case 4:
        return (
          <FuelStep
            data={formData.fuel}
            onChange={(d) => updateFormData("fuel", d)}
            selectedMachine={formData.machineSelection.selectedMachine}
            additionalMachines={formData.machineSelection.additionalMachines}
            basicInfoMachines={formData.basicInfo.machines}
          />
        )
      case 5:
        return <ExpensesStep data={formData.expenses} onChange={(d) => updateFormData("expenses", d)} iqdPerUsd={siteSummary?.iqdPerUsd} />
      case 6:
        return <DailyInfoStep data={formData.dailyInfo} onChange={(d) => updateFormData("dailyInfo", d)} />
      case 7:
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
      <Dialog open={showAddMachinePrompt} onClose={() => setShowAddMachinePrompt(false)}>
        <DialogTitle>{t("add_machine_prompt_title")}</DialogTitle>
        <DialogContent>
          <Typography>{t("add_machine_prompt_message")}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowAddMachinePrompt(false); setActiveStep(3) }} color="primary" variant="contained">{t("no_continue")}</Button>
          <Button onClick={() => { setShowAddMachinePrompt(false); setActiveStep(0) }} color="secondary" variant="outlined">{t("yes_add_machine")}</Button>
        </DialogActions>
      </Dialog>

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
              setFormData(draft.formData)
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
