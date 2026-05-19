-- 패닉 히스토리 누적 검증 (Supabase SQL Editor에서 실행)
-- 완료 조건: 날짜 중복 0, latest ↔ history 일치, market_cycle 존재, 일별 누적

-- 1) 최근 30일 샘플 (날짜 중복 없이 내림차순)
SELECT
  date,
  vix,
  fear_greed,
  put_call,
  panic_score,
  created_at
FROM public.panic_index_history
ORDER BY date DESC
LIMIT 30;

-- 2) 중복 검사 — 반드시 0 row
SELECT
  date,
  COUNT(*) AS cnt
FROM public.panic_index_history
GROUP BY date
HAVING COUNT(*) > 1;

-- 3) 최신 스냅샷 vs 히스토리 최상단
SELECT * FROM public.latest_panic_metrics;

SELECT *
FROM public.panic_index_history
ORDER BY date DESC
LIMIT 1;

-- 4) market_cycle_history
SELECT
  date,
  market_state,
  risk_signal,
  short_score,
  mid_score,
  long_score
FROM public.market_cycle_history
ORDER BY date DESC
LIMIT 30;

-- 5) 총 누적 일수
SELECT COUNT(*) AS total_rows FROM public.panic_index_history;
SELECT COUNT(DISTINCT date) AS unique_days FROM public.panic_index_history;
