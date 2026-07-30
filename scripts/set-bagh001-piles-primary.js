/**
 * BAGH001 şantiyesindeki tüm work_reports.pile_details satırlarına
 * priceTier = "primary" yazar (eksik diameterRateId varsa şantiyenin ilk aktif tarifesine bağlar).
 *
 * Kullanım:
 *   node scripts/set-bagh001-piles-primary.js           # dry-run (sadece özet)
 *   node scripts/set-bagh001-piles-primary.js --execute  # kalıcı güncelleme
 *   node scripts/set-bagh001-piles-primary.js --execute --exclude-date=2026-07-30
 *
 * Ortam: POSTGRES_* veya DATABASE_URL (.env.local / .env varsa otomatik okunur)
 * Bağlantı: önce `pg` (npm), yoksa `psql` CLI
 */
const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const SITE_CODE = "BAGH001"
const EXECUTE = process.argv.includes("--execute")
const excludeArg = process.argv.find((a) => a.startsWith("--exclude-date="))
const EXCLUDE_DATE = excludeArg
  ? excludeArg.slice("--exclude-date=".length).trim().slice(0, 10)
  : ""
if (EXCLUDE_DATE && !/^\d{4}-\d{2}-\d{2}$/.test(EXCLUDE_DATE)) {
  console.error("Geçersiz --exclude-date=YYYY-MM-DD")
  process.exit(1)
}

function loadEnvLocal() {
  const candidates = [".env.local", ".env", ".env.production", ".env.production.local"]
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

function tryLoadPg() {
  try {
    return require("pg")
  } catch {
    /* ignore */
  }
  const candidates = [
    path.join(process.cwd(), "node_modules", "pg"),
    path.join(__dirname, "..", "node_modules", "pg"),
  ]
  for (const p of candidates) {
    try {
      return require(p)
    } catch {
      /* ignore */
    }
  }
  return null
}

function dbEnv() {
  return {
    user: process.env.POSTGRES_USER || process.env.PGUSER || "postgres",
    host: process.env.POSTGRES_HOST || process.env.PGHOST || "localhost",
    database: process.env.POSTGRES_DB || process.env.PGDATABASE || "work_report_db",
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || "postgres",
    port: String(process.env.POSTGRES_PORT || process.env.PGPORT || "5432"),
    url: process.env.DATABASE_URL || process.env.POSTGRES_URL || "",
  }
}

function runPsql(sql) {
  const env = dbEnv()
  const psqlEnv = { ...process.env, PGPASSWORD: env.password }
  const args = ["-v", "ON_ERROR_STOP=1", "-A", "-F", "\t", "-t"]
  if (env.url) {
    args.push(env.url)
  } else {
    args.push("-h", env.host, "-p", env.port, "-U", env.user, "-d", env.database)
  }
  args.push("-c", sql)

  const r = spawnSync("psql", args, {
    encoding: "utf8",
    env: psqlEnv,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.error) {
    if (r.error.code === "ENOENT") {
      throw new Error(
        "Ne `pg` npm paketi ne de `psql` bulundu.\n" +
          "  npm install pg\n" +
          "  veya: apt install postgresql-client",
      )
    }
    throw r.error
  }
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "psql failed").trim())
  }
  return (r.stdout || "").trim()
}

function parseTsvRows(out) {
  if (!out) return []
  return out.split(/\r?\n/).filter(Boolean).map((line) => line.split("\t"))
}

