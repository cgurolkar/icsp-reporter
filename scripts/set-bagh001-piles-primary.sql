-- BAGH001: mevcut pile_details satırlarını primary (1. fiyat) olarak işaretle.
-- diameterRateId boşsa şantiyenin ilk aktif tarifesine bağlar.
-- Önce SELECT ile kontrol edin; ardından UPDATE bloğunu çalıştırın.

-- Önizleme
SELECT wr.id, wr.date, jsonb_array_length(wr.pile_details) AS piles
FROM work_reports wr
JOIN sites s ON s.id = wr.site_id
WHERE UPPER(TRIM(s.code)) = 'BAGH001'
  AND wr.pile_details IS NOT NULL
  AND jsonb_typeof(wr.pile_details) = 'array'
ORDER BY wr.date, wr.id;

-- Güncelleme
WITH site AS (
  SELECT id FROM sites WHERE UPPER(TRIM(code)) = 'BAGH001' LIMIT 1
),
rate AS (
  SELECT spr.id
  FROM site_pile_rates spr
  JOIN site ON site.id = spr.site_id
  WHERE spr.is_active = true
  ORDER BY spr.sort_order, spr.diameter_mm, spr.id
  LIMIT 1
)
UPDATE work_reports wr
SET pile_details = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN jsonb_typeof(elem) <> 'object' THEN elem
      ELSE (
        elem
        || jsonb_build_object('priceTier', 'primary')
        || CASE
             WHEN (SELECT id FROM rate) IS NOT NULL
                  AND TRIM(COALESCE(elem->>'diameterRateId', elem->>'diameter_rate_id', '')) = ''
             THEN jsonb_build_object('diameterRateId', (SELECT id::text FROM rate))
             ELSE '{}'::jsonb
           END
      )
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(wr.pile_details, '[]'::jsonb)) AS elem
),
updated_at = CURRENT_TIMESTAMP
WHERE wr.site_id = (SELECT id FROM site)
  AND wr.pile_details IS NOT NULL
  AND jsonb_typeof(wr.pile_details) = 'array'
  AND jsonb_array_length(wr.pile_details) > 0;
