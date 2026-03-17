"use client"

import { useState, useEffect, useRef } from "react"
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormControlLabel,
  Checkbox,
} from "@mui/material"
import { Save, PhotoCamera, Add, Delete } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { AVAILABLE_MACHINES } from "@/types/form-data"

const MAX_IMAGE_SIZE_MB = 5
const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp"

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

interface SiteOption {
  id: number
  name: string
  code: string
  assigned_machine_ids?: string[]
}

export default function OperatorFormPage() {
  const { user } = useAuth()
  const router = useRouter()
  const role = (user?.role ?? "").toLowerCase()
  const isOperator = role === "operator"
  const [sites, setSites] = useState<SiteOption[]>([])
  const [siteId, setSiteId] = useState<number | "">(user?.siteId ?? "")
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split("T")[0])
  const [machineId, setMachineId] = useState("")
  const [startTime, setStartTime] = useState("")
  const [machineHours, setMachineHours] = useState("")
  const [endTime, setEndTime] = useState("")
  const [pileDepths, setPileDepths] = useState<{ depth: string; onForaj: boolean; bosForaj: boolean }[]>([{ depth: "", onForaj: false, bosForaj: false }])
  const [usedFuel, setUsedFuel] = useState("")
  const [elmasMiktar, setElmasMiktar] = useState("")
  const [elmasDegisimYok, setElmasDegisimYok] = useState(false)
  const [bentonitMiktar, setBentonitMiktar] = useState("")
  const [workDone, setWorkDone] = useState("")
  const [note, setNote] = useState("")
  const [dailyPileCount, setDailyPileCount] = useState("")
  const [totalProduction, setTotalProduction] = useState("")
  const [emptyBorehole, setEmptyBorehole] = useState("")
  const [preBorehole, setPreBorehole] = useState("")
  const [concretePoured, setConcretePoured] = useState("")
  const [image1, setImage1] = useState("")
  const [image2, setImage2] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const input1Ref = useRef<HTMLInputElement>(null)
  const input2Ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOperator) {
      router.replace("/proje")
      return
    }
    fetch("/api/sites")
      .then((res) => (res.ok ? res.json() : []))
      .then((list: SiteOption[]) => {
        setSites(list)
        if (user?.siteId != null && siteId === "") setSiteId(user.siteId)
        else if (list.length === 1 && siteId === "") setSiteId(list[0].id)
      })
      .catch(() => setSites([]))
  }, [isOperator, router, user?.siteId])

  const selectedSite = sites.find((s) => s.id === siteId)
  const assignedMachineIds = Array.isArray(selectedSite?.assigned_machine_ids) ? selectedSite.assigned_machine_ids : []
  const machinesToShow = assignedMachineIds.length > 0
    ? AVAILABLE_MACHINES.filter((m) => assignedMachineIds.includes(m.id))
    : AVAILABLE_MACHINES
  const selectedMachine = machinesToShow.find((m) => m.id === machineId) ?? AVAILABLE_MACHINES.find((m) => m.id === machineId)
  const machineName = selectedMachine?.name ?? ""

  const handleImageChange = async (slot: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setMessage({ type: "error", text: `Resim en fazla ${MAX_IMAGE_SIZE_MB} MB olabilir.` })
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      if (slot === 1) setImage1(dataUrl)
      else setImage2(dataUrl)
      setMessage(null)
    } catch {
      setMessage({ type: "error", text: "Resim yüklenirken hata oluştu." })
    }
    e.target.value = ""
  }

  const addPileRow = () => setPileDepths((prev) => [...prev, { depth: "", onForaj: false, bosForaj: false }])
  const removePileRow = (index: number) =>
    setPileDepths((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  const updatePileRow = (index: number, field: "depth" | "onForaj" | "bosForaj", value: string | boolean) =>
    setPileDepths((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  /** Biniş saatine makine çalışma saatini ekleyip İniş saatini hesaplar (HH:mm). */
  function addHoursToTime(timeStr: string, hoursToAdd: number): string {
    const [h, m] = (timeStr || "00:00").split(":").map((x) => parseInt(x, 10) || 0)
    const totalMinutes = h * 60 + m + Math.round(hoursToAdd * 60)
    const h2 = Math.floor(totalMinutes / 60) % 24
    const m2 = totalMinutes % 60
    return `${String(h2).padStart(2, "0")}:${String(m2).padStart(2, "0")}`
  }

  const handleStartTimeChange = (value: string) => {
    setStartTime(value)
    if (value && machineHours.trim()) {
      const h = parseFloat(machineHours.replace(",", "."))
      if (!Number.isNaN(h) && h > 0) setEndTime(addHoursToTime(value.slice(0, 5), h))
    }
  }

  const handleMachineHoursChange = (value: string) => {
    setMachineHours(value)
    if (startTime && value.trim()) {
      const h = parseFloat(value.replace(",", "."))
      if (!Number.isNaN(h) && h > 0) setEndTime(addHoursToTime(startTime.slice(0, 5), h))
    }
  }

  const handleSubmit = async () => {
    if (!siteId || !reportDate || !machineId || !machineName) {
      setMessage({ type: "error", text: "Tarih, şantiye ve makine seçimi zorunludur." })
      return
    }
    const elmasTrim = elmasMiktar.trim()
    let finalElmasDegisimYok = false
    if (!elmasTrim) {
      const degisimYok = window.confirm("Değişen elmas yok mu?")
      if (degisimYok) finalElmasDegisimYok = true
      else {
        setMessage({ type: "error", text: "Lütfen elmas miktarını girin." })
        return
      }
    }
    setSaving(true)
    setMessage(null)
    try {
      const payloadPileDepths = pileDepths
        .filter((r) => r.depth.trim() !== "")
        .map((r) => ({ depth: r.depth.trim(), onForaj: r.onForaj, bosForaj: r.bosForaj }))
      const res = await fetch("/api/operator-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: Number(siteId),
          reportDate,
          machineId,
          machineName,
          startTime: startTime.trim().slice(0, 5),
          endTime: endTime.trim().slice(0, 5),
          machineHours: machineHours.trim(),
          pileDepths: payloadPileDepths,
          usedFuel: usedFuel.trim(),
          elmasMiktar: elmasTrim || (finalElmasDegisimYok ? "yok" : ""),
          elmasDegisimYok: finalElmasDegisimYok,
          bentonitMiktar: bentonitMiktar.trim(),
          workDone: workDone.trim(),
          note: note.trim(),
          dailyPileCount: dailyPileCount.trim(),
          totalProduction: totalProduction.trim(),
          emptyBorehole: emptyBorehole.trim(),
          preBorehole: preBorehole.trim(),
          concretePoured: concretePoured.trim(),
          image1: image1 || null,
          image2: image2 || null,
          notes: notes.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setMessage({ type: "success", text: "Kayıt başarılı. Veriler ana rapora birleştirilecektir." })
        setStartTime("")
        setEndTime("")
        setMachineHours("")
        setPileDepths([{ depth: "", onForaj: false, bosForaj: false }])
        setUsedFuel("")
        setElmasMiktar("")
        setElmasDegisimYok(false)
        setBentonitMiktar("")
        setWorkDone("")
        setNote("")
        setDailyPileCount("")
        setTotalProduction("")
        setEmptyBorehole("")
        setPreBorehole("")
        setConcretePoured("")
        setImage1("")
        setImage2("")
        setNotes("")
      } else {
        setMessage({ type: "error", text: data.error || "Kayıt sırasında hata oluştu." })
      }
    } catch {
      setMessage({ type: "error", text: "Kayıt sırasında hata oluştu." })
    } finally {
      setSaving(false)
    }
  }

  if (!isOperator) return null

  const lockedSite = user?.siteId != null

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: "var(--icsp-lacivert)", fontWeight: 600 }}>
        Operatör – Makine ve Üretim Girişi
      </Typography>

      {/* 1. Tarih ve Şantiye (ilk adım) */}
      <Paper sx={{ p: 2, mb: 2, background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)", border: "1px solid #ff9800" }}>
        <Typography variant="subtitle1" sx={{ color: "#e65100", fontWeight: 600, mb: 2 }}>
          Tarih ve Şantiye
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            fullWidth
            label="Rapor Tarihi"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value.slice(0, 10))}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl fullWidth disabled={lockedSite}>
            <InputLabel>Şantiye</InputLabel>
            <Select
              value={siteId}
              label="Şantiye"
              onChange={(e) => {
                setSiteId(e.target.value === "" ? "" : Number(e.target.value))
                setMachineId("")
              }}
            >
              <MenuItem value="">Seçiniz</MenuItem>
              {sites.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* 2. Makine seçimi ve üretim özeti */}
      <Paper sx={{ p: 2, mb: 2, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", border: "1px solid #2196f3" }}>
        <Typography variant="subtitle1" sx={{ color: "#1565c0", fontWeight: 600, mb: 2 }}>
          Makine Seçimi ve Üretim Özeti
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Kazık Makinesi</InputLabel>
            <Select
              value={machineId}
              label="Kazık Makinesi"
              onChange={(e) => setMachineId(e.target.value)}
            >
              <MenuItem value="">Seçiniz</MenuItem>
              {machinesToShow.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Biniş saati = makineye biniş (mesai başlangıcı). İniş saati = iniş (mesai bitişi); makine çalışma saati girildiğinde otomatik hesaplanır.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <TextField fullWidth label="Biniş saati (mesai başlangıcı)" type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 140 }} />
            <TextField fullWidth label="Makine çalışma saati" type="number" value={machineHours} onChange={(e) => handleMachineHoursChange(e.target.value)} placeholder="Saat (örn: 8 veya 8,5)" inputProps={{ min: 0, step: 0.5 }} sx={{ minWidth: 140 }} />
            <TextField fullWidth label="İniş saati (mesai bitişi)" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} InputLabelProps={{ shrink: true }} helperText="Biniş + makine saati ile otomatik dolar, düzenleyebilirsiniz" sx={{ minWidth: 140 }} />
          </Box>
          <TextField fullWidth label="Mazot Miktarı (Litre)" type="number" value={usedFuel} onChange={(e) => setUsedFuel(e.target.value)} placeholder="Örn: 120" />
          <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 600 }}>Kazık derinlikleri</Typography>
          {pileDepths.map((row, index) => (
            <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="body2" sx={{ minWidth: 24 }}>{index + 1}.</Typography>
              <TextField size="small" label="Derinlik (m)" value={row.depth} onChange={(e) => updatePileRow(index, "depth", e.target.value)} placeholder="m" type="number" sx={{ width: 100 }} />
              <FormControlLabel control={<Checkbox checked={row.onForaj} onChange={(e) => updatePileRow(index, "onForaj", e.target.checked)} />} label="Ön foraj" />
              <FormControlLabel control={<Checkbox checked={row.bosForaj} onChange={(e) => updatePileRow(index, "bosForaj", e.target.checked)} />} label="Boş foraj" />
              <Button size="small" onClick={() => removePileRow(index)} disabled={pileDepths.length <= 1} startIcon={<Delete />} color="error" />
            </Box>
          ))}
          <Button size="small" startIcon={<Add />} onClick={addPileRow} variant="outlined">Satır ekle</Button>
          <Typography variant="subtitle2" sx={{ mt: 1, fontWeight: 600 }}>Diğer malzemeler</Typography>
          <TextField fullWidth size="small" label="Elmas (miktar)" value={elmasMiktar} onChange={(e) => setElmasMiktar(e.target.value)} placeholder="Elmas miktarı; boş bırakırsanız kayıtta sorulacak" />
          <TextField fullWidth size="small" label="Bentonit (miktar)" value={bentonitMiktar} onChange={(e) => setBentonitMiktar(e.target.value)} placeholder="Bentonit miktarı" />
          <TextField fullWidth label="O gün yapılan kazık sayısı (Ad.)" type="number" value={dailyPileCount} onChange={(e) => setDailyPileCount(e.target.value)} placeholder="Beton dökülen kazık adedi" />
          <TextField fullWidth label="Kazık İmalatı (m)" type="number" value={totalProduction} onChange={(e) => setTotalProduction(e.target.value)} placeholder="Metre" />
          <TextField fullWidth label="Boş Foraj (Adet)" type="number" value={emptyBorehole} onChange={(e) => setEmptyBorehole(e.target.value)} />
          <TextField fullWidth label="Ön Foraj (Adet)" type="number" value={preBorehole} onChange={(e) => setPreBorehole(e.target.value)} />
          <TextField fullWidth label="Beton Dökülen Kazık (Ad.)" type="number" value={concretePoured} onChange={(e) => setConcretePoured(e.target.value)} />
          <TextField fullWidth label="Yaptığı İmalat (özet)" value={workDone} onChange={(e) => setWorkDone(e.target.value)} placeholder="O gün yapılan imalat özeti" />
          <TextField fullWidth label="Makine İçin Not" multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Makine ile ilgili notlar" />
        </Box>
      </Paper>

      {/* 3. Fotoğraf ve bilgi/not */}
      <Paper sx={{ p: 2, mb: 2, background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)", border: "1px solid #4caf50" }}>
        <Typography variant="subtitle1" sx={{ color: "#2e7d32", fontWeight: 600, mb: 2 }}>
          Fotoğraf ve Bilgi / Not
        </Typography>
        <TextField fullWidth multiline minRows={3} label="Bilgi / Not" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ek bilgi veya notlarınız..." sx={{ mb: 2 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Fotoğraf (en fazla 2 adet, {MAX_IMAGE_SIZE_MB} MB)</Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <input ref={input1Ref} type="file" accept={ACCEPT_IMAGE} style={{ display: "none" }} onChange={(e) => handleImageChange(1, e)} />
          <input ref={input2Ref} type="file" accept={ACCEPT_IMAGE} style={{ display: "none" }} onChange={(e) => handleImageChange(2, e)} />
          {image1 ? (
            <Box sx={{ position: "relative", display: "inline-block" }}>
              <img src={image1} alt="1" style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain", border: "1px solid #ccc", borderRadius: 8 }} />
              <Button size="small" color="error" onClick={() => setImage1("")} sx={{ position: "absolute", top: 4, right: 4 }}>Kaldır</Button>
            </Box>
          ) : (
            <Button variant="outlined" startIcon={<PhotoCamera />} onClick={() => input1Ref.current?.click()} sx={{ borderColor: "#4caf50", color: "#2e7d32" }}>Resim 1</Button>
          )}
          {image2 ? (
            <Box sx={{ position: "relative", display: "inline-block" }}>
              <img src={image2} alt="2" style={{ maxWidth: "100%", maxHeight: 160, objectFit: "contain", border: "1px solid #ccc", borderRadius: 8 }} />
              <Button size="small" color="error" onClick={() => setImage2("")} sx={{ position: "absolute", top: 4, right: 4 }}>Kaldır</Button>
            </Box>
          ) : (
            <Button variant="outlined" startIcon={<PhotoCamera />} onClick={() => input2Ref.current?.click()} sx={{ borderColor: "#4caf50", color: "#2e7d32" }}>Resim 2</Button>
          )}
        </Box>
      </Paper>

      {message && (
        <Typography
          variant="body2"
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 1,
            bgcolor: message.type === "success" ? "success.light" : "error.light",
            color: message.type === "success" ? "success.dark" : "error.dark",
          }}
        >
          {message.text}
        </Typography>
      )}

      <Button fullWidth variant="contained" startIcon={<Save />} onClick={handleSubmit} disabled={saving} sx={{ py: 1.5 }}>
        {saving ? "Kaydediliyor..." : "Kayıt Et"}
      </Button>
    </Container>
  )
}
