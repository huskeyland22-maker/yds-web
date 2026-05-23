-- 패닉 V2 실전 엔진 입력 지표 (기존 행·컬럼 유지)
ALTER TABLE IF EXISTS public.panic_history_v2
  ADD COLUMN IF NOT EXISTS vvix numeric,
  ADD COLUMN IF NOT EXISTS vix_term numeric,
  ADD COLUMN IF NOT EXISTS ndx_distance numeric,
  ADD COLUMN IF NOT EXISTS soxx_distance numeric,
  ADD COLUMN IF NOT EXISTS dxy numeric;

ALTER TABLE IF EXISTS public.panic_index_history_v2
  ADD COLUMN IF NOT EXISTS vvix numeric,
  ADD COLUMN IF NOT EXISTS vix_term numeric,
  ADD COLUMN IF NOT EXISTS ndx_distance numeric,
  ADD COLUMN IF NOT EXISTS soxx_distance numeric,
  ADD COLUMN IF NOT EXISTS dxy numeric;
