export interface Machine {
  id: string
  name: string
  type: string
  marka?: string
  model?: string
  plaka_no?: string
  seri_no?: string
  status?: string
  notlar?: string
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
  /** O gün makinenin yaptığı delgi / yapılan kazık adedi (operatörden bağımsız) */
  dailyDrilledPiles?: string
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

/** @deprecated Eski rapor uyumluluğu; yeni girişlerde altKalemId tercih edilir */
export type ExpenseCategory = "santiye" | "makine" | "personel" | "yakit" | "diger"

/** Harcama tutarı bu para biriminde girilir; şantiye kuru ile diğer para birimine çevrilir. */
export type ExpenseCurrency = "IQD" | "USD"

export interface Expense {
  description: string
  amount: number
  /** @deprecated Eski rapor uyumluluğu */
  category?: ExpenseCategory
  currency?: ExpenseCurrency
  /** Alt kalem (100–700 hiyerarşisi) */
  altKalemId?: number | null
  /** Masraf yeri */
  masrafYeriId?: number | null
  /** Gösterim için (opsiyonel, JSON’da saklanabilir) */
  altKalemAd?: string
  masrafYeriAd?: string
  kalemKod?: string
  kalemAd?: string
}

export interface DailyInfo {
  notes: string
  /** Bir sonraki gün için planlanan imalat ve yapılacak işler */
  nextDayPlannedWork?: string
  /** Base64 data URL array — up to 10 images */
  images?: string[]
  /** @deprecated use images[0] */
  image1?: string
  /** @deprecated use images[1] */
  image2?: string
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
  /** Manager işareti: beton döküldü mü */
  concretePoured?: boolean
  /** Birden fazla makinede bu kazık satırı hangi makinelerle ilişkili */
  machineIds?: string[]
  /** site_pile_rates.id */
  diameterRateId?: string | number | null
  /** Primary / secondary birim fiyat seçimi */
  priceTier?: PriceTier | ""
}

export type PriceTier = "primary" | "secondary"

/** Şantiye tarife satırı (formda fiyatlar gizlenebilir) */
export interface SitePileRateOption {
  id: number
  diameterMm: number
  label: string
}

export interface PuantajEntry {
  personel_id: number
  ad: string
  soyad: string
  gorev: string
  carpan: number        // 1 = tam gün, 0.5 = yarım, 0 = gelmedi
  durum_kod: string     // G, İ, R
  mesai_saat: number
  notlar: string
}

export interface FormData {
  machineSelection: MachineSelection;
  basicInfo: BasicInfo;
  personnel: Personnel;
  puantaj: PuantajEntry[];
  vehicles: Vehicles;
  fuel: Fuel;
  expenses: Expense[];
  productionSummary: MachineProductionSummary[];
  /** Şantiyede o gün dökülen toplam betonlu kazık (tüm makineler) */
  siteConcretePouredPiles?: string;
  /** Beton dökülen kazıkların toplam boyu (m) — kazık detayında beton işaretli delinen toplamı */
  siteConcreteTotalLength?: string;
  pileDetails: PileDetail[];
  dailyInfo: DailyInfo;
  notes: string;
}

export const AVAILABLE_MACHINES: Machine[] = [
  { id: "xcmg-sr220", name: "XCMG SR220", type: "Kazık Makinesi" },
  { id: "sany-sr235", name: "SANY SR235", type: "Kazık Makinesi" },
  { id: "sany-sr285", name: "SANY SR285", type: "Kazık Makinesi" },
  { id: "soiltec-sr60", name: "SOILMEC SR60", type: "Kazık Makinesi" },
]

export const initialFormData: FormData = {
  puantaj: [],
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
  expenses: [{ description: "", amount: 0, currency: "IQD", altKalemId: null, masrafYeriId: null }],
  dailyInfo: { notes: "", nextDayPlannedWork: "", images: [] },
  productionSummary: [{
    machineId: "",
    machineName: "",
    totalProduction: "",
    emptyBorehole: "",
    preBorehole: "",
    concretePoured: "",
    dailyDrilledPiles: "",
  }],
  siteConcretePouredPiles: "",
  siteConcreteTotalLength: "",
  pileDetails: Array.from({ length: 3 }, (_, i) => ({
    pileNumber: i + 1,
    drilled: "",
    notes: "",
    machineIds: [],
  })),
  notes: "",
}
