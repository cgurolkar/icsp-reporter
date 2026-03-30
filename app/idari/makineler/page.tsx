"use client"

import { useState, useEffect } from "react"
import {
  Box, Typography, Button, Paper, Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl,
  InputLabel, Select, MenuItem, Chip, IconButton, Accordion, AccordionSummary,
  AccordionDetails, Tooltip,
} from "@mui/material"
import {
  Add, Edit, Delete, ExpandMore, Construction, LocationOn,
  Person, SwapHoriz, CheckCircleOutline, BuildOutlined,
} from "@mui/icons-material"
import { useAuth } from "@/contexts/auth-context"

const MACHINE_TYPES = [
  "Kazık Makinesi", "Ekskavatör", "Vinç", "Loader",
  "Beton Pompası", "Jeneratör", "Kompresör", "Araç", "Diğer",
]

const STATUS_OPTS = [
  { value: "aktif", label: "Aktif", color: "#2e7d32", bg: "#e8f5e9" },
  { value: "bakimda", label: "Bakımda", color: "#e65100", bg: "#fff3e0" },
  { value: "depoda", label: "Depoda", color: "#1565c0", bg: "#e3f2fd" },
  { value: "hurda", label: "Hurda", color: "#7f0000", bg: "#ffebee" },
]

function statusChip(status: string) {
  const s = STATUS_OPTS.find((o) => o.value === status) ?? STATUS_OPTS[0]
  return (
    <Chip
      size="small" label={s.label}
      sx={{ background: s.bg, color: s.color, fontWeight: 600, fontSize: 11 }}
    />
  )
}

interface SiteItem { id: number; name: string; code: string }
interface PersonelItem { id: number; ad: string; soyad: string; gorev: string }
interface OperatorItem {
  personel_id: number; ad: string; soyad: string; gorev: string;
  baslangic_tarihi: string; bitis_tarihi: string | null
}
interface MachineRow {
  id: number; name: string; machine_type: string; marka: string | null; model: string | null;
  plaka_no: string | null; seri_no: string | null; status: string;
  current_site_id: number | null; site_name: string | null; notlar: string | null;
  operators: OperatorItem[]
}

const emptyForm = {
  name: "", machine_type: "Kazık Makinesi", marka: "", model: "",
  plaka_no: "", seri_no: "", status: "aktif", current_site_id: "" as string,
  notlar: "", operator_personel_ids: [] as number[],
}

