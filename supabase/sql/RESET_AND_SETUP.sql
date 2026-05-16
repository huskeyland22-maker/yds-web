-- =============================================================================
-- ⚠️ 전체 초기화 후 재생성 (기존 데이터 삭제됨)
-- 테이블이 없거나 깨진 schema 일 때만 사용
-- =============================================================================

drop table if exists public.ai_reports cascade;
drop table if exists public.market_status cascade;
drop table if exists public.panic_index_history cascade;
drop table if exists public.panic_metrics cascade;

-- 이어서 YDS_FULL_SETUP.sql 전체를 실행하세요.
