/**
 * Veritabanındaki rapor + makineler + yakıt kayıtlarından formData benzeri obje (HTML / e-posta üretimi).
 */

export function formDataFromDbReport(data: {
  report: Record<string, unknown>
  machines: Record<string, unknown>[]
  fuelRecords: Record<string, unknown>[]
}) {
  const r = data.report
  const dateVal = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : (typeof r.date === "string" ? r.date.slice(0, 10) : "")
  const dbMachines = Array.isArray(data.machines) ? data.machines : []

  const machines = dbMachines.map((m: Record<string, unknown>, i: number) => ({
    machineId: String(m.machine_id ?? ""),
    machineName: String(m.machine_name ?? ""),
    machineHours: i === 0 ? String(r.machine_hours ?? "") : "",
    totalProduction: i === 0 ? String(r.total_production ?? "") : "",
    pileCount: i === 0 ? String(r.pile_count ?? "") : "",
    drilledPile: i === 0 ? String(r.drilled_pile ?? "") : "",
    concretePile: i === 0 ? String(r.concrete_pile ?? "") : "",
  }))

  const primary = dbMachines.find((m) => m.is_primary === true) ?? dbMachines[0]
  const additional = dbMachines.filter((m) => m !== primary)

  // Kayıtlı makine bazlı üretim özeti (yeni raporlar)
  let productionSummary: Record<string, unknown>[] = []
  let rawPs = r.production_summary_json
  if (typeof rawPs === "string") {
    try { rawPs = JSON.parse(rawPs) } catch { rawPs = null }
  }
  if (Array.isArray(rawPs) && rawPs.length > 0) {
    productionSummary = rawPs.map((row) => {
      const m = row as Record<string, unknown>
      return {
        machineId: String(m.machineId ?? m.machine_id ?? ""),
        machineName: String(m.machineName ?? m.machine_name ?? ""),
        totalProduction: String(m.totalProduction ?? m.total_production ?? ""),
        emptyBorehole: String(m.emptyBorehole ?? m.empty_borehole ?? ""),
        preBorehole: String(m.preBorehole ?? m.pre_borehole ?? ""),
        concretePoured: String(m.concretePoured ?? m.concrete_poured ?? ""),
        dailyDrilledPiles: String(m.dailyDrilledPiles ?? m.daily_drilled_piles ?? m.dailyPileCount ?? ""),
        totalPileCount: String(m.totalPileCount ?? m.total_pile_count ?? ""),
        dailyPileCount: String(m.dailyPileCount ?? m.daily_pile_count ?? ""),
        totalCompletedPiles: String(m.totalCompletedPiles ?? m.total_completed_piles ?? ""),
        remainingPiles: String(m.remainingPiles ?? m.remaining_piles ?? ""),
        steelLoweredPiles: String(m.steelLoweredPiles ?? m.steel_lowered_piles ?? ""),
      }
    })
  } else if (dbMachines.length > 0) {
    // Eski raporlar: her seçili makine için satır; özet alanlar birincil makinede
    productionSummary = dbMachines.map((m, i) => ({
      machineId: String(m.machine_id ?? ""),
      machineName: String(m.machine_name ?? ""),
      totalProduction: i === 0 ? String(r.total_production_summary ?? "") : "",
      emptyBorehole: "",
      preBorehole: "",
      concretePoured: i === 0 ? String(r.concrete_poured ?? "") : "",
      dailyDrilledPiles: i === 0 ? String(r.daily_pile_count ?? "") : "",
      totalPileCount: i === 0 ? String(r.total_pile_count ?? "") : "",
      dailyPileCount: i === 0 ? String(r.daily_pile_count ?? "") : "",
      totalCompletedPiles: i === 0 ? String(r.total_completed_piles ?? "") : "",
      remainingPiles: i === 0 ? String(r.remaining_piles ?? "") : "",
      steelLoweredPiles: i === 0 ? String(r.steel_lowered_piles ?? "") : "",
    }))
  } else {
    productionSummary = [{
      machineId: String(r.selected_machine_id ?? ""),
      machineName: String(r.selected_machine_name ?? ""),
      totalProduction: String(r.total_production_summary ?? ""),
      emptyBorehole: "",
      preBorehole: "",
      concretePoured: String(r.concrete_poured ?? ""),
      dailyDrilledPiles: String(r.daily_pile_count ?? ""),
      totalPileCount: String(r.total_pile_count ?? ""),
      dailyPileCount: String(r.daily_pile_count ?? ""),
      totalCompletedPiles: String(r.total_completed_piles ?? ""),
      remainingPiles: String(r.remaining_piles ?? ""),
      steelLoweredPiles: String(r.steel_lowered_piles ?? ""),
    }]
  }

  const formData = {
    basicInfo: {
      date: dateVal,
      project: r.project ?? "",
      siteId: r.site_id != null && r.site_id !== "" ? Number(r.site_id) : undefined,
      machines,
    },
    machineSelection: {
      selectedMachine: {
        id: String(primary?.machine_id ?? r.selected_machine_id ?? ""),
        name: String(primary?.machine_name ?? r.selected_machine_name ?? ""),
        type: String(primary?.machine_type ?? "Kazık Makinesi"),
      },
      additionalMachines: additional.map((m: Record<string, unknown>) => ({
        id: String(m.machine_id ?? ""),
        name: String(m.machine_name ?? ""),
        type: String(m.machine_type ?? "Kazık Makinesi"),
      })),
      currentMachineIndex: 0,
    },
    productionSummary,
    personnel: {
      engineer: r.engineer_count ?? 0,
      foreman: r.foreman_count ?? 0,
      operator: r.operator_count ?? 0,
      oiler: r.oiler_count ?? 0,
      welder: r.welder_count ?? 0,
      other: r.other_count ?? 0,
      total: r.personnel_total ?? 0,
    },
    vehicles: {
      crane: r.crane_count ?? 0,
      loader: r.loader_count ?? 0,
      truck: r.truck_count ?? 0,
      pickup: r.pickup_count ?? 0,
      car: r.car_count ?? 0,
      service: r.service_count ?? 0,
      total: r.vehicles_total ?? 0,
    },
    fuel: {
      machines: (() => {
        const records = (data.fuelRecords || []).map((f: Record<string, unknown>) => ({
          name: String(f.machine_name ?? "").trim(),
          shift: String(f.shift ?? ""),
          incoming: String(f.incoming ?? ""),
          remaining: String(f.remaining ?? ""),
          used: String(f.used ?? ""),
        }))
        const byName = new Map<string, (typeof records)[0]>()
        for (const r of records) {
          if (!r.name) continue
          const key = r.name.toLocaleLowerCase("tr-TR")
          if (!byName.has(key)) byName.set(key, r)
        }
        const ordered: typeof records = []
        const seen = new Set<string>()
        const pushMachine = (rawName: unknown) => {
          const name = String(rawName ?? "").trim()
          if (!name) return
          const key = name.toLocaleLowerCase("tr-TR")
          if (seen.has(key)) return
          seen.add(key)
          ordered.push(byName.get(key) ?? { name, shift: "", incoming: "", remaining: "", used: "" })
          byName.delete(key)
        }
        for (const m of dbMachines) pushMachine(m.machine_name)
        for (const m of productionSummary) pushMachine((m as { machineName?: string }).machineName)
        for (const r of byName.values()) ordered.push(r)
        return ordered.length > 0 ? ordered : records
      })(),
    },
    pileDetails: Array.isArray(r.pile_details) ? r.pile_details : [],
    notes: (r.notes as string) ?? "",
    expenses: Array.isArray(r.expenses) ? r.expenses : [],
    dailyInfo: {
      notes: (r.daily_notes as string) ?? "",
      nextDayPlannedWork: (r.next_day_planned as string) ?? "",
      images: (() => {
        const arr = Array.isArray(r.daily_images) ? (r.daily_images as string[]) : []
        if (arr.length > 0) return arr
        const legacy = [(r.daily_image1 as string) ?? "", (r.daily_image2 as string) ?? ""].filter(Boolean)
        return legacy
      })(),
      image1: (r.daily_image1 as string) ?? "",
      image2: (r.daily_image2 as string) ?? "",
    },
    siteConcretePouredPiles: String(r.concrete_poured ?? "").trim(),
  }
  return formData
}