export default function MakineDefteri() {
  const { user } = useAuth()
  const [machines, setMachines] = useState<MachineRow[]>([])
  const [sites, setSites] = useState<SiteItem[]>([])
  const [personeller, setPersoneller] = useState<PersonelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const role = (user?.role != null ? String(user.role).toLowerCase() : "") || ""
  const canManage = role === "admin" || role === "manager"

  const load = () => {
    setLoading(true)
    fetch("/api/idari/makineler")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MachineRow[]) => setMachines(data))
      .catch(() => setMachines([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    fetch("/api/sites").then((r) => (r.ok ? r.json() : [])).then(setSites).catch(() => setSites([]))
    fetch("/api/idari/personel?limit=500")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((res: { data?: PersonelItem[] } | PersonelItem[]) => {
        setPersoneller(Array.isArray(res) ? res : (res.data ?? []))
      })
      .catch(() => setPersoneller([]))
  }, [])

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (m: MachineRow) => {
    setEditingId(m.id)
    setForm({
      name: m.name,
      machine_type: m.machine_type,
      marka: m.marka ?? "",
      model: m.model ?? "",
      plaka_no: m.plaka_no ?? "",
      seri_no: m.seri_no ?? "",
      status: m.status,
      current_site_id: m.current_site_id != null ? String(m.current_site_id) : "",
      notlar: m.notlar ?? "",
      operator_personel_ids: m.operators.map((o) => o.personel_id),
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        machine_type: form.machine_type,
        marka: form.marka || null,
        model: form.model || null,
        plaka_no: form.plaka_no || null,
        seri_no: form.seri_no || null,
        status: form.status,
        current_site_id: form.current_site_id ? parseInt(form.current_site_id, 10) : null,
        notlar: form.notlar || null,
        operator_personel_ids: form.operator_personel_ids,
      }
      const url = editingId != null ? `/api/idari/makineler/${editingId}` : "/api/idari/makineler"
      const method = editingId != null ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (res.ok) {
        setDialogOpen(false)
        load()
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Kaydedilemedi.")
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (confirmDeleteId == null) return
    const res = await fetch(`/api/idari/makineler/${confirmDeleteId}`, { method: "DELETE" })
    if (res.ok) { setConfirmDeleteId(null); load() }
    else { const e = await res.json().catch(() => ({})); alert(e.error || "Silinemedi.") }
  }

  // Group by site
  const grouped: Record<string, MachineRow[]> = {}
  const noSite: MachineRow[] = []
  for (const m of machines) {
    if (m.current_site_id == null) { noSite.push(m); continue }
    const key = m.site_name ?? String(m.current_site_id)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  }
  const siteGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  const MachineTable = ({ list }: { list: MachineRow[] }) => (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><strong>Makine</strong></TableCell>
            <TableCell><strong>Tür / Marka</strong></TableCell>
            <TableCell><strong>Plaka / Seri</strong></TableCell>
            <TableCell><strong>Durum</strong></TableCell>
            <TableCell><strong>Operatörler</strong></TableCell>
            {canManage && <TableCell align="right">İşlem</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {list.map((m) => (
            <TableRow key={m.id} hover>
              <TableCell>
                <Typography fontWeight={600} variant="body2">{m.name}</Typography>
                {m.model && <Typography variant="caption" color="text.secondary">{m.model}</Typography>}
              </TableCell>
              <TableCell>
                <Typography variant="body2">{m.machine_type}</Typography>
                {m.marka && <Typography variant="caption" color="text.secondary">{m.marka}</Typography>}
              </TableCell>
              <TableCell>
                {m.plaka_no && <Typography variant="body2">{m.plaka_no}</Typography>}
                {m.seri_no && <Typography variant="caption" color="text.secondary">S/N: {m.seri_no}</Typography>}
                {!m.plaka_no && !m.seri_no && "—"}
              </TableCell>
              <TableCell>{statusChip(m.status)}</TableCell>
              <TableCell>
                {m.operators.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">Atanmamış</Typography>
                ) : (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {m.operators.map((op) => (
                      <Chip
                        key={op.personel_id}
                        size="small" icon={<Person sx={{ fontSize: "14px !important" }} />}
                        label={`${op.ad} ${op.soyad}`}
                        variant="outlined"
                        sx={{ fontSize: 11 }}
                      />
                    ))}
                  </Box>
                )}
              </TableCell>
              {canManage && (
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Düzenle / Şantiye Değiştir">
                    <IconButton size="small" onClick={() => openEdit(m)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Sil">
                    <IconButton size="small" sx={{ color: "error.main" }} onClick={() => setConfirmDeleteId(m.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  )

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h6" sx={{ color: "var(--icsp-lacivert)", fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
          <Construction /> Makine Defteri
        </Typography>
        {canManage && (
          <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ background: "var(--icsp-lacivert)" }}>
            Yeni Makine
          </Button>
        )}
      </Box>

      {loading ? (
        <Typography color="text.secondary">Yükleniyor...</Typography>
      ) : machines.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Construction sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">Henüz makine kaydı yok.</Typography>
          {canManage && (
            <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ mt: 2, background: "var(--icsp-lacivert)" }}>
              İlk makineyi ekle
            </Button>
          )}
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Şantiyeye göre gruplar */}
          {siteGroups.map(([siteName, list]) => (
            <Accordion key={siteName} defaultExpanded elevation={1} sx={{ borderRadius: "8px !important", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ background: "#f5f5f5", borderRadius: "8px 8px 0 0" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LocationOn color="primary" fontSize="small" />
                  <Typography fontWeight={700} color="var(--icsp-lacivert)">{siteName}</Typography>
                  <Chip label={`${list.length} makine`} size="small" sx={{ ml: 1 }} />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <MachineTable list={list} />
              </AccordionDetails>
            </Accordion>
          ))}

          {/* Şantiye atanmayanlar */}
          {noSite.length > 0 && (
            <Accordion defaultExpanded={false} elevation={1} sx={{ borderRadius: "8px !important", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />} sx={{ background: "#fafafa", borderRadius: "8px 8px 0 0" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <BuildOutlined color="disabled" fontSize="small" />
                  <Typography fontWeight={600} color="text.secondary">Şantiye Atanmamış / Depoda</Typography>
                  <Chip label={`${noSite.length}`} size="small" color="default" sx={{ ml: 1 }} />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <MachineTable list={noSite} />
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      )}

      {/* Ekle / Düzenle Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Construction />
          {editingId != null ? "Makine Düzenle" : "Yeni Makine Ekle"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField label="Makine Adı" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required fullWidth />
            <FormControl fullWidth>
              <InputLabel>Makine Türü</InputLabel>
              <Select value={form.machine_type} label="Makine Türü" onChange={(e) => setForm((f) => ({ ...f, machine_type: e.target.value }))}>
                {MACHINE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Marka" value={form.marka} onChange={(e) => setForm((f) => ({ ...f, marka: e.target.value }))} fullWidth />
              <TextField label="Model" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} fullWidth />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField label="Plaka No" value={form.plaka_no} onChange={(e) => setForm((f) => ({ ...f, plaka_no: e.target.value }))} fullWidth />
              <TextField label="Seri No" value={form.seri_no} onChange={(e) => setForm((f) => ({ ...f, seri_no: e.target.value }))} fullWidth />
            </Box>

            <Box sx={{ display: "flex", gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Durum</InputLabel>
                <Select value={form.status} label="Durum" onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Şantiye (Konum)</InputLabel>
                <Select
                  value={form.current_site_id}
                  label="Şantiye (Konum)"
                  onChange={(e) => setForm((f) => ({ ...f, current_site_id: e.target.value }))}
                  startAdornment={form.current_site_id ? <SwapHoriz sx={{ mr: 1, color: "primary.main" }} /> : undefined}
                >
                  <MenuItem value="">Depoda / Atanmamış</MenuItem>
                  {sites.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            {/* Çoklu operatör atama */}
            <FormControl fullWidth>
              <InputLabel>Operatörler (birden fazla seçilebilir)</InputLabel>
              <Select
                multiple
                value={form.operator_personel_ids}
                label="Operatörler (birden fazla seçilebilir)"
                onChange={(e) => setForm((f) => ({ ...f, operator_personel_ids: (e.target.value as number[]).filter((n) => n > 0) }))}
                renderValue={(sel) =>
                  (sel as number[]).map((id) => {
                    const p = personeller.find((p) => p.id === id)
                    return p ? `${p.ad} ${p.soyad}` : String(id)
                  }).join(", ") || "Seçin"
                }
              >
                {personeller.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {form.operator_personel_ids.includes(p.id) && <CheckCircleOutline fontSize="small" color="success" />}
                      {p.ad} {p.soyad} <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({p.gorev})</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Notlar" multiline minRows={2} value={form.notlar}
              onChange={(e) => setForm((f) => ({ ...f, notlar: e.target.value }))} fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>İptal</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim()} sx={{ background: "var(--icsp-lacivert)" }}>
            {saving ? "Kaydediliyor…" : editingId != null ? "Güncelle" : "Ekle"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Silme onay */}
      <Dialog open={confirmDeleteId != null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Makine Sil</DialogTitle>
        <DialogContent><Typography>Bu makine kaydı silinecek. Emin misiniz?</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteId(null)}>İptal</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Evet, Sil</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
