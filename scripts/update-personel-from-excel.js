/**
 * Kitap1 (veya benzeri) Excel'den mevcut personellerin ücret, işe giriş/çıkış ve çalıştığı birim bilgilerini günceller.
 * Ad + Soyad ile eşleşen kayıtlar güncellenir.
 * Kullanım: node scripts/update-personel-from-excel.js [excel-dosya-yolu]
 * Örnek: node scripts/update-personel-from-excel.js "C:\Users\VICTUS\Desktop\Kitap1.xlsx"
 */

const { Pool } = require("pg");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const HEADER_ALIASES = {
  ad: "ad",
  soyad: "soyad",
  gorev: "gorev",
  görev: "gorev",
  "işe başlama": "ise_giris_tarihi",
  "ise baslama": "ise_giris_tarihi",
  "işten çıkış": "isten_cikis_tarihi",
  "isten cikis": "isten_cikis_tarihi",
  "işten çıkış tarihi": "isten_cikis_tarihi",
  "aylık ücreti": "aylik_maas",
  "aylik ucreti": "aylik_maas",
  görevi: "gorev",
  gorevi: "gorev",
  "personel adi ve soyadi": "ad_soyad",
  "personel adı ve soyadı": "ad_soyad",
  "adi ve soyadi": "ad_soyad",
  "adı ve soyadı": "ad_soyad",
  "ad soyad": "ad_soyad",
  birimi: "calistigi_bolum",
  birim: "calistigi_bolum",
  "çalıştığı bölüm": "calistigi_bolum",
  "calistigi bolum": "calistigi_bolum",
  bölüm: "calistigi_bolum",
  bolum: "calistigi_bolum",
};

function normalizeHeader(h) {
  return String(h ?? "").replace(/\r\n/g, " ").trim().toLowerCase().replace(/\s+/g, " ");
}

function mapHeader(header) {
  return HEADER_ALIASES[normalizeHeader(header)] ?? null;
}

function toDateStr(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s.slice(0, 10);
  }
  if (typeof v === "number" && v > 0) {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function toNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function toStr(v) {
  return v == null ? "" : String(v).trim();
}

function parseExcel(filePath) {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const data = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { header: 1, defval: "" });
  if (data.length < 2) return [];

  const headerRow = data[0];
  const colToField = headerRow.map((h) => mapHeader(h));
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record = {};
    for (let c = 0; c < colToField.length; c++) {
      const field = colToField[c];
      if (!field) continue;
      const raw = row[c];
      if (field === "ad_soyad") {
        record.ad_soyad = toStr(raw);
      } else if (field === "ad" || field === "soyad" || field === "gorev" || field === "calistigi_bolum") {
        record[field] = toStr(raw);
      } else if (field === "ise_giris_tarihi" || field === "isten_cikis_tarihi") {
        record[field] = toDateStr(raw);
      } else if (field === "aylik_maas") {
        record[field] = toNum(raw);
      }
    }
    let ad = toStr(record.ad);
    let soyad = toStr(record.soyad);
    if (record.ad_soyad) {
      const parts = String(record.ad_soyad).trim().split(/\s+/);
      if (parts.length >= 2) {
        ad = parts[0];
        soyad = parts.slice(1).join(" ");
      } else if (parts.length === 1 && parts[0]) {
        ad = parts[0];
      }
    }
    if (!ad && !soyad) continue;
    rows.push({
      ad: ad || "—",
      soyad: soyad || "—",
      gorev: toStr(record.gorev) || null,
      ise_giris_tarihi: record.ise_giris_tarihi || null,
      isten_cikis_tarihi: record.isten_cikis_tarihi || null,
      aylik_maas: record.aylik_maas ?? null,
      calistigi_bolum: record.calistigi_bolum || null,
    });
  }
  return rows;
}

async function main() {
  const excelPath = process.argv[2] || path.join(process.env.USERPROFILE || "", "Desktop", "Kitap1.xlsx");
  if (!fs.existsSync(excelPath)) {
    console.error("Dosya bulunamadı:", excelPath);
    process.exit(1);
  }

  console.log("Excel okunuyor:", excelPath);
  const rows = parseExcel(excelPath);
  console.log("Satır sayısı:", rows.length);
  if (rows.length === 0) {
    console.log("Güncellenecek kayıt yok.");
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
  let updated = 0;
  let notFound = 0;

  try {
    for (const r of rows) {
      const result = await client.query(
        `UPDATE personeller SET
          ise_giris_tarihi = COALESCE($2, ise_giris_tarihi),
          isten_cikis_tarihi = COALESCE($3, isten_cikis_tarihi),
          aylik_maas = COALESCE($4, aylik_maas),
          calistigi_bolum = COALESCE($5, calistigi_bolum),
          gorev = COALESCE(NULLIF(TRIM($6), ''), gorev),
          updated_at = CURRENT_TIMESTAMP
         WHERE TRIM(ad) = TRIM($1) AND TRIM(soyad) = TRIM($7)
         RETURNING id`,
        [r.ad, r.ise_giris_tarihi, r.isten_cikis_tarihi, r.aylik_maas, r.calistigi_bolum, r.gorev, r.soyad]
      );
      if (result.rowCount > 0) {
        updated++;
      } else {
        notFound++;
      }
    }
    console.log("Tamamlandı. Güncellenen:", updated, "Eşleşmeyen:", notFound);
  } finally {
    client.release();
    pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
