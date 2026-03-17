/**
 * Envanter_Listesi.xlsx dosyasını veritabanına aktarır.
 * Kullanım: node scripts/import-envanter-excel.js [excel-dosya-yolu]
 * Excel: İlk sayfa, 2. satır başlık (KOD, MALZEME ADI, AÇIKLAMA, ADET, FOTOĞRAF, FİYAT, YER)
 */

const { Pool } = require("pg");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

async function main() {
  const excelPath = process.argv[2] || path.join(process.env.USERPROFILE || "", "Desktop", "Envanter_Listesi.xlsx");
  if (!fs.existsSync(excelPath)) {
    console.error("Dosya bulunamadı:", excelPath);
    process.exit(1);
  }

  const buf = fs.readFileSync(excelPath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  if (data.length < 2) {
    console.error("Excel'de yeterli satır yok.");
    process.exit(1);
  }

  const headerRow = data[1];
  const col = (name) => {
    const n = String(name).toLowerCase().replace(/\s+/g, " ");
    const i = headerRow.findIndex((h) => String(h).toLowerCase().replace(/\s+/g, " ").includes(n) || n.includes(String(h).toLowerCase()));
    return i >= 0 ? i : -1;
  };
  const kodCol = headerRow.findIndex((h) => /KOD/i.test(String(h)));
  const adCol = headerRow.findIndex((h) => /MALZEME\s*ADI|ADI/i.test(String(h)));
  const aciklamaCol = headerRow.findIndex((h) => /AÇIKLAMA/i.test(String(h)));
  const adetCol = headerRow.findIndex((h) => /ADET/i.test(String(h)));
  const fiyatCol = headerRow.findIndex((h) => /FİYAT|FIYAT/i.test(String(h)));
  const yerCol = headerRow.findIndex((h) => /YER/i.test(String(h)));

  const rows = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const kod = kodCol >= 0 ? String(row[kodCol] ?? "").trim() : "";
    const malzeme_adi = adCol >= 0 ? String(row[adCol] ?? "").trim() : "";
    if (!kod && !malzeme_adi) continue;
    rows.push({
      kod: kod || `ENV${String(i).padStart(4, "0")}`,
      malzeme_adi: malzeme_adi || "—",
      aciklama: aciklamaCol >= 0 ? String(row[aciklamaCol] ?? "").trim() || null : null,
      adet: adetCol >= 0 ? (parseInt(row[adetCol], 10) || 1) : 1,
      fiyat: fiyatCol >= 0 ? (parseFloat(String(row[fiyatCol]).replace(",", ".")) || null) : null,
      yer: yerCol >= 0 ? String(row[yerCol] ?? "").trim() || null : null,
    });
  }

  console.log("Excel okunuyor:", excelPath, "Satır:", rows.length);
  if (rows.length === 0) {
    console.log("İçe aktarılacak kayıt yok.");
    process.exit(0);
  }

  const pool = new Pool({
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    database: process.env.POSTGRES_DB || "work_report_db",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  });

  const client = await pool.connect();
  let inserted = 0;
  let failed = 0;

  try {
    for (const r of rows) {
      try {
        await client.query(
          `INSERT INTO envanter (kod, malzeme_adi, aciklama, adet, fiyat, yer)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (kod) DO UPDATE SET malzeme_adi = EXCLUDED.malzeme_adi, aciklama = EXCLUDED.aciklama, adet = EXCLUDED.adet, fiyat = EXCLUDED.fiyat, yer = EXCLUDED.yer, updated_at = CURRENT_TIMESTAMP`,
          [r.kod, r.malzeme_adi, r.aciklama, r.adet, r.fiyat, r.yer]
        );
        inserted++;
      } catch (err) {
        console.error("Satır eklenemedi:", r.kod, r.malzeme_adi, err.message);
        failed++;
      }
    }
    console.log("Tamamlandı. Eklenen/güncellenen:", inserted, "Hata:", failed);
  } finally {
    client.release();
    pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
