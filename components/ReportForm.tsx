"use client"

import { useState, useEffect } from "react"
import { Container, Paper, Stepper, Step, StepLabel, Box, Button, Typography, Grid, Table, TableBody, TableCell, TableHead, TableRow, Alert } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"
import LanguageSelector from "@/components/language-selector"
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
import IronStepComponent from "@/components/steps/iron-step"
import { type FormData, initialFormData, AVAILABLE_MACHINES } from "@/types/form-data"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"

const steps = [
  "machine_selection",
  "basic_info",
  "production_summary",
  "iron_step",
  "personnel_vehicles",
  "fuel",
  "expenses",
  "daily_info",
  "review",
]

const stepsRestricted = [
  "info_and_entry",
  "iron_step",
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
  }
  const [operatorEntriesForDate, setOperatorEntriesForDate] = useState<OperatorEntryRow[]>([])
  const { t } = useLanguage()
  const stepsToUse = isRestricted ? stepsRestricted : steps

  useEffect(() => {
    if (initialSiteId != null && initialSiteName) {
      setFormData((prev) => ({
        ...prev,
        basicInfo: { ...prev.basicInfo, siteId: initialSiteId, siteName: initialSiteName, project: initialSiteName },
      }))
    }
  }, [initialSiteId, initialSiteName])

  // Şantiye seçilince atanmış makineyi otomatik seç (admin panelde şantiye–makine ataması yapıldıysa)
  useEffect(() => {
    const siteId = formData.basicInfo?.siteId
    if (siteId == null || !siteId) return
    let cancelled = false
    fetch(`/api/sites/${siteId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((site: { assigned_machine_ids?: string[] } | null) => {
        if (cancelled || !site?.assigned_machine_ids?.length) return
        const ids = site.assigned_machine_ids as string[]
        const firstId = ids[0]
        const machine = AVAILABLE_MACHINES.find((m) => m.id === firstId)
        if (!machine) return
        setFormData((prev) => {
          const current = prev.machineSelection.selectedMachine
          if (current && ids.includes(current.id)) return prev
          const initialMachineData = { machineId: machine.id, machineName: machine.name, machineHours: "", totalProduction: "", pileCount: "", drilledPile: "", concretePile: "", changedDiamondCount: "", note: "" }
          const initialProductionSummary = { machineId: machine.id, machineName: machine.name, totalProduction: "", emptyBorehole: "", preBorehole: "", concretePoured: "", totalPileCount: "", dailyPileCount: "", totalCompletedPiles: "", remainingPiles: "", steelLoweredPiles: "" }
          const needInit = isRestricted && (prev.basicInfo.machines.length === 0 || prev.productionSummary.length === 0)
          return {
            ...prev,
            machineSelection: {
              ...prev.machineSelection,
              selectedMachine: machine,
              additionalMachines: prev.machineSelection.additionalMachines.filter((m) => ids.includes(m.id)),
            },
            ...(needInit ? {
              basicInfo: { ...prev.basicInfo, machines: [initialMachineData] },
              productionSummary: [initialProductionSummary],
            } : {}),
          }
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
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

  // Kullanıcı/Personel: seçili şantiye + tarih için operatör girişlerini al (Makine Detayları read-only)
  useEffect(() => {
    if (!isRestricted) return
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
  }, [isRestricted, formData.basicInfo?.siteId, formData.basicInfo?.date])

  // Operatör girişleri varsa productionSummary'i senkronize et (kayıt ve PileDetailsStep toplamları için)
  useEffect(() => {
    if (!isRestricted || operatorEntriesForDate.length === 0) return
    const next = operatorEntriesForDate.map((e) => ({
      machineId: e.machine_id ?? "",
      machineName: e.machine_name ?? "",
      totalProduction: e.total_production ?? "",
      emptyBorehole: e.empty_borehole ?? "",
      preBorehole: e.pre_borehole ?? "",
      concretePoured: e.concrete_poured ?? "",
      dailyPileCount: e.daily_pile_count ?? "",
    }))
    setFormData((prev) => {
      if (prev.productionSummary.length === next.length && next.every((n, i) => prev.productionSummary[i]?.machineName === n.machineName && prev.productionSummary[i]?.concretePoured === n.concretePoured)) return prev
      return { ...prev, productionSummary: next }
    })
  }, [isRestricted, operatorEntriesForDate])

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

  const handleSubmit = async () => {
    try {
      const response = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })
      const data = response.ok ? await response.json().catch(() => ({})) : null
      if (response.ok) {
        let message = "Kaydedildi. PDF oluşturuldu ve e-posta gönderildi."
        if (data?.emailSent && data?.recipients?.length) {
          message += `\nE-posta gönderildi: ${data.recipients.join(", ")}`
        } else if (data?.recipients?.length && !data?.emailSent) {
          if (data?.emailError) {
            message = "Kaydedildi. PDF oluşturuldu. E-posta gönderilemedi: " + data.emailError
          } else {
            message = "Kaydedildi. PDF oluşturuldu. E-posta listesi tanımlı değil."
          }
        }
        alert(message)
        setFormData(initialFormData)
        setActiveStep(0)
      } else {
        alert(t("error_sending_report"))
      }
    } catch (error) {
      console.error("Error sending report:", error)
      alert(t("error_sending_report"))
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
                <Table size="small" sx={{ minWidth: 600 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Makine</strong></TableCell>
                      <TableCell><strong>Operatör</strong></TableCell>
                      <TableCell><strong>Makine Saati</strong></TableCell>
                      <TableCell><strong>Mazot</strong></TableCell>
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
                        <TableCell>{row.machine_hours ?? "—"}</TableCell>
                        <TableCell>{row.used_fuel ?? "—"}</TableCell>
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
        case 1: return <IronStepComponent data={formData.iron} onChange={(d) => updateFormData("iron", d)} />
        case 2: return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <PersonnelStep data={formData.personnel} onChange={(d) => updateFormData("personnel", d)} />
            <VehiclesStep data={formData.vehicles} onChange={(d) => updateFormData("vehicles", d)} />
          </Box>
        )
        case 3: return (
          <FuelStep
            data={formData.fuel}
            onChange={(d) => updateFormData("fuel", d)}
            selectedMachine={formData.machineSelection.selectedMachine}
            additionalMachines={formData.machineSelection.additionalMachines}
            basicInfoMachines={formData.basicInfo.machines}
          />
        )
        case 4: return <ExpensesStep data={formData.expenses} onChange={(d) => updateFormData("expenses", d)} />
        case 5: return <DailyInfoStep data={formData.dailyInfo} onChange={(d) => updateFormData("dailyInfo", d)} />
        case 6: return <ReviewStep data={formData} onSubmit={handleSubmit} siteSummary={siteSummary ?? undefined} />
        default: return null
      }
    }
    switch (step) {
      case 0:
        return <MachineSelectionStep data={formData.machineSelection} onChange={(d) => updateFormData("machineSelection", d)} />
      case 1:
        return (
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
        return <IronStepComponent data={formData.iron} onChange={(d) => updateFormData("iron", d)} />
      case 4:
        return (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <PersonnelStep data={formData.personnel} onChange={(d) => updateFormData("personnel", d)} />
            <VehiclesStep data={formData.vehicles} onChange={(d) => updateFormData("vehicles", d)} />
          </Box>
        )
      case 5:
        return (
          <FuelStep
            data={formData.fuel}
            onChange={(d) => updateFormData("fuel", d)}
            selectedMachine={formData.machineSelection.selectedMachine}
            additionalMachines={formData.machineSelection.additionalMachines}
            basicInfoMachines={formData.basicInfo.machines}
          />
        )
      case 6:
        return <ExpensesStep data={formData.expenses} onChange={(d) => updateFormData("expenses", d)} />
      case 7:
        return <DailyInfoStep data={formData.dailyInfo} onChange={(d) => updateFormData("dailyInfo", d)} />
      case 8:
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
        <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
          {stepsToUse.map((label) => (
            <Step key={label}>
              <StepLabel sx={{ "& .MuiStepLabel-label": { fontWeight: 500, fontSize: { xs: "0.8rem", sm: "0.9rem" } }, "& .MuiStepIcon-root": { fontSize: { xs: "1.1rem", sm: "1.5rem" } } }}>
                {t(label)}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
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
    </Container>
  )
}
