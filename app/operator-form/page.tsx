"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  FormControlLabel,
  Checkbox,
  Alert,
  Chip,
} from "@mui/material"
import { Save, PhotoCamera, Add, Delete, ArrowForward } from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"

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

interface DbMachine {
  id: number
  name: string
  machine_type: string
  marka: string | null
  model: string | null
  plaka_no: string | null
}

export default function OperatorFormPage() {
  const { user } = useAuth()
  const router = useRouter()
  const role = (user?.role ?? "").toLowerCase()
  const isOperator = role === "operator"

  // Site is always from the user's assigned site — no selection needed
  const siteId: number | null = user?.siteId ?? null

  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split("T")[0])

  // DB machines for this site
  const [dbMachines, setDbMachines] = useState<DbMachine[]>([])
  const [selectedDbMachine, setSelectedDbMachine] = useState<DbMachine | null>(null)
  const [machinesLoaded, setMachinesLoaded] = useState(false)

  // Legacy string IDs for backward compat with operator_entry API
  const machineId = selectedDbMachine ? `DB_${selectedDbMachine.id}` : ""
  const machineName = selectedDbMachine?.name ?? ""

  const [motorSaatBinis, setMotorSaatBinis] = useState("")
  const [motorSaatInis, setMotorSaatInis] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [pileDepths, setPileDepths] = useState<{ depth: string; onForaj: boolean; bosForaj: boolean }[]>([{ depth: "", onForaj: false, bosForaj: false }])
  const [usedFuel, setUsedFuel] = useState("")
  const [note, setNote] = useState("")
  const [concretePoured, setConcretePoured] = useState("")
  const [image1, setImage1] = useState("")
  const [image2, setImage2] = useState("")
  const [notes, setNotes] = useState("")

  // New fields
  const [kullanılanMalzeme, setKullanılanMalzeme] = useState("")
  const [malzemeIhtiyaci, setMalzemeIhtiyaci] = useState(false)
  const [servisIhtiyaci, setServisIhtiyaci] = useState(false)

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const input1Ref = useRef<HTMLInputElement>(null)
  const input2Ref = useRef<HTMLInputElement>(null)

  // Per-machine form data store — preserves data when switching between machines without saving
  const machineDataStore = useRef<Record<number, {
    motorSaatBinis: string; motorSaatInis: string; startTime: string; endTime: string
    pileDepths: { depth: string; onForaj: boolean; bosForaj: boolean }[]
    usedFuel: string; note: string; concretePoured: string
    image1: string; image2: string; notes: string
    kullanılanMalzeme: string; malzemeIhtiyaci: boolean; servisIhtiyaci: boolean
  }>>({})

  // When machine selection changes, save current data for the outgoing machine, restore for incoming
  const prevSelectedMachineRef = useRef<DbMachine | null>(null)
  useEffect(() => {
    const prev = prevSelectedMachineRef.current
    const curr = selectedDbMachine
    if (prev?.id === curr?.id) return // No actual change

    // Save outgoing machine's data
    if (prev != null) {
      machineDataStore.current[prev.id] = {
        motorSaatBinis, motorSaatInis, startTime, endTime,
        pileDepths: [...pileDepths],
        usedFuel, note, concretePoured, image1, image2, notes,
        kullanılanMalzeme, malzemeIhtiyaci, servisIhtiyaci,
      }
    }

    // Restore incoming machine's data (or clear if no stored data)
    if (curr != null) {
      const stored = machineDataStore.current[curr.id]
      if (stored) {
        setMotorSaatBinis(stored.motorSaatBinis)
        setMotorSaatInis(stored.motorSaatInis)
        setStartTime(stored.startTime)
        setEndTime(stored.endTime)
        setPileDepths(stored.pileDepths)
        setUsedFuel(stored.usedFuel)
        setNote(stored.note)
        setConcretePoured(stored.concretePoured)
        setImage1(stored.image1)
        setImage2(stored.image2)
        setNotes(stored.notes)
        setKullanılanMalzeme(stored.kullanılanMalzeme)
        setMalzemeIhtiyaci(stored.malzemeIhtiyaci)
        setServisIhtiyaci(stored.servisIhtiyaci)
      } else {
        // Fresh form for this machine
        setMotorSaatBinis(""); setMotorSaatInis(""); setStartTime(""); setEndTime("")
        setPileDepths([{ depth: "", onForaj: false, bosForaj: false }])
        setUsedFuel(""); setNote(""); setConcretePoured("")
        setImage1(""); setImage2(""); setNotes("")
        setKullanılanMalzeme(""); setMalzemeIhtiyaci(false); setServisIhtiyaci(false)
      }
    }

    prevSelectedMachineRef.current = curr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDbMachine])

  useEffect(() => {
    if (!isOperator) {
      router.replace("/proje")
      return
    }
    if (!siteId) return

    // Fetch DB machines for this site (auto-assigned to operator)
    fetch(`/api/operator-entry/my-machine?siteId=${siteId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: DbMachine[]) => {
        setDbMachines(list)
        if (list.length === 1) setSelectedDbMachine(list[0])
        setMachinesLoaded(true)
      })
      .catch(() => { setDbMachines([]); setMachinesLoaded(true) })
  }, [isOperator, router, siteId])

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

  const validPileRows = useMemo(() => pileDepths.filter((r) => String(r.depth ?? "").trim() !== ""), [pileDepths])
  const hazirlananKazik = validPileRows.length
  const toplamImalat = useMemo(() => validPileRows.reduce((s, r) => s + (parseFloat(String(r.depth).replace(",", ".")) || 0), 0), [validPileRows])
  const bosForajCount = useMemo(() => validPileRows.filter((r) => r.bosForaj).length, [validPileRows])
  const onForajCount = useMemo(() => validPileRows.filter((r) => r.onForaj).length, [validPileRows])

  const [recordingTime, setRecordingTime] = useState<"start" | "end" | null>(null)
  const handleRecordTime = async (type: "start" | "end") => {
    if (!siteId || !reportDate || !machineId || !machineName) {
      setMessage({ type: "error", text: "Tarih ve makine seçimi zorunludur." })
      return
    }
    const motorSaati = type === "start" ? motorSaatBinis.trim() : motorSaatInis.trim()
    if (!motorSaati) {
      setMessage({ type: "error", text: type === "start" ? "Biniş için motor saatini girin." : "İniş için motor saatini girin." })
      return
    }
    setRecordingTime(type)
    setMessage(null)
    try {
      const res = await fetch("/api/operator-entry/record-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: Number(siteId), reportDate, machineId, machineName, type, motorSaati }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        if (data.startTime) setStartTime(data.startTime)
        if (data.endTime) setEndTime(data.endTime)
        setMessage({ type: "success", text: type === "start" ? "Mesai başlangıcı kaydedildi." : "Mesai bitişi kaydedildi." })
      } else {
        setMessage({ type: "error", text: data.error || "Kayıt sırasında hata oluştu." })
      }
    } catch {
      setMessage({ type: "error", text: "Kayıt sırasında hata oluştu." })
    } finally {
      setRecordingTime(null)
    }
  }

  const handleSubmit = async () => {
    if (!siteId || !reportDate || !machineId || !machineName) {
      setMessage({ type: "error", text: !selectedDbMachine ? "Lütfen makine seçin." : "Tarih zorunludur." })
      return
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
          dbMachineId: selectedDbMachine?.id ?? null,
          startTime: startTime.trim().slice(0, 5),
          endTime: endTime.trim().slice(0, 5),
          motorSaatBinis: motorSaatBinis.trim(),
          motorSaatInis: motorSaatInis.trim(),
          pileDepths: payloadPileDepths,
          usedFuel: usedFuel.trim(),
          kullanılanMalzeme: kullanılanMalzeme.trim(),
          malzemeIhtiyaci,
          servisIhtiyaci,
          note: note.trim(),
          dailyPileCount: String(hazirlananKazik),
          totalProduction: String(toplamImalat),
          emptyBorehole: String(bosForajCount),
          preBorehole: String(onForajCount),
          concretePoured: concretePoured.trim(),
          image1: image1 || null,
          image2: image2 || null,
          notes: notes.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setMessage({ type: "success", text: "Kayıt başarılı. Veriler ana rapora birleştirilecektir." })
        // Clear stored data for this machine (was successfully saved)
        if (selectedDbMachine) delete machineDataStore.current[selectedDbMachine.id]
        prevSelectedMachineRef.current = null // Reset so switching back doesn't restore old data
        setMotorSaatBinis("")
        setMotorSaatInis("")
        setStartTime("")
        setEndTime("")
        setPileDepths([{ depth: "", onForaj: false, bosForaj: false }])
        setUsedFuel("")
        setKullanılanMalzeme("")
        setMalzemeIhtiyaci(false)
        setServisIhtiyaci(false)
        setNote("")
        setConcretePoured("")
        setImage1("")
        setImage2("")
        setNotes("")
        prevSelectedMachineRef.current = selectedDbMachine
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

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h6" sx={{ mb: 2, color: "var(--icsp-lacivert)", fontWeight: 600 }}>
        Operatör – Makine ve Üretim Girişi
      </Typography>

      {/* 1. Tarih */}
      <Paper sx={{ p: 2, mb: 2, background: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)", border: "1px solid #ff9800" }}>
        <Typography variant="subtitle1" sx={{ color: "#e65100", fontWeight: 600, mb: 2 }}>
          Rapor Tarihi
        </Typography>
        <TextField
          fullWidth
          label="Rapor Tarihi"
          type="date"
          value={reportDate}
          onChange={(e) => setReportDate(e.target.value.slice(0, 10))}
          InputLabelProps={{ shrink: true }}
        />
      </Paper>

      {/* 2. Makine bilgisi (otomatik) */}
      <Paper sx={{ p: 2, mb: 2, background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)", border: "1px solid #2196f3" }}>
        <Typography variant="subtitle1" sx={{ color: "#1565c0", fontWeight: 600, mb: 2 }}>
          Makine Seçimi ve Üretim Özeti
        </Typography>

        {/* Machine display */}
        {!machinesLoaded ? (
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2 }}>Makine bilgisi yükleniyor...</Typography>
        ) : dbMachines.length === 0 ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Bu şantiyeye atanmış aktif makine bulunamadı. Yönetici ile iletişime geçin.
          </Alert>
        ) : dbMachines.length === 1 ? (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: "#e8f0fe", borderRadius: 1, border: "1px solid #1976d2" }}>
            <Typography variant="body2" color="text.secondary">Makineniz</Typography>
            <Typography variant="subtitle1" fontWeight={700}>{dbMachines[0].name}</Typography>
            {dbMachines[0].marka && (
              <Typography variant="body2" color="text.secondary">
                {dbMachines[0].marka} {dbMachines[0].model ?? ""} {dbMachines[0].plaka_no ? `• ${dbMachines[0].plaka_no}` : ""}
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Bu şantiyede birden fazla makine mevcut. Lütfen kullandığınız makineyi seçin:
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {dbMachines.map((m) => {
                const hasUnsaved = m.id !== selectedDbMachine?.id && !!machineDataStore.current[m.id]
                return (
                  <Chip
                    key={m.id}
                    label={hasUnsaved ? `${m.name} ●` : m.name}
                    variant={selectedDbMachine?.id === m.id ? "filled" : "outlined"}
                    color={selectedDbMachine?.id === m.id ? "primary" : hasUnsaved ? "warning" : "default"}
                    onClick={() => setSelectedDbMachine(m)}
                    sx={{ cursor: "pointer" }}
                    title={hasUnsaved ? "Bu makinede kaydedilmemiş veri var" : undefined}
                  />
                )
              })}
            </Box>
            {selectedDbMachine && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Seçili: {selectedDbMachine.name}
                {selectedDbMachine.marka ? ` | ${selectedDbMachine.marka} ${selectedDbMachine.model ?? ""}` : ""}
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Makine motor saatini girin, ok butonuna basın; o anki bölgesel saat mesai başlangıcı/bitişi olarak kaydedilir.
          </Typography>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
            <TextField label="Motor saati (biniş)" type="number" value={motorSaatBinis} onChange={(e) => setMotorSaatBinis(e.target.value)} placeholder="Örn: 5092" sx={{ width: 140 }} />
            <Button variant="outlined" size="small" startIcon={<ArrowForward />} onClick={() => handleRecordTime("start")} disabled={recordingTime !== null} sx={{ mt: 1 }} title="Mesai başlangıcını şimdi kaydet">
              Kaydet
            </Button>
            {startTime ? <Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>Başlangıç: {startTime}</Typography> : null}
          </Box>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
            <TextField label="Motor saati (iniş)" type="number" value={motorSaatInis} onChange={(e) => setMotorSaatInis(e.target.value)} placeholder="Örn: 5100" sx={{ width: 140 }} />
            <Button variant="outlined" size="small" startIcon={<ArrowForward />} onClick={() => handleRecordTime("end")} disabled={recordingTime !== null} sx={{ mt: 1 }} title="Mesai bitişini şimdi kaydet">
              Kaydet
            </Button>
            {endTime ? <Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>Bitiş: {endTime}</Typography> : null}
          </Box>
          <TextField fullWidth label="Mazot Miktarı (Litre)" type="number" value={usedFuel} onChange={(e) => setUsedFuel(e.target.value)} placeholder="Örn: 120" />

          {/* Kullanılan malzeme */}
          <TextField
            fullWidth
            label="Kullanılan Malzeme"
            multiline
            minRows={2}
            value={kullanılanMalzeme}
            onChange={(e) => setKullanılanMalzeme(e.target.value)}
            placeholder="Örn: 3 adet elmas, 40 lt yağ..."
          />

          <Paper variant="outlined" sx={{ p: 1.5, background: "linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)", borderColor: "#ffc107" }}>
            <FormControlLabel
              control={<Checkbox checked={malzemeIhtiyaci} onChange={(e) => setMalzemeIhtiyaci(e.target.checked)} color="warning" />}
              label={<Typography fontWeight={600}>Malzeme İhtiyacı var mı? (Evet)</Typography>}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 4, mt: -0.5 }}>
              Bilgi: Elmas, Yağ, Halat ve benzeri ihtiyaçları işaretleyebilirsiniz.
            </Typography>
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox checked={servisIhtiyaci} onChange={(e) => setServisIhtiyaci(e.target.checked)} color="warning" />}
              label={<Typography fontWeight={600}>Servis veya Bakım ihtiyacı var mı? (Evet)</Typography>}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", ml: 4, mt: -0.5 }}>
              Bilgi: Servis, yağ değişimi, bakım, tamir vb.
            </Typography>
          </Paper>

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
          <TextField fullWidth size="small" label="Beton dökülen kazık (Ad.) – sadece döküldüyse" type="number" value={concretePoured} onChange={(e) => setConcretePoured(e.target.value)} placeholder="Beton döküldüyse adet girin" sx={{ maxWidth: 280 }} />
          <TextField fullWidth label="Makine İçin Not" multiline minRows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Makine ile ilgili notlar" />
        </Box>
      </Paper>

      {/* 3. Fotoğraf ve not */}
      <Paper sx={{ p: 2, mb: 2, background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)", border: "1px solid #4caf50" }}>
        <Typography variant="subtitle1" sx={{ color: "#2e7d32", fontWeight: 600, mb: 2 }}>
          Fotoğraf ve Önemli Olay/Talep/Not
        </Typography>
        <TextField fullWidth multiline minRows={3} label="Önemli Olay/Talep/Not" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ek bilgi veya notlarınız..." sx={{ mb: 2 }} />
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
            p: 1.5, mb: 2, borderRadius: 1,
            bgcolor: message.type === "success" ? "success.light" : "error.light",
            color: message.type === "success" ? "success.dark" : "error.dark",
          }}
        >
          {message.text}
        </Typography>
      )}

      <Button
        fullWidth variant="contained" startIcon={<Save />} onClick={handleSubmit}
        disabled={saving || !selectedDbMachine}
        sx={{ py: 1.5 }}
      >
        {saving ? "Kaydediliyor..." : "Kayıt Et"}
      </Button>
    </Container>
  )
}
