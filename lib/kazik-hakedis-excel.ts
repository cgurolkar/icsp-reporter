import * as XLSX from "xlsx"
import { hakedisTierLabel } from "@/lib/hakedis"

export type KazikHakedisExportRow = {
  siteName: string
  siteCode: string
  reportDate: string
  reportId: number | null
  pileNumber: string
  notes: string
  meters: number
  diameterMm: number | null
  label: string
  priceTier: string
  unitPrice: number
  amount: number
  currency: string
}

const HEADERS = [
  "Şantiye",
  "Kod",
  "Tarih",
  "Rapor no",
  "Kazık no",
  "Not",
  "Metraj (m)",
  "Çap (mm)",
  "Etiket",
  "Fiyat tipi",
  "Birim fiyat",
  "Tutar",
  "Para birimi",
]

export function buildKazikHakedisWorkbook(rows: KazikHakedisExportRow[], asOfDate: string): Buffer {
  const data = rows.map((r) => [
    r.siteName,
    r.siteCode,
    r.reportDate,
    r.reportId ?? "",
    r.pileNumber,
    r.notes,
    r.meters,
    r.diameterMm ?? "",
    r.label,
    hakedisTierLabel(r.priceTier),
    r.unitPrice,
    r.amount,
    r.currency,
  ])
  const ws = XLSX.utils.aoa_to_sheet([
    [`Rapor kazıkları — ${asOfDate} tarihine kadar`],
    [],
    HEADERS,
    ...data,
  ])
  ws["!cols"] = [
    { wch: 28 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Kazıklar")
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}
