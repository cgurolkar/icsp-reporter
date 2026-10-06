/** Rapor öncesi iş — makine bazında (sites.initial_machine_work JSONB) */

export type InitialMachineWorkEntry = {
  emptyBorehole?: number | null
  pilesDone?: number | null
  concreteMeters?: number | null
}

export type InitialMachineWorkMap = Record<string, InitialMachineWorkEntry>

export type InitialMachineWorkFormRow = {
  emptyBorehole: string
  pilesDone: string
  concreteMeters: string
}

export function emptyInitialMachineWorkFormRow(): InitialMachineWorkFormRow {
  return { emptyBorehole: "", pilesDone: "", concreteMeters: "" }
}

function parseIntNonNeg(s: string | undefined): number | null {
  const t = String(s ?? "").trim()
  if (t === "" || !/^\d+$/.test(t)) return null
  return Math.max(0, parseInt(t, 10) || 0)
}

function parseMetersNonNeg(s: string | undefined): number | null {
  const t = String(s ?? "").trim().replace(",", ".")
  if (t === "" || !Number.isFinite(Number(t))) return null
  return Math.max(0, Number(t))
}

export function parseInitialMachineWorkStored(raw: unknown): InitialMachineWorkMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: InitialMachineWorkMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(k).trim()
    if (!id || !v || typeof v !== "object" || Array.isArray(v)) continue
    const rec = v as Record<string, unknown>
    const emptyBorehole =
      rec.emptyBorehole != null || rec.empty_borehole != null
        ? Math.max(0, Number(rec.emptyBorehole ?? rec.empty_borehole) || 0)
        : undefined
    const pilesDone =
      rec.pilesDone != null || rec.piles_done != null
        ? Math.max(0, Number(rec.pilesDone ?? rec.piles_done) || 0)
        : undefined
    const concreteMeters =
      rec.concreteMeters != null || rec.concrete_meters != null
        ? Math.max(0, Number(rec.concreteMeters ?? rec.concrete_meters) || 0)
        : undefined
    if (emptyBorehole == null && pilesDone == null && concreteMeters == null) continue
    out[id] = { emptyBorehole, pilesDone, concreteMeters }
  }
  return out
}

export function sumInitialMachineWork(
  map: InitialMachineWorkMap,
  machineIds?: string[],
): { emptyBorehole: number; pilesDone: number; concreteMeters: number } {
  const ids = machineIds?.length ? new Set(machineIds.map(String)) : null
  let emptyBorehole = 0
  let pilesDone = 0
  let concreteMeters = 0
  for (const [k, e] of Object.entries(map)) {
    if (ids && !ids.has(String(k))) continue
    emptyBorehole += Math.max(0, Number(e.emptyBorehole) || 0)
    pilesDone += Math.max(0, Number(e.pilesDone) || 0)
    concreteMeters += Math.max(0, Number(e.concreteMeters) || 0)
  }
  return { emptyBorehole, pilesDone, concreteMeters }
}

export function initialMachineWorkFormFromSite(
  raw: unknown,
  machineIds: string[],
  legacy?: { emptyBorehole?: string; pilesDone?: string; concreteMeters?: string },
): Record<string, InitialMachineWorkFormRow> {
  const stored = parseInitialMachineWorkStored(raw)
  const out: Record<string, InitialMachineWorkFormRow> = {}
  for (const mid of machineIds) {
    const e = stored[mid]
    out[mid] = {
      emptyBorehole: e?.emptyBorehole != null ? String(e.emptyBorehole) : "",
      pilesDone: e?.pilesDone != null ? String(e.pilesDone) : "",
      concreteMeters: e?.concreteMeters != null ? String(e.concreteMeters) : "",
    }
  }
  const hasAny = Object.values(out).some(
    (r) => r.emptyBorehole.trim() || r.pilesDone.trim() || r.concreteMeters.trim(),
  )
  if (!hasAny && machineIds.length === 1 && legacy) {
    out[machineIds[0]] = {
      emptyBorehole: legacy.emptyBorehole ?? "",
      pilesDone: legacy.pilesDone ?? "",
      concreteMeters: legacy.concreteMeters ?? "",
    }
  }
  return out
}

export function formRowsToStored(
  form: Record<string, InitialMachineWorkFormRow>,
  machineIds: string[],
): InitialMachineWorkMap {
  const out: InitialMachineWorkMap = {}
  for (const mid of machineIds) {
    const row = form[mid] ?? emptyInitialMachineWorkFormRow()
    const emptyBorehole = parseIntNonNeg(row.emptyBorehole)
    const pilesDone = parseIntNonNeg(row.pilesDone)
    const concreteMeters = parseMetersNonNeg(row.concreteMeters)
    if (emptyBorehole == null && pilesDone == null && concreteMeters == null) continue
    out[mid] = { emptyBorehole, pilesDone, concreteMeters }
  }
  return out
}

/** API gövdesinden rapor öncesi alanlarını çöz (makine listesi varsa makine JSON öncelikli). */
export function resolveSiteInitialWorkForSave(
  isOngoing: boolean,
  machineIds: string[],
  body: {
    initialMachineWork?: unknown
    initialPilesDone?: number | null
    initialEmptyBorehole?: number | null
    initialConcreteMeters?: number | null
  },
): {
  initialMachineWork: InitialMachineWorkMap
  initialPilesDone: number | null
  initialEmptyBorehole: number | null
  initialConcreteMeters: number | null
} {
  if (!isOngoing) {
    return {
      initialMachineWork: {},
      initialPilesDone: null,
      initialEmptyBorehole: null,
      initialConcreteMeters: null,
    }
  }
  if (machineIds.length > 0 && body.initialMachineWork !== undefined) {
    const stored = parseInitialMachineWorkStored(body.initialMachineWork)
    const filtered: InitialMachineWorkMap = {}
    for (const mid of machineIds) {
      if (stored[mid]) filtered[mid] = stored[mid]
    }
    const sums = sumInitialMachineWork(filtered, machineIds)
    return {
      initialMachineWork: filtered,
      initialPilesDone: sums.pilesDone > 0 ? sums.pilesDone : null,
      initialEmptyBorehole: sums.emptyBorehole > 0 ? sums.emptyBorehole : null,
      initialConcreteMeters: sums.concreteMeters > 0 ? sums.concreteMeters : null,
    }
  }
  return {
    initialMachineWork: {},
    initialPilesDone: body.initialPilesDone ?? null,
    initialEmptyBorehole: body.initialEmptyBorehole ?? null,
    initialConcreteMeters: body.initialConcreteMeters ?? null,
  }
}
