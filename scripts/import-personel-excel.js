/**
 * Tek seferlik: Excel dosyasındaki personel listesini veritabanına ekler.
 * Kullanım: node scripts/import-personel-excel.js [excel-dosya-yolu]
 * Örnek: node scripts/import-personel-excel.js "C:\Users\VICTUS\Desktop\Kitap1.xlsx"
 *
 * Ortam değişkenleri: POSTGRES_USER, POSTGRES_HOST, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_PORT
 * (lib/database.ts ile aynı)
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
  tc: "tc_kimlik",
  "tc kimlik": "tc_kimlik",
  "t.c.": "tc_kimlik",
  "tc no": "tc_kimlik",
  tc_no: "tc_kimlik",
  dogum_tarihi: "dogum_tarihi",
  "doğum tarihi": "dogum_tarihi",
  dogum: "dogum_tarihi",
  kan_grubu: "kan_grubu",
  "kan grubu": "kan_grubu",
  acil_iletisim: "acil_iletisim",
  "acil iletişim": "acil_iletisim",
  acil_telefon: "acil_telefon",
  "acil telefon": "acil_telefon",
  telefon: "acil_telefon",
  cep: "acil_telefon",
  ise_giris_tarihi: "ise_giris_tarihi",
  "işe giriş": "ise_giris_tarihi",
  "işe giriş tarihi": "ise_giris_tarihi",
  "ise giris": "ise_giris_tarihi",
  sigorta_durumu: "sigorta_durumu",
  "sigorta durumu": "sigorta_durumu",
  sigorta: "sigorta_durumu",
  iban: "iban",
  banka_adi: "banka_adi",
  "banka adı": "banka_adi",
  banka: "banka_adi",
  gunluk_yevmiye: "gunluk_yevmiye",
  "günlük yevmiye": "gunluk_yevmiye",
  yevmiye: "gunluk_yevmiye",
  aylik_maas: "aylik_maas",
  "aylık maaş": "aylik_maas",
  maas: "aylik_maas",
  maaş: "aylik_maas",
  "aylık ücreti": "aylik_maas",
  "aylik ucreti": "aylik_maas",
  ücret: "aylik_maas",
  ucret: "aylik_maas",
  görevi: "gorev",
  gorevi: "gorev",
  "işe başlama": "ise_giris_tarihi",
  "ise baslama": "ise_giris_tarihi",
  "personel adi ve soyadi": "ad_soyad",
  "personel adı ve soyadı": "ad_soyad",
  "adi ve soyadi": "ad_soyad",
  "adı ve soyadı": "ad_soyad",
  "ad soyad": "ad_soyad",
  pasaport_no: "pasaport_no",
  "pasaport no": "pasaport_no",
  pasaport: "pasaport_no",
  "işten çıkış": "isten_cikis_tarihi",
  "isten cikis": "isten_cikis_tarihi",
  "işten çıkış tarihi": "isten_cikis_tarihi",
  "isten cikis tarihi": "isten_cikis_tarihi",
  "çalıştığı bölüm": "calistigi_bolum",
  "calistigi bolum": "calistigi_bolum",
  bölüm: "calistigi_bolum",
  bolum: "calistigi_bolum",
  birimi: "calistigi_bolum",
  birim: "calistigi_bolum",
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
  if (data.length < 2) {
    if (data.length === 1) console.log("Excel ilk satır (başlıklar):", JSON.stringify(data[0]));
    return [];
  }

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
      } else if (field === "ad" || field === "soyad" || field === "gorev" || field === "tc_kimlik" || field === "pasaport_no" || field === "calistigi_bolum") {
        record[field] = toStr(raw);
      } else if (field === "dogum_tarihi" || field === "ise_giris_tarihi" || field === "isten_cikis_tarihi") {
        record[field] = toDateStr(raw);
      } else if (field === "gunluk_yevmiye" || field === "aylik_maas") {
        record[field] = toNum(raw);
      } else {
        record[field] = toStr(raw) || null;
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
      gorev: toStr(record.gorev) || "İşçi",
      tc_kimlik: record.tc_kimlik || null,
      pasaport_no: record.pasaport_no || null,
      calistigi_bolum: record.calistigi_bolum || null,
      dogum_tarihi: record.dogum_tarihi || null,
      kan_grubu: record.kan_grubu || null,
      acil_iletisim: record.acil_iletisim || null,
      acil_telefon: record.acil_telefon || null,
      ise_giris_tarihi: record.ise_giris_tarihi || null,
      isten_cikis_tarihi: record.isten_cikis_tarihi || null,
      sigorta_durumu: record.sigorta_durumu || null,
      iban: record.iban || null,
      banka_adi: record.banka_adi || null,
      gunluk_yevmiye: record.gunluk_yevmiye ?? null,
      aylik_maas: record.aylik_maas ?? null,
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
          `INSERT INTO personeller (ad, soyad, tc_kimlik, pasaport_no, dogum_tarihi, kan_grubu, acil_iletisim, acil_telefon, gorev, ise_giris_tarihi, isten_cikis_tarihi, calistigi_bolum, sigorta_durumu, iban, banka_adi, gunluk_yevmiye, aylik_maas)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            r.ad,
            r.soyad,
            r.tc_kimlik,
            r.pasaport_no,
            r.dogum_tarihi,
            r.kan_grubu,
            r.acil_iletisim,
            r.acil_telefon,
            r.gorev,
            r.ise_giris_tarihi,
            r.isten_cikis_tarihi,
            r.calistigi_bolum,
            r.sigorta_durumu,
            r.iban,
            r.banka_adi,
            r.gunluk_yevmiye,
            r.aylik_maas,
          ]
        );
        inserted++;
      } catch (err) {
        console.error("Satır eklenemedi:", r.ad, r.soyad, err.message);
        failed++;
      }
    }
    console.log("Tamamlandı. Eklenen:", inserted, "Hata:", failed);
  } finally {
    client.release();
    pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