async function mainWithPg(Pool) {
  const env = dbEnv()
  const pool = env.url
    ? new Pool({ connectionString: env.url })
    : new Pool({
        user: env.user,
        host: env.host,
        database: env.database,
        password: env.password,
        port: parseInt(env.port, 10),
      })
  const client = await pool.connect()
  try {
    const siteRes = await client.query(
      `SELECT id, name, code FROM sites WHERE UPPER(TRIM(code)) = UPPER($1) LIMIT 1`,
      [SITE_CODE],
    )
    if (!siteRes.rows[0]) throw new Error(`Şantiye bulunamadı: ${SITE_CODE}`)
    const site = siteRes.rows[0]
    console.log(`Şantiye: ${site.code} — ${site.name} (id=${site.id})`)

    const rateRes = await client.query(
      `SELECT id, diameter_mm, label
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

    if (EXCLUDE_DATE) console.log(`Hariç tutulan tarih: ${EXCLUDE_DATE}`)

    const preview = await client.query(
      `SELECT wr.id, wr.date,
              COALESCE(jsonb_array_length(wr.pile_details), 0) AS pile_count,
              (
                SELECT COUNT(*)::int
                FROM jsonb_array_elements(COALESCE(wr.pile_details, '[]'::jsonb)) e
                WHERE COALESCE(NULLIF(TRIM(COALESCE(e->>'priceTier', e->>'price_tier', '')), ''), '') <> 'primary'
              ) AS missing_or_other_tier
       FROM work_reports wr
       WHERE wr.site_id = $1
         AND wr.pile_details IS NOT NULL
         AND jsonb_typeof(wr.pile_details) = 'array'
         AND jsonb_array_length(wr.pile_details) > 0
         AND ($2::date IS NULL OR wr.date <> $2::date)
       ORDER BY wr.date ASC, wr.id ASC`,
      [site.id, EXCLUDE_DATE || null],
    )

    const totalReports = preview.rows.length
    const totalPiles = preview.rows.reduce((s, r) => s + Number(r.pile_count || 0), 0)
    const needFix = preview.rows.reduce((s, r) => s + Number(r.missing_or_other_tier || 0), 0)
    console.log(`Rapor sayısı (pile_details dolu): ${totalReports}`)
    console.log(`Toplam pile_details satırı: ${totalPiles}`)
    console.log(`Primary olmayan / boş priceTier satırı: ${needFix}`)

    if (!EXECUTE) {
      console.log(
        "\nDry-run. Uygulamak için: node scripts/set-bagh001-piles-primary.js --execute" +
          (EXCLUDE_DATE ? ` --exclude-date=${EXCLUDE_DATE}` : ""),
      )
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
         AND ($3::date IS NULL OR wr.date <> $3::date)
       RETURNING wr.id, wr.date`,
      [site.id, defaultRateId, EXCLUDE_DATE || null],
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
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

function mainWithPsql() {
  console.log("(pg yok — psql kullanılıyor)")
  if (EXCLUDE_DATE) console.log(`Hariç tutulan tarih: ${EXCLUDE_DATE}`)
  const dateClause = EXCLUDE_DATE ? ` AND wr.date <> DATE '${EXCLUDE_DATE}'` : ""

  const siteRows = parseTsvRows(
    runPsql(
      `SELECT id::text, name, code FROM sites WHERE UPPER(TRIM(code)) = UPPER('${SITE_CODE}') LIMIT 1`,
    ),
  )
  if (!siteRows[0]) throw new Error(`Şantiye bulunamadı: ${SITE_CODE}`)
  const [siteId, siteName, siteCode] = siteRows[0]
  console.log(`Şantiye: ${siteCode} — ${siteName} (id=${siteId})`)

  const rateRows = parseTsvRows(
    runPsql(
      `SELECT id::text, diameter_mm::text, COALESCE(label, '')
       FROM site_pile_rates
       WHERE site_id = ${Number(siteId)} AND is_active = true
       ORDER BY sort_order ASC, diameter_mm ASC, id ASC
       LIMIT 1`,
    ),
  )
  const defaultRateId = rateRows[0]?.[0] ? Number(rateRows[0][0]) : null
  if (defaultRateId != null) {
    console.log(
      `Varsayılan tarife id=${defaultRateId} (Ø${rateRows[0][1]}${rateRows[0][2] ? ` ${rateRows[0][2]}` : ""})`,
    )
  } else {
    console.log("Uyarı: aktif site_pile_rates yok — yalnızca priceTier=primary yazılacak.")
  }

  const summary = parseTsvRows(
    runPsql(
      `SELECT
         COUNT(*)::text,
         COALESCE(SUM(jsonb_array_length(wr.pile_details)), 0)::text,
         COALESCE(SUM((
           SELECT COUNT(*)::int
           FROM jsonb_array_elements(COALESCE(wr.pile_details, '[]'::jsonb)) e
           WHERE COALESCE(NULLIF(TRIM(COALESCE(e->>'priceTier', e->>'price_tier', '')), ''), '') <> 'primary'
         )), 0)::text
       FROM work_reports wr
       WHERE wr.site_id = ${Number(siteId)}
         AND wr.pile_details IS NOT NULL
         AND jsonb_typeof(wr.pile_details) = 'array'
         AND jsonb_array_length(wr.pile_details) > 0
         ${dateClause}`,
    ),
  )[0] || ["0", "0", "0"]

  console.log(`Rapor sayısı (pile_details dolu): ${summary[0]}`)
  console.log(`Toplam pile_details satırı: ${summary[1]}`)
  console.log(`Primary olmayan / boş priceTier satırı: ${summary[2]}`)

  if (!EXECUTE) {
    console.log(
      "\nDry-run. Uygulamak için: node scripts/set-bagh001-piles-primary.js --execute" +
        (EXCLUDE_DATE ? ` --exclude-date=${EXCLUDE_DATE}` : ""),
    )
    return
  }

  const rateLiteral = defaultRateId != null ? String(defaultRateId) : "NULL"
  const updOut = runPsql(
    `WITH updated AS (
       UPDATE work_reports wr
       SET pile_details = (
         SELECT COALESCE(jsonb_agg(
           CASE
             WHEN jsonb_typeof(elem) <> 'object' THEN elem
             ELSE (
               elem
               || jsonb_build_object('priceTier', 'primary')
               || CASE
                    WHEN ${rateLiteral}::int IS NOT NULL
                         AND TRIM(COALESCE(elem->>'diameterRateId', elem->>'diameter_rate_id', '')) = ''
                    THEN jsonb_build_object('diameterRateId', ${rateLiteral}::text)
                    ELSE '{}'::jsonb
                  END
             )
           END
         ), '[]'::jsonb)
         FROM jsonb_array_elements(COALESCE(wr.pile_details, '[]'::jsonb)) AS elem
       ),
       updated_at = CURRENT_TIMESTAMP
       WHERE wr.site_id = ${Number(siteId)}
         AND wr.pile_details IS NOT NULL
         AND jsonb_typeof(wr.pile_details) = 'array'
         AND jsonb_array_length(wr.pile_details) > 0
         ${dateClause}
       RETURNING wr.id, wr.date::text
     )
     SELECT id::text, date FROM updated ORDER BY date, id`,
  )
  const updRows = parseTsvRows(updOut)
  console.log(`\nGüncellenen rapor: ${updRows.length}`)
  for (const r of updRows.slice(0, 20)) {
    console.log(`  - id=${r[0]} date=${String(r[1]).slice(0, 10)}`)
  }
  if (updRows.length > 20) console.log(`  ... +${updRows.length - 20} rapor daha`)
  console.log("Tamam.")
}

async function main() {
  const pg = tryLoadPg()
  if (pg) {
    await mainWithPg(pg.Pool)
  } else {
    mainWithPsql()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exitCode = 1
})
