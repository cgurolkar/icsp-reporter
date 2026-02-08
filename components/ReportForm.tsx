"use client"

import { useState, useEffect } from "react"
import { Container, Paper, Stepper, Step, StepLabel, Box, Button, Typography, Grid } from "@mui/material"
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
import ReviewStep from "@/components/steps/review-step"
import IronStepComponent from "@/components/steps/iron-step"
import { type FormData, initialFormData } from "@/types/form-data"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"

const steps = [
  "machine_selection",
  "basic_info",
  "production_summary",
  "pile_details",
  "iron_step",
  "personnel",
  "vehicles",
  "fuel",
  "expenses",
  "review",
]

export interface ReportFormProps {
  initialSiteId?: number
  initialSiteName?: string
}

export default function ReportForm({ initialSiteId, initialSiteName }: ReportFormProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [showAddMachinePrompt, setShowAddMachinePrompt] = useState(false)
  const [siteSummary, setSiteSummary] = useState<SiteSummaryForForm | null>(null)
  const { t } = useLanguage()

  useEffect(() => {
    if (initialSiteId != null && initialSiteName) {
      setFormData((prev) => ({
        ...prev,
        basicInfo: { ...prev.basicInfo, siteId: initialSiteId, siteName: initialSiteName, project: initialSiteName },
      }))
    }
  }, [initialSiteId, initialSiteName])

  const handleNext = () => {
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
    } else if (activeStep === 3 && formData.machineSelection.showAddMachineAfterStep2) {
      const hasAdditionalMachines = formData.machineSelection.additionalMachines.length > 0
      if (hasAdditionalMachines) {
        setActiveStep(1)
        const nextMachineIndex = formData.machineSelection.currentMachineIndex + 1
        updateFormData("machineSelection", {
          ...formData.machineSelection,
          currentMachineIndex: nextMachineIndex,
          showAddMachineAfterStep2: false,
        })
      } else {
        setActiveStep((prev) => prev + 1)
      }
    } else {
      setActiveStep((prev) => prev + 1)
    }
  }

  const handleBack = () => setActiveStep((prev) => prev - 1)

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

  const renderStepContent = (step: number) => {
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
            onMachineChange={(machineData) => {
              const updatedMachines = [...formData.basicInfo.machines]
              updatedMachines[formData.machineSelection.currentMachineIndex] = machineData
              updateFormData("basicInfo", { ...formData.basicInfo, machines: updatedMachines })
            }}
            allMachines={formData.basicInfo.machines}
            onAddMachine={(machine) => {
              const newProductionSummary = { machineId: machine.id, machineName: machine.name, totalProduction: "", emptyBorehole: "", preBorehole: "", concretePoured: "" }
              const newBasicInfoMachine = { machineId: machine.id, machineName: machine.name, machineHours: "", usedFuel: "", changedDiamondCount: "", note: "" }
              updateFormData("productionSummary", [...formData.productionSummary, newProductionSummary])
              updateFormData("basicInfo", { ...formData.basicInfo, machines: [...formData.basicInfo.machines, newBasicInfoMachine] })
              updateFormData("machineSelection", { ...formData.machineSelection, additionalMachines: [...formData.machineSelection.additionalMachines, machine], showAddMachineAfterStep2: true })
            }}
            onMachineIndexChange={(index) => updateFormData("machineSelection", { ...formData.machineSelection, currentMachineIndex: index })}
            onSiteSummaryChange={(s) => setSiteSummary(s)}
          />
        )
      case 2:
        return (
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
        )
      case 3: {
        const projectTotalPiles = siteSummary?.totalPiles ?? undefined
        const remainingValid = siteSummary?.remainingPiles != null && String(siteSummary.remainingPiles).trim() !== ""
        const totalCompletedBeforeToday =
          siteSummary?.totalPiles != null && remainingValid
            ? siteSummary.totalPiles - (parseInt(siteSummary.remainingPiles!, 10) || 0)
            : (siteSummary?.initialPilesDone != null ? siteSummary.initialPilesDone : 0)
        return (
          <PileDetailsStep
            data={formData.pileDetails}
            onChange={(d) => updateFormData("pileDetails", d)}
            productionSummary={formData.productionSummary}
            projectTotalPiles={projectTotalPiles}
            totalCompletedBeforeToday={totalCompletedBeforeToday}
          />
        )
      }
      case 4:
        return <IronStepComponent data={formData.iron} onChange={(d) => updateFormData("iron", d)} />
      case 5:
        return <PersonnelStep data={formData.personnel} onChange={(d) => updateFormData("personnel", d)} />
      case 6:
        return <VehiclesStep data={formData.vehicles} onChange={(d) => updateFormData("vehicles", d)} />
      case 7:
        return (
          <FuelStep
            data={formData.fuel}
            onChange={(d) => updateFormData("fuel", d)}
            selectedMachine={formData.machineSelection.selectedMachine}
            additionalMachines={formData.machineSelection.additionalMachines}
          />
        )
      case 8:
        return <ExpensesStep data={formData.expenses} onChange={(d) => updateFormData("expenses", d)} />
      case 9:
        return <ReviewStep data={formData} onSubmit={handleSubmit} siteSummary={siteSummary ?? undefined} />
      default:
        return null
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 }, minHeight: "100vh", background: "#fafafa" }}>
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
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel sx={{ "& .MuiStepLabel-label": { fontWeight: 500, fontSize: { xs: "0.8rem", sm: "0.9rem" } }, "& .MuiStepIcon-root": { fontSize: { xs: "1.1rem", sm: "1.5rem" } } }}>
                {t(label)}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
        <Box sx={{ minHeight: { xs: 200, sm: 400 }, mb: 4, p: { xs: 1, sm: 3 }, backgroundColor: "background.paper", borderRadius: 2, border: "1px solid #e0e0e0", width: "100%", boxSizing: "border-box" }}>
          {renderStepContent(activeStep)}
        </Box>
        <Grid container spacing={2} sx={{ width: "100%" }}>
          <Grid size={{ xs: 6 }}>
            <Button fullWidth disabled={activeStep === 0} onClick={handleBack} variant="outlined" sx={{ py: 1.5, fontSize: { xs: 14, sm: 16 } }}>
              {t("previous")}
            </Button>
          </Grid>
          <Grid size={{ xs: 6 }}>
            {activeStep < steps.length - 1 && (
              <Button fullWidth variant="contained" onClick={handleNext} sx={{ py: 1.5, fontSize: { xs: 14, sm: 16 } }}>
                {t("next")}
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>
      <Dialog open={showAddMachinePrompt} onClose={() => setShowAddMachinePrompt(false)}>
        <DialogTitle>Başka makine eklemek istiyor musunuz?</DialogTitle>
        <DialogContent>
          <Typography>Birden fazla makine için ayrı ayrı veri girebilirsiniz. Ek makine eklemek ister misiniz?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowAddMachinePrompt(false); setActiveStep(3) }} color="primary" variant="contained">Hayır, devam et</Button>
          <Button onClick={() => { setShowAddMachinePrompt(false); setActiveStep(0) }} color="secondary" variant="outlined">Evet, makine ekle</Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}
