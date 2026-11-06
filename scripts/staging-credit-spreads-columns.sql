-- Staging / Preview ONLY — do NOT run against Production in this task.
-- Optional columns for panic_index_history / latest_panic_metrics BBB OAS.
-- HY already uses hy_oas. BBB is stored in panic_metrics EAV (bbbOas) without this migration;
-- apply when history charts need bbb_oas.

-- alter table public.panic_index_history
--   add column if not exists bbb_oas double precision;

-- alter table public.latest_panic_metrics
--   add column if not exists bbb_oas double precision;

-- EAV keys (no DDL): metric_key = 'highYield' | 'bbbOas'
-- status example: 'asOf:2026-11-04'  (FRED observation date)
-- updated_at = collectedAt
