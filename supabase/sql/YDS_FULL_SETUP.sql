-- =============================================================================
-- YDS Supabase — SQL Editor 전체 스크립트 (한 번에 Run)
-- Dashboard → SQL Editor → New query → 붙여넣기 → Run
--
-- 앱 호환 컬럼명 (중요):
--   panic_metrics      → metric_key, metric_value  (metric_name 아님)
--   panic_index_history → date, vix, fear_greed, hy_oas …
--   market_status      → market, metric_name, value, status, signal
--   ai_reports         → report_key, title, content (jsonb), signal
-- =============================================================================

-- 0) API roles
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) panic_metrics — 실시간 패닉 지표 (1 metric_key = 1 row)
--    앱: from('panic_metrics').select('*') · /api/panic/latest
-- ---------------------------------------------------------------------------
create table if not exists public.panic_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null unique,          -- 앱 식별자: vix, fearGreed, putCall …
  metric_value double precision,            -- 사용자 예시의 "value"
  change_percent double precision,
  status text,                              -- risk_regime 행의 signal 역할
  market text not null default 'global',
  source text not null default 'yds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.panic_metrics.metric_key is 'App field (not metric_name)';
comment on column public.panic_metrics.metric_value is 'App field (not value)';

create index if not exists panic_metrics_updated_at_idx on public.panic_metrics (updated_at desc);
create index if not exists panic_metrics_market_idx on public.panic_metrics (market);

drop trigger if exists trg_panic_metrics_updated_at on public.panic_metrics;
create trigger trg_panic_metrics_updated_at
  before update on public.panic_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) panic_index_history — 일별 스냅샷 (PK = date)
-- ---------------------------------------------------------------------------
create table if not exists public.panic_index_history (
  date date primary key,
  vix double precision,
  vxn double precision,
  fear_greed double precision,
  put_call double precision,                -- 선택 컬럼 (앱은 panic_metrics.putCall 사용)
  move double precision,
  bofa double precision,
  skew double precision,
  hy_oas double precision,                  -- 앱 highYield
  gs_sentiment double precision,
  market text not null default 'global',
  source text not null default 'yds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panic_index_history_date_desc_idx
  on public.panic_index_history (date desc);

drop trigger if exists trg_panic_index_history_updated_at on public.panic_index_history;
create trigger trg_panic_index_history_updated_at
  before update on public.panic_index_history
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3) market_status — 사이클 / 리스크 상태
-- ---------------------------------------------------------------------------
create table if not exists public.market_status (
  id uuid primary key default gen_random_uuid(),
  market text not null default 'global',
  metric_name text not null,
  value double precision,
  signal text,
  status text,                              -- 예: active
  risk_level text,                          -- 예: medium
  commentary text,
  source text not null default 'yds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, metric_name)
);

create index if not exists market_status_updated_at_idx on public.market_status (updated_at desc);

drop trigger if exists trg_market_status_updated_at on public.market_status;
create trigger trg_market_status_updated_at
  before update on public.market_status
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) ai_reports — AI 브리핑 / 리포트
-- ---------------------------------------------------------------------------
create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  market text not null default 'global',
  metric_name text,
  title text,
  content jsonb not null default '{}'::jsonb,
  sector text,
  signal text,
  status text not null default 'published',
  source text not null default 'yds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_reports_updated_at_idx on public.ai_reports (updated_at desc);

drop trigger if exists trg_ai_reports_updated_at on public.ai_reports;
create trigger trg_ai_reports_updated_at
  before update on public.ai_reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5) Row Level Security
--    - anon + authenticated: SELECT (모바일/PWA read)
--    - authenticated: INSERT / UPDATE
--    - service_role (Vercel API): RLS bypass
-- ---------------------------------------------------------------------------
alter table public.panic_metrics enable row level security;
alter table public.panic_index_history enable row level security;
alter table public.market_status enable row level security;
alter table public.ai_reports enable row level security;

-- panic_metrics
drop policy if exists "panic_metrics_select_public" on public.panic_metrics;
create policy "panic_metrics_select_public"
  on public.panic_metrics for select to anon, authenticated using (true);

drop policy if exists "panic_metrics_insert_auth" on public.panic_metrics;
create policy "panic_metrics_insert_auth"
  on public.panic_metrics for insert to authenticated with check (true);

drop policy if exists "panic_metrics_update_auth" on public.panic_metrics;
create policy "panic_metrics_update_auth"
  on public.panic_metrics for update to authenticated using (true) with check (true);

-- panic_index_history
drop policy if exists "panic_index_history_select_public" on public.panic_index_history;
create policy "panic_index_history_select_public"
  on public.panic_index_history for select to anon, authenticated using (true);

drop policy if exists "panic_index_history_insert_auth" on public.panic_index_history;
create policy "panic_index_history_insert_auth"
  on public.panic_index_history for insert to authenticated with check (true);

drop policy if exists "panic_index_history_update_auth" on public.panic_index_history;
create policy "panic_index_history_update_auth"
  on public.panic_index_history for update to authenticated using (true) with check (true);

-- market_status
drop policy if exists "market_status_select_public" on public.market_status;
create policy "market_status_select_public"
  on public.market_status for select to anon, authenticated using (true);

drop policy if exists "market_status_insert_auth" on public.market_status;
create policy "market_status_insert_auth"
  on public.market_status for insert to authenticated with check (true);

