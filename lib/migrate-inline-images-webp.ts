import type { PoolClient } from "pg"
import { convertImageDataUrlToWebp, isInlineImageNeedingWebpConversion } from "@/lib/image-webp-server"

export type MigrateWebpBatchResult = {
  table: string
  scanned: number
  updated: number
  skipped: number
  errors: string[]
}

async function convertIfNeeded(s: string | null): Promise<{ next: string | null; changed: boolean }> {
  if (s == null || s === "") return { next: s, changed: false }
  if (!isInlineImageNeedingWebpConversion(s)) return { next: s, changed: false }
  const out = await convertImageDataUrlToWebp(s)
  if (out == null) return { next: s, changed: false }
  return { next: out, changed: true }
}

/** daily_images JSONB: string[] */
function parseDailyImages(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string")
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : []
    } catch {
      return []
    }
  }
  return []
}

export async function migrateWorkReportsImagesBatch(client: PoolClient, limit: number): Promise<MigrateWebpBatchResult> {
  const errors: string[] = []
  const res = await client.query<{
    id: number
    daily_image1: string | null
    daily_image2: string | null
    daily_images: unknown
  }>(
    `SELECT id, daily_image1, daily_image2, daily_images
     FROM work_reports
     WHERE daily_image1 LIKE 'data:image/%'
        OR daily_image2 LIKE 'data:image/%'
        OR (daily_images IS NOT NULL AND jsonb_typeof(daily_images) = 'array' AND jsonb_array_length(daily_images) > 0)
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  )
  let updated = 0
  let skipped = 0
  for (const row of res.rows) {
    try {
      let c1 = row.daily_image1
      let c2 = row.daily_image2
      let arr = parseDailyImages(row.daily_images)
      let anyChange = false

      const r1 = await convertIfNeeded(c1)
      if (r1.changed) {
        c1 = r1.next
        anyChange = true
      }
      const r2 = await convertIfNeeded(c2)
      if (r2.changed) {
        c2 = r2.next
        anyChange = true
      }
      const newArr: string[] = []
      for (const item of arr) {
        const r = await convertIfNeeded(item)
        if (r.changed) anyChange = true
        newArr.push(r.next ?? item)
      }
      if (!anyChange) {
        skipped++
        continue
      }
      await client.query(
        `UPDATE work_reports
         SET daily_image1 = $1, daily_image2 = $2, daily_images = $3::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [c1, c2, JSON.stringify(newArr), row.id]
      )
      updated++
    } catch (e) {
      errors.push(`work_reports id=${row.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { table: "work_reports", scanned: res.rows.length, updated, skipped, errors }
}

export async function migrateOperatorEntriesImagesBatch(client: PoolClient, limit: number): Promise<MigrateWebpBatchResult> {
  const errors: string[] = []
  const res = await client.query<{ id: number; image1: string | null; image2: string | null }>(
    `SELECT id, image1, image2 FROM operator_entries
     WHERE image1 LIKE 'data:image/%' OR image2 LIKE 'data:image/%'
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  )
  let updated = 0
  let skipped = 0
  for (const row of res.rows) {
    try {
      const r1 = await convertIfNeeded(row.image1)
      const r2 = await convertIfNeeded(row.image2)
      if (!r1.changed && !r2.changed) {
        skipped++
        continue
      }
      await client.query(`UPDATE operator_entries SET image1 = $1, image2 = $2 WHERE id = $3`, [
        r1.next,
        r2.next,
        row.id,
      ])
      updated++
    } catch (e) {
      errors.push(`operator_entries id=${row.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { table: "operator_entries", scanned: res.rows.length, updated, skipped, errors }
}

export async function migratePersonelFotoBatch(client: PoolClient, limit: number): Promise<MigrateWebpBatchResult> {
  const errors: string[] = []
  const res = await client.query<{ id: number; foto_yolu: string | null }>(
    `SELECT id, foto_yolu FROM personeller
     WHERE foto_yolu LIKE 'data:image/%'
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  )
  let updated = 0
  let skipped = 0
  for (const row of res.rows) {
    try {
      const r = await convertIfNeeded(row.foto_yolu)
      if (!r.changed) {
        skipped++
        continue
      }
      await client.query(`UPDATE personeller SET foto_yolu = $1 WHERE id = $2`, [r.next, row.id])
      updated++
    } catch (e) {
      errors.push(`personeller id=${row.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { table: "personeller", scanned: res.rows.length, updated, skipped, errors }
}

export async function migrateEnvanterFotoBatch(client: PoolClient, limit: number): Promise<MigrateWebpBatchResult> {
  const errors: string[] = []
  const res = await client.query<{ id: number; fotograf_yolu: string | null }>(
    `SELECT id, fotograf_yolu FROM envanter
     WHERE fotograf_yolu LIKE 'data:image/%'
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  )
  let updated = 0
  let skipped = 0
  for (const row of res.rows) {
    try {
      const r = await convertIfNeeded(row.fotograf_yolu)
      if (!r.changed) {
        skipped++
        continue
      }
      await client.query(`UPDATE envanter SET fotograf_yolu = $1 WHERE id = $2`, [r.next, row.id])
      updated++
    } catch (e) {
      errors.push(`envanter id=${row.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { table: "envanter", scanned: res.rows.length, updated, skipped, errors }
}
