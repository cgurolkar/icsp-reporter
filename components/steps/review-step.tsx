"use client"

import { Typography, Box, Button } from "@mui/material"
import { Save, Print } from "@mui/icons-material"
import { useLanguage } from "@/contexts/language-context"
import type { FormData } from "@/types/form-data"

interface ReviewStepProps {
  data: FormData
  onSubmit: () => void
}

export default function ReviewStep({ data, onSubmit }: ReviewStepProps) {
  const { t } = useLanguage()

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    const printContent = generatePrintableContent(data)

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Günlük Çalışma Raporu - ${data.basicInfo.date}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              font-size: 12px;
              line-height: 1.2;
            }
            
            .page {
              width: 100%;
              min-height: 100vh;
              page-break-after: always;
              background: white;
            }
            
            .page:last-child {
              page-break-after: avoid;
            }
            
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 10px 0;
            }
            
            th, td {
              border: 2px solid #000;
              padding: 6px;
              text-align: left;
              vertical-align: middle;
            }
            
            th {
              background-color: #f0f0f0;
              font-weight: bold;
              text-align: center;
            }
            
            .header {
              background-color: #f0f0f0;
              padding: 15px;
              text-align: center;
              border: 2px solid #000;
              margin-bottom: 15px;
            }
            
            .section-title {
              font-size: 14px;
              font-weight: bold;
              padding: 8px;
              background-color: #f0f0f0;
              border: 1px solid #000;
              margin: 15px 0 5px 0;
            }
            
            .info-box {
              border: 1px solid #000;
              padding: 8px;
              text-align: center;
              min-height: 35px;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            
            .info-label {
              font-size: 10px;
              font-weight: bold;
              margin-bottom: 2px;
            }
            
            .info-value {
              font-size: 14px;
              font-weight: bold;
            }
            
            .notes-box {
              border: 1px solid #000;
              min-height: 60px;
              padding: 8px;
              background: white;
              white-space: pre-wrap;
            }
            
            @media print {
              body { -webkit-print-color-adjust: exact; }
              .page { page-break-after: always; }
              .page:last-child { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `)

    printWindow.document.close()

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 500)
    }
  }

  const generatePrintableContent = (data: FormData) => {
    // Toplamlar için dizi kontrolü ve toplama
    const isArray = Array.isArray(data.productionSummary);
    const totalProduction = isArray
      ? data.productionSummary.reduce((sum: number, m: any) => sum + (parseFloat(m.totalProduction) || 0), 0)
      : data.productionSummary.totalProduction;
    const totalPileCount = isArray
      ? data.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.concretePoured) || 0), 0)
      : data.productionSummary.totalPileCount;
    const dailyPileCount = isArray
      ? data.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.dailyPileCount) || 0), 0)
      : data.productionSummary.dailyPileCount;
    const totalCompletedPiles = isArray
      ? data.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.totalCompletedPiles) || 0), 0)
      : data.productionSummary.totalCompletedPiles;
    const remainingPiles = isArray
      ? data.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.remainingPiles) || 0), 0)
      : data.productionSummary.remainingPiles;
    const steelLoweredPiles = isArray
      ? data.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.steelLoweredPiles) || 0), 0)
      : data.productionSummary.steelLoweredPiles;
    const concretePoured = isArray
      ? data.productionSummary.reduce((sum: number, m: any) => sum + (parseInt(m.concretePoured) || 0), 0)
      : data.productionSummary.concretePoured;

    return `
      <!-- Page 1 - Production Data -->
      <div class="page">
        <div class="header">
          <h1 style="margin: 0; font-size: 18px;">GÜNLÜK ÇALIŞMA RAPORU</h1>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <span style="font-weight: bold;">TARİH: ${data.basicInfo.date}</span>
            <span style="font-weight: bold;">${data.basicInfo.project}</span>
          </div>
        </div>

        <!-- Basic Info -->
        <div class="section-title">TEMEL BİLGİLER</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 15px;">
          <div class="info-box">
            <div class="info-label">MAKİNE SAAT</div>
            <div class="info-value">${Array.isArray(data.basicInfo.machines) ? data.basicInfo.machines.reduce((sum: number, m: any) => sum + (parseFloat(m.machineHours) || 0), 0) : "-"}</div>
          </div>
          <div class="info-box">
            <div class="info-label">TOPLAM İMALAT (M)</div>
            <div class="info-value">${totalProduction}</div>
          </div>
          <div class="info-box">
            <div class="info-label">YAPILAN KAZIK ADEDİ</div>
            <div class="info-value">${totalPileCount}</div>
          </div>
          <div class="info-box">
            <div class="info-label">KAZIK DELİNEN</div>
            <div class="info-value">${Array.isArray(data.basicInfo.machines) ? data.basicInfo.machines.reduce((sum: number, m: any) => sum + (parseFloat(m.note) || 0), 0) : "-"}</div>
          </div>
        </div>

        <!-- Production Summary -->
        <div class="section-title">ÜRETİM ÖZETİ</div>
        <table>
          <tbody>
            <tr><td style="font-weight: bold; background-color: #f0f0f0;">TOPLAM İMALAT (M)</td><td style="text-align: center; font-weight: bold;">${totalProduction}</td></tr>
            <tr><td style="font-weight: bold; background-color: #f0f0f0;">TOPLAM KAZIK SAYISI</td><td style="text-align: center; font-weight: bold;">${totalPileCount}</td></tr>
            <tr><td style="font-weight: bold; background-color: #f0f0f0;">GÜNLÜK YAPILAN KAZIK</td><td style="text-align: center; font-weight: bold;">${dailyPileCount}</td></tr>
            <tr><td style="font-weight: bold; background-color: #f0f0f0;">TOPLAM YAPILAN KAZIK SAYISI</td><td style="text-align: center; font-weight: bold;">${totalCompletedPiles}</td></tr>
            <tr><td style="font-weight: bold; background-color: #f0f0f0;">KALAN KAZIK SAYISI</td><td style="text-align: center; font-weight: bold;">${remainingPiles}</td></tr>
            <tr><td style="font-weight: bold; background-color: #f0f0f0;">DEMİR İNDİRİLEN KAZIK</td><td style="text-align: center; font-weight: bold;">${steelLoweredPiles}</td></tr>
            <tr><td style="font-weight: bold; background-color: #f0f0f0;">BETON DÖKÜLEN KAZIK</td><td style="text-align: center; font-weight: bold;">${concretePoured}</td></tr>
          </tbody>
        </table>

        <!-- Personnel -->
        <div class="section-title">PERSONEL</div>
        <table>
          <thead>
            <tr>
              <th>MÜH</th><th>FORMEN</th><th>OPERATOR</th><th>YAĞCI</th><th>KAYNAKÇI</th><th>DİĞER</th><th>TOPLAM</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center; font-weight: bold;">${data.personnel.engineer}</td>
              <td style="text-align: center; font-weight: bold;">${data.personnel.foreman}</td>
              <td style="text-align: center; font-weight: bold;">${data.personnel.operator}</td>
              <td style="text-align: center; font-weight: bold;">${data.personnel.oiler}</td>
              <td style="text-align: center; font-weight: bold;">${data.personnel.welder}</td>
              <td style="text-align: center; font-weight: bold;">${data.personnel.other}</td>
              <td style="text-align: center; font-weight: bold; background-color: #f0f0f0;">${data.personnel.total}</td>
            </tr>
          </tbody>
        </table>

        <!-- Vehicles -->
        <div class="section-title">ARAÇ - GEREÇ</div>
        <table>
          <thead>
            <tr>
              <th>VİNÇ</th><th>LOADER</th><th>KAMYON</th><th>PICK UP</th><th>BİNEK</th><th>SERVİS</th><th>TOPLAM</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center; font-weight: bold;">${data.vehicles.crane}</td>
              <td style="text-align: center; font-weight: bold;">${data.vehicles.loader}</td>
              <td style="text-align: center; font-weight: bold;">${data.vehicles.truck}</td>
              <td style="text-align: center; font-weight: bold;">${data.vehicles.pickup}</td>
              <td style="text-align: center; font-weight: bold;">${data.vehicles.car}</td>
              <td style="text-align: center; font-weight: bold;">${data.vehicles.service}</td>
              <td style="text-align: center; font-weight: bold; background-color: #f0f0f0;">${data.vehicles.total}</td>
            </tr>
          </tbody>
        </table>

        <!-- Fuel -->
        <div class="section-title">MAKİNE VE ARAÇLAR İÇİN KULLANILAN MAZOT</div>
        <table>
          <thead>
            <tr>
              <th>MAKİNE</th><th>DEVİR</th><th>GELEN</th><th>KALAN</th><th>KULLANILAN</th>
            </tr>
          </thead>
          <tbody>
            ${data.fuel.machines
              .map(
                (machine) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${machine.name}</td>
                <td style="text-align: center; font-weight: bold;">${machine.shift}</td>
                <td style="text-align: center; font-weight: bold;">${machine.incoming}</td>
                <td style="text-align: center; font-weight: bold;">${machine.remaining}</td>
                <td style="text-align: center; font-weight: bold;">${machine.used}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        <!-- Pile Details -->
        <div class="section-title">KAZIK DETAYLARI</div>
        <table>
          <thead>
            <tr><th>KAZIK</th><th>DELİNEN</th><th>NOTLAR</th></tr>
          </thead>
          <tbody>
            ${data.pileDetails
              .filter((pile) => pile.drilled || pile.notes)
              .map(
                (pile) => `
              <tr>
                <td style="text-align: center; font-weight: bold;">${pile.pileNumber}</td>
                <td style="text-align: center;">${pile.drilled}</td>
                <td>${pile.notes}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        ${
          data.notes
            ? `
          <div class="section-title">BAKIM / MALZEME / NOTLAR</div>
          <div class="notes-box">${data.notes}</div>
        `
            : ""
        }
      </div>

      <!-- Page 2 - Expenses -->
      <div class="page">
        <div class="header">
          <h1 style="margin: 0; font-size: 18px;">HARCAMALAR</h1>
          <div style="display: flex; justify-content: space-between; margin-top: 10px;">
            <span style="font-weight: bold;">TARİH: ${data.basicInfo.date}</span>
            <span style="font-weight: bold;">${data.basicInfo.project}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 10%;">#</th>
              <th style="width: 60%;">AÇIKLAMA</th>
              <th style="width: 30%;">TUTAR (IQD)</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: Math.max(15, data.expenses.length) }, (_, index) => {
              const expense = data.expenses[index]
              return `
                <tr>
                  <td style="text-align: center; font-weight: bold;">${index + 1}.</td>
                  <td>${expense?.description || ""}</td>
                  <td style="text-align: right; font-weight: bold;">${expense?.amount ? expense.amount.toLocaleString() : ""}</td>
                </tr>
              `
            }).join("")}
            <tr style="background-color: #f0f0f0;">
              <td colspan="2" style="text-align: center; font-weight: bold;">TOPLAM:</td>
              <td style="text-align: right; font-weight: bold;">${data.expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()} IQD</td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  }

  return (
    <Box sx={{ maxWidth: "100%", mx: "auto" }}>
      {/* Preview Display */}
      <Box sx={{ mb: 4, p: 3, border: "2px dashed #ccc", borderRadius: 2, backgroundColor: "#f9f9f9" }}>
        <Typography variant="h6" gutterBottom sx={{ color: "primary.main", textAlign: "center" }}>
          📄 Form Önizlemesi
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mb: 2 }}>
          Yazdırma ve e-posta gönderimi için hazırlanan form içeriği aşağıdaki gibi olacaktır:
        </Typography>

        {/* Mini Preview */}
        <Box
          sx={{
            border: "1px solid #ddd",
            borderRadius: 1,
            p: 2,
            backgroundColor: "white",
            maxHeight: "300px",
            overflow: "auto",
            fontSize: "0.8rem",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", textAlign: "center", mb: 1 }}>
            GÜNLÜK ÇALIŞMA RAPORU - {data.basicInfo.date}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            📊 Temel Bilgiler: Makine Saat ({data.basicInfo.machineHours}), Toplam İmalat (
            {data.basicInfo.totalProduction})
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            📈 Üretim Özeti: {data.productionSummary.dailyPileCount} günlük kazık
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            👥 Personel: {data.personnel.total} toplam personel
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            🚗 Araç-Gereç: {data.vehicles.total} toplam araç
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            ⛽ Mazot: {data.fuel.machines.length} makine kaydı
          </Typography>
          <Typography variant="body2">
            💰 Harcamalar: {data.expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()} IQD toplam
          </Typography>
        </Box>
      </Box>

      {/* Action Buttons */}
      <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 4 }}>
        <Button
          variant="outlined"
          size="large"
          startIcon={<Print />}
          onClick={handlePrint}
          sx={{
            borderRadius: 3,
            px: 4,
            py: 1.5,
            borderWidth: 2,
            "&:hover": { borderWidth: 2 },
          }}
        >
          PDF Yazdır
        </Button>
        <Button
          variant="contained"
          size="large"
          startIcon={<Save />}
          onClick={onSubmit}
          sx={{
            borderRadius: 3,
            px: 4,
            py: 1.5,
            background: "linear-gradient(135deg, var(--icsp-lacivert) 0%, #0d47a1 100%)",
            boxShadow: "0 4px 15px 0 rgba(26, 35, 126, 0.4)",
            "&:hover": {
              background: "linear-gradient(135deg, #0d47a1 0%, #000051 100%)",
              boxShadow: "0 6px 20px 0 rgba(26, 35, 126, 0.5)",
            },
          }}
        >
          Kaydet
        </Button>
      </Box>
    </Box>
  )
}
