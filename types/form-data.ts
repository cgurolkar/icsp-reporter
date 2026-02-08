export interface Machine {
  id: string
  name: string
  type: string
}

export interface MachineSelection {
  selectedMachine: Machine | null
  additionalMachines: Machine[]
  showMachineSelection: boolean
  currentMachineIndex: number
  showAddMachineAfterStep2: boolean
}

export interface MachineBasicInfo {
  machineId: string
  machineName: string
  machineHours: string
  usedFuel: string
  changedDiamondCount: string // yeni eklendi
  note: string // yeni eklendi
}

export interface MachineProductionSummary {
  machineId: string
  machineName: string
  totalProduction: string
  emptyBorehole: string // yeni
  preBorehole: string // yeni
  concretePoured: string
}

export interface BasicInfo {
  date: string
  project: string
  /** Şantiye seçimi (çoklu şantiye / mobil dağıtım için) */
  siteId: number | null
  siteName: string
  machines: MachineBasicInfo[]
}

export interface Personnel {
  engineer: number
  foreman: number
  operator: number
  oiler: number
  welder: number
  other: number
  total: number
}

export interface Vehicles {
  crane: number
  loader: number
  truck: number
  pickup: number
  car: number
  service: number
  total: number
}

export interface FuelMachine {
  name: string
  shift: string
  incoming: string
  remaining: string
  used: string
}

export interface Fuel {
  machines: FuelMachine[];
  dailyUsage: string;
  remainingOnSite: string; // new: devir (sahada kalan mazot)
}

export interface Expense {
  description: string
  amount: number
}

// New interfaces for the missing tables
export interface ProductionSummary {
  totalProduction: string
  totalPileCount: string
  dailyPileCount: string
  totalCompletedPiles: string
  remainingPiles: string
  steelLoweredPiles: string
  concretePoured: string
}

export interface PileDetail {
  pileNumber: number
  drilled: string
  notes: string
}

export interface IronStep {
  preparedToday: string;
  onSite: string;
  lowered: string;
  remaining: string; // calculated: onSite + preparedToday - lowered
}

export interface FormData {
  machineSelection: MachineSelection;
  basicInfo: BasicInfo;
  personnel: Personnel;
  vehicles: Vehicles;
  fuel: Fuel;
  expenses: Expense[];
  productionSummary: MachineProductionSummary[];
  pileDetails: PileDetail[];
  iron: IronStep; // new
  notes: string;
}

export const AVAILABLE_MACHINES: Machine[] = [
  { id: "xcmg-sr220", name: "XCMG SR220", type: "Kazık Makinesi" },
  { id: "sany-sr235", name: "SANY SR235", type: "Kazık Makinesi" },
  { id: "sany-sr285", name: "SANY SR285", type: "Kazık Makinesi" },
  { id: "soiltec-sr60", name: "SOILMEC SR60", type: "Kazık Makinesi" },
]

export const initialFormData: FormData = {
  machineSelection: {
    selectedMachine: null,
    additionalMachines: [],
    showMachineSelection: true,
    currentMachineIndex: 0,
    showAddMachineAfterStep2: false,
  },
  basicInfo: {
    date: new Date().toISOString().split("T")[0],
    project: "",
    siteId: null,
    siteName: "",
    machines: [],
  },
  personnel: {
    engineer: 0,
    foreman: 0,
    operator: 0,
    oiler: 0,
    welder: 0,
    other: 0,
    total: 0,
  },
  vehicles: {
    crane: 0,
    loader: 0,
    truck: 0,
    pickup: 0,
    car: 0,
    service: 0,
    total: 0,
  },
  fuel: {
    machines: [{ name: "", shift: "", incoming: "", remaining: "", used: "" }],
    dailyUsage: "",
    remainingOnSite: "",
  },
  expenses: [{ description: "", amount: 0 }],
  productionSummary: [{
    machineId: "",
    machineName: "",
    totalProduction: "",
    emptyBorehole: "",
    preBorehole: "",
    concretePoured: "",
  }],
  pileDetails: Array.from({ length: 10 }, (_, i) => ({
    pileNumber: i + 1,
    drilled: "",
    notes: "",
  })),
  iron: {
    preparedToday: "",
    onSite: "",
    lowered: "",
    remaining: "",
  },
  notes: "",
}
