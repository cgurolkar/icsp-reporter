import * as XLSX from "xlsx"

/**
 * "GENEL KASA RAPORU" şemasına uyumlu şablon.
 * Import yalnızca Tediyeler (gider) sütunlarını okur.
 * Sütunlar: Tarih | C/H | Fat.No | Açıklama | Detay | Tah.USD | Tah.IQD | Ted.USD | Ted.IQD
 */
export function buildHarcamaTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new()

  // Üst bilgi + başlık satırları; veri satırları tarih içeren satırlardan itibaren okunur
  const rows: (string | number | Date | null)[][] = [
    ["GENEL KASA RAPORU"],
    [],
    ["Şantiye:", "(şablon — aktarımda şantiye seçilir)"],
    [],
    [],
    [],
    [],
    ["Tarih", "C/H", "Fat. No", "Açıklama", "Detay", "Tahsilat USD", "Tahsilat IQD", "Tediye USD", "Tediye IQD"],
    ["", "", "", "", "", "USD", "IQD", "USD", "IQD"],
    // Örnek tediye satırları (aktarım için doldurun / çoğaltın)
    [new Date(2026, 0, 15), "ICS", "F-001", "Yemek", "Öğle yemeği", null, null, 45.5, null],
    [new Date(2026, 0, 16), "ICS", "", "Mazot", "Jeneratör", null, null, 120, null],
    [new Date(2026, 0, 17), "ICS", "F-002", "Sarf", "Malzeme", null, null, null, 150000],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 10 },
    { wch: 16 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, "Kasa")
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }))
}
