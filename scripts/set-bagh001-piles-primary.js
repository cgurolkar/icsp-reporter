/**
 * BAGH001 şantiyesindeki tüm work_reports.pile_details satırlarına
 * priceTier = "primary" yazar (eksik diameterRateId varsa şantiyenin ilk aktif tarifesine bağlar).
 *
 * Kullanım:
 *   node scripts/set-bagh001-piles-primary.js           # dry-run (sadece özet)
 *   node scripts/set-bagh001-piles-primary.js --execute  # kalıcı güncelleme
 *
 * Ortam: POSTGRES_* veya DATABASE_URL (.env.local varsa otomatik okunur)
 */
const fs = require("fs")
const path = require("path")
const { Pool } = require("pg")

const SITE_CODE = "BAGH001"
const EXECUTE = process.argv.includes("--execute")

function loadEnvLocal() {
  const candidates = [".env.local", ".env"]
  for (const name of candidates) {
    const p = path.join(process.cwd(), name)
    if (!fs.existsSync(p)) continue
    const text = fs.readFileSync(p, "utf8")
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const i = t.indexOf("=")
      if (i <= 0) continue
      const key = t.slice(0, i).trim()
      let val = t.slice(i + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] == null) process.env[key] = val
    }
  }
}

loadEnvLocal()

function makePool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return new Pool({
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "localhost",
    database: process.env.POSTGRES_DB || "work_report_db",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  })
}

async function main() {
  const pool = makePool()
  const client = await pool.connect()
  try {
    const siteRes = await client.query(
      `SELECT id, name, code FROM sites WHERE UPPER(TRIM(code)) = UPPER($1) LIMIT 1`,
      [SITE_CODE],
    )
    if (!siteRes.rows[0]) {
      throw new Error(`Şantiye bulunamadı: ${SITE_CODE}`)
    }
    const site = siteRes.rows[0]
    console.log(`Şantiye: ${site.code} — ${site.name} (id=${site.id})`)

    const rateRes = await client.query(
      `SELECT id, diameter_mm, label, price_primary, price_secondary
       FROM site_pile_rates
       WHERE site_id = $1 AND is_active = true
       ORDER BY sort_order ASC, diameter_mm ASC, id ASC
       LIMIT 1`,
      [site.id],
    )
    const defaultRateId = rateRes.rows[0]?.id != null ? Number(rateRes.rows[0].id) : null
    if (defaultRateId != null) {
      console.log(
        `Varsayılan tarife id=${defaultRateId} (Ø${rateRes.rows[0].diameter_mm}${rateRes.rows[0].label ? ` ${rateRes.rows[0].label}` : ""})`,
      )
    } else {
      console.log("Uyarı: aktif site_pile_rates yok — yalnızca priceTier=primary yazılacak.")
    }

    const preview = await client.query(
      `SELECT wr.id, wr.date,
              COALESCE(jsonb_array_length(wr.pile_details), 0) AS pile_count,
              (
                SELECT COUNT(*)::int
                FROM jsonb_array_elements(COALESCE(wr.pile_details, '[]'::jsonb)) e
                WHERE COALESCE(e->>'priceTier', e->>'price_tier', '') NOT IN ('primary')
                   OR COALESCE(e->>'priceTier', e->>'price_tier') IS NULL
                   OR COALESCE(e->>'priceTier', e->>'price_tier') = ''
              ) AS missing_or_other_tier
       FROM work_reports wr
       WHERE wr.site_id = $1
         AND wr.pile_details IS NOT NULL
         AND jsonb_typeof(wr.pile_details) = 'array'
         AND jsonb_array_length(wr.pile_details) > 0
       ORDER BY wr.date ASC, wr.id ASC`,
      [site.id],
    )

    const totalReports = preview.rows.length
    const totalPiles = preview.rows.reduce((s, r) => s + Number(r.pile_count || 0), 0)
    const needFix = preview.rows.reduce((s, r) => s + Number(r.missing_or_other_tier || 0), 0)
    console.log(`Rapor sayısı (pile_details dolu): ${totalReports}`)
    console.log(`Toplam pile_details satırı: ${totalPiles}`)
    console.log(`Primary olmayan / boş priceTier satırı: ${needFix}`)

    if (!EXECUTE) {
      console.log("\nDry-run. Uygulamak için: node scripts/set-bagh001-piles-primary.js --execute")
      return
    }

    await client.query("BEGIN")
    const upd = await client.query(
      `UPDATE work_reports wr
       SET pile_details = (
         SELECT COALESCE(jsonb_agg(
           CASE
             WHEN jsonb_typeof(elem) <> 'object' THEN elem
             ELSE (
               elem
               || jsonb_build_object('priceTier', 'primary')
               || CASE
                    WHEN $2::int IS NOT NULL
                         AND TRIM(COALESCE(elem->>'diameterRateId', elem->>'diameter_rate_id', '')) = ''
                    THEN jsonb_build_object('diameterRateId', $2::text)
                    ELSE '{}'::jsonb
                  END
             )
           END
         ), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(wr.pile_details, '[]'::jsonb)) AS elem
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE wr.site_id = $1
         AND wr.pile_details IS NOT NULL
         AND jsonb_typeof(wr.pile_details) = 'array'
         AND jsonb_array_length(wr.pile_details) > 0
       RETURNING wr.id, wr.date`,
      [site.id, defaultRateId],
    )
    await client.query("COMMIT")
    console.log(`\nGüncellenen rapor: ${upd.rowCount}`)
    for (const r of upd.rows.slice(0, 20)) {
      console.log(`  - id=${r.id} date=${String(r.date).slice(0, 10)}`)
    }
    if (upd.rowCount > 20) console.log(`  ... +${upd.rowCount - 20} rapor daha`)
    console.log("Tamam.")
  } catch (err) {
    try {
      await client.query("ROLLBACK")
    } catch {
      /* ignore */
    }
    console.error(err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
