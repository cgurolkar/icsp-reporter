"use client"

import type React from "react"
import { Fragment, useMemo, useState } from "react"
import {
  TextField,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material"
import { Add } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { MachineProductionSummary, Machine } from "@/types/form-data"

interface ProductionSummaryStepProps {
  data: MachineProductionSummary[]
  onChange: (data: MachineProductionSummary[]) => void
  siteConcretePouredPiles: string
  onSiteConcreteChange: (value: string) => void
  /** Beton dökülen kazık toplam boyu (m) */
  siteConcreteTotalLength?: string
  onSiteConcreteTotalLengthChange?: (value: string) => void
  /** Kazık detaylarından hesaplanan beton dökülen delinen toplamı (doğrulama) */
  pileDetailsConcreteMeters?: number | null
  /** Makine ekleme listesi (şantiye + yedek); boşsa ekleme gösterilmez */
  machinesAvailableToAdd?: Machine[]
  onAddMachine?: (machine: Machine) => void
  projectTotalPiles?: number
  totalCompletedBeforeToday?: number
}

function parseNum(s: string | undefined): number {
  const n = parseFloat(String(s ?? "").trim().replace(",", "."))
  return Number.isFinite(n) ? n : NaN
}

function parseIntSafe(s: string | undefined): number {
  const n = parseInt(String(s ?? "").trim(), 10)
  return Number.isFinite(n) ? n : NaN
}

export default function ProductionSummaryStep({
  data,
  onChange,
  siteConcretePouredPiles,
  onSiteConcreteChange,
  siteConcreteTotalLength = "",
  onSiteConcreteTotalLengthChange,
  pileDetailsConcreteMeters = null,
  machinesAvailableToAdd = [],
  onAddMachine,
  projectTotalPiles,
  totalCompletedBeforeToday = 0,
}: ProductionSummaryStepProps) {
  const { t } = useLanguage()
  const [showAddMachineDialog, setShowAddMachineDialog] = useState(false)
  const [selectedMachineId, setSelectedMachineId] = useState("")

  const totalDrilled = useMemo(
    () => data.reduce((s, m) => s + (parseIntSafe(m.dailyDrilledPiles) || 0), 0),
    [data],
  )
  const totalImalatM = useMemo(
    () => data.reduce((s, m) => s + (parseNum(m.totalProduction) || 0), 0),
    [data],
  )
  const totalEmpty = useMemo(
    () => data.reduce((s, m) => s + (parseIntSafe(m.emptyBorehole) || 0), 0),
    [data],
  )
  const totalPre = useMemo(
    () => data.reduce((s, m) => s + (parseIntSafe(m.preBorehole) || 0), 0),
    [data],
  )

  const betonBugun = parseIntSafe(siteConcretePouredPiles) || 0
  const toplamBoyNum = parseNum(siteConcreteTotalLength) || 0
  const pileMeters = pileDetailsConcreteMeters != null ? pileDetailsConcreteMeters : null
  const boyMismatch =
    pileMeters != null &&
    (betonBugun > 0 || pileMeters > 0) &&
    Math.abs(toplamBoyNum - pileMeters) > 0.01
  const kalanKazik =
    projectTotalPiles != null && Number.isFinite(projectTotalPiles)
      ? Math.max(0, projectTotalPiles - totalCompletedBeforeToday - betonBugun)
      : null

  const handleField =
    (machineIndex: number, field: keyof MachineProductionSummary) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const v = event.target.value
      const next = data.map((row, i) => (i === machineIndex ? { ...row, [field]: v } : row))
      onChange(next)
    }

  const addable = machinesAvailableToAdd.filter(
    (m) => !data.some((row) => String(row.machineId) === String(m.id)),
  )

  const handleAddMachine = () => {
    const machine = addable.find((m) => m.id === selectedMachineId)
    if (machine && onAddMachine) {
      onAddMachine(machine)
      setSelectedMachineId("")
      setShowAddMachineDialog(false)
    }
  }

  const machineTitle = data.map((m) => m.machineName).filter(Boolean).join(" · ") || t("no_machine_selected")

  if (data.length === 0) {
    return (
      <Box>
        <Alert severity="error">{t("no_machine_info")}</Alert>
      </Box>
    )
  }

  const rowDefs: { key: keyof MachineProductionSummary; label: string; helper?: string }[] = [
    { key: "dailyDrilledPiles", label: "O gün yapılan kazık sayısı (delgi, Ad.)" },
    { key: "totalProduction", label: t("total_production") },
    { key: "preBorehole", label: t("pre_borehole") },
    { key: "emptyBorehole", label: t("empty_borehole") },
  ]

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: "info.main", fontWeight: 600, mb: 2 }}>
        {t("production_summary")}
        {data.length > 1 ? ` — ${data.length} makine` : machineTitle ? ` — ${machineTitle}` : ""}
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Üretim değerleri operatör girişinden bağımsızdır. Makinede çalışma olmadıysa ilgili alanlara <strong>0</strong> yazın.
        {data.length > 1 ? " Şantiyedeki her makine için ayrı giriş yapın." : ""}
      </Alert>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {data.map((m, colIdx) => (
          <Paper
            key={m.machineId}
            sx={{ p: 2, background: "linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)", border: "1px solid #03a9f4" }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                mb: 2,
                py: 1,
                px: 1.5,
                backgroundColor: "rgba(255,255,255,0.9)",
                borderRadius: 1,
                border: "1px solid #0288d1",
                color: "#01579b",
              }}
            >
              {m.machineName || `Makine ${colIdx + 1}`}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "minmax(200px, 1fr) minmax(160px, 1fr)" },
                gap: 1.5,
                alignItems: "center",
              }}
            >
              {rowDefs.map((row) => (
                <Fragment key={`${String(row.key)}-${m.machineId}`}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.label}
                  </Typography>
                  <TextField
                    size="small"
                    fullWidth
                    value={String(m[row.key] ?? "")}
                    onChange={handleField(colIdx, row.key)}
                    type={row.key === "totalProduction" ? "text" : "number"}
                    inputProps={row.key === "totalProduction" ? { inputMode: "decimal" } : { min: 0 }}
                    sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "white" } }}
                  />
                </Fragment>
              ))}
            </Box>
          </Paper>
        ))}
      </Box>

      <Paper sx={{ p: 2, mt: 2, background: "linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)", border: "1px solid #03a9f4" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            maxWidth: 720,
          }}
        >
          <TextField
            fullWidth
            label="Beton dökülen kazık (Ad.) — şantiye toplamı"
            type="number"
            value={siteConcretePouredPiles}
            onChange={(e) => onSiteConcreteChange(e.target.value)}
            helperText="Tüm makinelerin o gün döktüğü betonlu kazık adedinin toplamıdır."
            sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "white" } }}
          />
          <TextField
            fullWidth
            label="Toplam boy (m) — beton dökülen"
            type="text"
            inputProps={{ inputMode: "decimal" }}
            value={siteConcreteTotalLength}
            onChange={(e) => onSiteConcreteTotalLengthChange?.(e.target.value)}
            helperText="Kazık detayında «Beton döküldü» işaretli satırların Delinen (m) toplamı ile aynı olmalıdır."
            error={boyMismatch}
            sx={{ "& .MuiOutlinedInput-root": { backgroundColor: "white" } }}
          />
        </Box>
        {boyMismatch && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            Toplam boy ({toplamBoyNum.toFixed(2)} m) ile kazık detayındaki beton dökülen delinen toplamı (
            {pileMeters!.toFixed(2)} m) uyuşmuyor. Değerler eşit olmalıdır.
          </Alert>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" sx={{ color: "info.main", fontWeight: 600, mb: 1 }}>
            {t("preview")}:
          </Typography>
          <Table size="small" sx={{ border: "2px solid #000", backgroundColor: "white", minWidth: 400 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#e3f2fd" }}>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold" }} />
                {data.map((m) => (
                  <TableCell key={m.machineId} sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                    {m.machineName}
                  </TableCell>
                ))}
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", textAlign: "center" }}>
                  Toplam / şantiye
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  O gün yapılan kazık (delgi, Ad.)
                </TableCell>
                {data.map((m) => (
                  <TableCell key={m.machineId} sx={{ border: "1px solid #000", textAlign: "center" }}>
                    {m.dailyDrilledPiles ?? ""}
                  </TableCell>
                ))}
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{totalDrilled}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  {t("total_production")}
                </TableCell>
                {data.map((m) => (
                  <TableCell key={m.machineId} sx={{ border: "1px solid #000", textAlign: "center" }}>
                    {m.totalProduction}
                  </TableCell>
                ))}
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>
                  {totalImalatM.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  {t("pre_borehole")}
                </TableCell>
                {data.map((m) => (
                  <TableCell key={m.machineId} sx={{ border: "1px solid #000", textAlign: "center" }}>
                    {m.preBorehole}
                  </TableCell>
                ))}
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{totalPre}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  {t("empty_borehole")}
                </TableCell>
                {data.map((m) => (
                  <TableCell key={m.machineId} sx={{ border: "1px solid #000", textAlign: "center" }}>
                    {m.emptyBorehole}
                  </TableCell>
                ))}
                <TableCell sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}>{totalEmpty}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  {t("total_concrete_piles")}
                </TableCell>
                <TableCell
                  colSpan={Math.max(1, data.length + 1)}
                  sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}
                >
                  {siteConcretePouredPiles || "—"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ border: "1px solid #000", fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                  Toplam boy — beton dökülen (m)
                </TableCell>
                <TableCell
                  colSpan={Math.max(1, data.length + 1)}
                  sx={{ border: "1px solid #000", textAlign: "center", fontWeight: "bold" }}
                >
                  {siteConcreteTotalLength || "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>

        {onAddMachine && addable.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Button startIcon={<Add />} variant="outlined" size="small" onClick={() => setShowAddMachineDialog(true)}>
              {t("add_extra_machine")}
            </Button>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2, mt: 3, background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)", border: "1px solid #43a047" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5, color: "#1b5e20" }}>
          Özet bilgiler
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 1.5 }}>
          <TextField
            size="small"
            label="Toplam kazık (proje)"
            value={projectTotalPiles != null ? projectTotalPiles : "—"}
            InputProps={{ readOnly: true }}
          />
          <TextField size="small" label="O gün beton dökülen kazık (Ad.)" value={betonBugun} InputProps={{ readOnly: true }} />
          <TextField
            size="small"
            label="Toplam boy — beton dökülen (m)"
            value={toplamBoyNum > 0 ? toplamBoyNum.toFixed(2) : siteConcreteTotalLength || "—"}
            InputProps={{ readOnly: true }}
          />
          <TextField size="small" label="O gün delgisi biten kazık (Ad., toplam)" value={totalDrilled} InputProps={{ readOnly: true }} />
          <TextField
            size="small"
            label="Kalan kazık sayısı (tahmini)"
            value={kalanKazik != null ? kalanKazik : "—"}
            InputProps={{ readOnly: true }}
          />
          <TextField size="small" label="Toplam imalat (m)" value={totalImalatM.toFixed(2)} InputProps={{ readOnly: true }} />
        </Box>
      </Paper>

      <Dialog open={showAddMachineDialog} onClose={() => setShowAddMachineDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t("add_extra_machine")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t("select_extra_machine")}
          </Typography>
          <FormControl fullWidth>
            <InputLabel>{t("select_machine")}</InputLabel>
            <Select
              value={selectedMachineId}
              label={t("select_machine")}
              onChange={(e) => setSelectedMachineId(e.target.value)}
            >
              {addable.map((machine) => (
                <MenuItem key={machine.id} value={machine.id}>
                  {machine.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddMachineDialog(false)}>{t("cancel")}</Button>
          <Button onClick={handleAddMachine} variant="contained" disabled={!selectedMachineId}>
            {t("add")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