drop policy if exists "market_status_update_auth" on public.market_status;
create policy "market_status_update_auth"
  on public.market_status for update to authenticated using (true) with check (true);

-- ai_reports
drop policy if exists "ai_reports_select_public" on public.ai_reports;
create policy "ai_reports_select_public"
  on public.ai_reports for select to anon, authenticated using (true);

drop policy if exists "ai_reports_insert_auth" on public.ai_reports;
create policy "ai_reports_insert_auth"
  on public.ai_reports for insert to authenticated with check (true);

drop policy if exists "ai_reports_update_auth" on public.ai_reports;
create policy "ai_reports_update_auth"
  on public.ai_reports for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 6) Realtime (postgres_changes)
--    Dashboard → Database → Replication 에서도 4테이블 ON 확인
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'panic_metrics',
    'panic_index_history',
    'market_status',
    'ai_reports'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Seed — 최신 3일 + 패닉 지표 (오늘 기준 동적 날짜)
-- ---------------------------------------------------------------------------
insert into public.panic_metrics (metric_key, metric_value, change_percent, status, market, source, updated_at)
values
  ('vix', 18.42, -1.2, null, 'global', 'yds-seed', now()),
  ('vxn', 20.15, 0.4, null, 'global', 'yds-seed', now()),
  ('fearGreed', 52, 3, null, 'global', 'yds-seed', now()),
  ('bofa', 0.62, null, null, 'global', 'yds-seed', now()),
  ('move', 94.8, -0.5, null, 'global', 'yds-seed', now()),
  ('skew', 142.5, null, null, 'global', 'yds-seed', now()),
  ('putCall', 0.88, null, null, 'global', 'yds-seed', now()),
  ('highYield', 3.18, 0.02, null, 'global', 'yds-seed', now()),
  ('gsBullBear', 0.28, null, null, 'global', 'yds-seed', now()),
  ('risk_regime', null, null, 'neutral', 'global', 'yds-seed', now())
on conflict (metric_key) do update set
  metric_value = excluded.metric_value,
  change_percent = excluded.change_percent,
  status = excluded.status,
  market = excluded.market,
  source = excluded.source,
  updated_at = excluded.updated_at;

insert into public.panic_index_history (
  date, vix, vxn, fear_greed, put_call, move, bofa, skew, hy_oas, gs_sentiment, market, source, updated_at
)
values
  (current_date - 2, 19.10, 21.00, 48, 0.90, 96.2, 0.64, 141.0, 3.22, 0.25, 'global', 'yds-seed', now()),
  (current_date - 1, 18.90, 20.60, 50, 0.89, 95.5, 0.63, 141.8, 3.20, 0.27, 'global', 'yds-seed', now()),
  (current_date,     18.42, 20.15, 52, 0.88, 94.8, 0.62, 142.5, 3.18, 0.28, 'global', 'yds-seed', now())
on conflict (date) do update set
  vix = excluded.vix,
  vxn = excluded.vxn,
  fear_greed = excluded.fear_greed,
  put_call = excluded.put_call,
  move = excluded.move,
  bofa = excluded.bofa,
  skew = excluded.skew,
  hy_oas = excluded.hy_oas,
  gs_sentiment = excluded.gs_sentiment,
  market = excluded.market,
  source = excluded.source,
  updated_at = excluded.updated_at;

insert into public.market_status (market, metric_name, value, signal, status, risk_level, commentary, source)
values
  ('global', 'cycle_stage', 2, 'mid-cycle', 'active', 'medium', '중기 사이클 — 완만한 확장', 'yds-seed'),
  ('global', 'risk_regime', null, 'neutral', 'active', 'medium', 'VIX·F&G 중립 구간', 'yds-seed'),
  ('global', 'panic_board', 52, 'fear_greed', 'active', 'low', '패닉 보드 정상', 'yds-seed')
on conflict (market, metric_name) do update set
  value = excluded.value,
  signal = excluded.signal,
  status = excluded.status,
  risk_level = excluded.risk_level,
  commentary = excluded.commentary,
  source = excluded.source,
  updated_at = now();

insert into public.ai_reports (report_key, market, metric_name, title, content, sector, signal, status, source)
values (
  'macro_briefing_latest',
  'global',
  'macro_briefing',
  'YDS Macro Briefing (seed)',
  jsonb_build_object(
    'briefingLines', jsonb_build_array(
      'VIX 18대 — 변동성 완화',
      'Fear & Greed 52 — 중립',
      '하이일드 OAS 3.18% — 신용 안정'
    ),
    'locale', 'ko',
    'asOf', to_char(current_date, 'YYYY-MM-DD')
  ),
  'macro',
  'neutral',
  'published',
  'yds-seed'
)
on conflict (report_key) do update set
  title = excluded.title,
  content = excluded.content,
  sector = excluded.sector,
  signal = excluded.signal,
  status = excluded.status,
  source = excluded.source,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 8) 검증 (결과 패널에서 row count 확인)
-- ---------------------------------------------------------------------------
select 'panic_metrics' as tbl, count(*)::int as rows from public.panic_metrics
union all
select 'panic_index_history', count(*)::int from public.panic_index_history
union all
select 'market_status', count(*)::int from public.market_status
union all
select 'ai_reports', count(*)::int from public.ai_reports;
