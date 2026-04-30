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
  const machines = (data.machines || []).map((m: Record<string, unknown>, i: number) => ({
    machineName: m.machine_name ?? "",
    machineHours: i === 0 ? (r.machine_hours ?? "") : "",
    totalProduction: i === 0 ? (r.total_production ?? "") : "",
    pileCount: i === 0 ? (r.pile_count ?? "") : "",
    drilledPile: i === 0 ? (r.drilled_pile ?? "") : "",
    concretePile: i === 0 ? (r.concrete_pile ?? "") : "",
  }))
  const formData = {
    basicInfo: {
      date: dateVal,
      project: r.project ?? "",
      siteId: r.site_id != null && r.site_id !== "" ? Number(r.site_id) : undefined,
      machines,
    },
    machineSelection: {
      selectedMachine: { id: r.selected_machine_id ?? "", name: r.selected_machine_name ?? "" },
      additionalMachines: (data.machines || []).slice(1).map((m: Record<string, unknown>) => ({ name: m.machine_name ?? "" })),
      currentMachineIndex: 0,
    },
    productionSummary: [{
      machineName: r.selected_machine_name ?? "",
      totalProduction: r.total_production_summary ?? "",
      totalPileCount: r.total_pile_count ?? "",
      dailyPileCount: r.daily_pile_count ?? "",
      totalCompletedPiles: r.total_completed_piles ?? "",
      remainingPiles: r.remaining_piles ?? "",
      steelLoweredPiles: r.steel_lowered_piles ?? "",
      concretePoured: r.concrete_poured ?? "",
    }],
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
      machines: (data.fuelRecords || []).map((f: Record<string, unknown>) => ({
        name: f.machine_name ?? "",
        shift: f.shift ?? "",
        incoming: f.incoming ?? "",
        remaining: f.remaining ?? "",
        used: f.used ?? "",
      })),
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
