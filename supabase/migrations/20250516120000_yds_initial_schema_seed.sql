-- YDS initial Supabase schema: panic hub + market_status + ai_reports + seed + RLS + realtime
-- Apply: Supabase Dashboard → SQL Editor → Run (or `supabase db push`)

-- ---------------------------------------------------------------------------
-- Shared: updated_at trigger
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
-- panic_metrics (live metric cells; one row per metric_key)
-- ---------------------------------------------------------------------------
create table if not exists public.panic_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null unique,
  metric_value double precision,
  change_percent double precision,
  status text,
  source text not null default 'yds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.panic_metrics add column if not exists source text not null default 'yds';
alter table public.panic_metrics add column if not exists created_at timestamptz not null default now();

create index if not exists panic_metrics_updated_at_idx on public.panic_metrics (updated_at desc);

drop trigger if exists panic_metrics_set_updated_at on public.panic_metrics;
create trigger panic_metrics_set_updated_at
  before update on public.panic_metrics
  for each row execute function public.set_updated_at();

alter table public.panic_metrics enable row level security;

drop policy if exists "panic_metrics_select_public" on public.panic_metrics;
create policy "panic_metrics_select_public"
  on public.panic_metrics for select to anon, authenticated using (true);

drop policy if exists "panic_metrics_insert_auth" on public.panic_metrics;
create policy "panic_metrics_insert_auth"
  on public.panic_metrics for insert to authenticated with check (true);

drop policy if exists "panic_metrics_update_auth" on public.panic_metrics;
create policy "panic_metrics_update_auth"
  on public.panic_metrics for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- panic_index_history (daily snapshot; PK = date)
-- ---------------------------------------------------------------------------
create table if not exists public.panic_index_history (
  date date primary key,
  vix double precision,
  vxn double precision,
  fear_greed double precision,
  move double precision,
  bofa double precision,
  skew double precision,
  hy_oas double precision,
  gs_sentiment double precision,
  source text not null default 'yds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.panic_index_history add column if not exists source text not null default 'yds';

create index if not exists panic_index_history_date_desc_idx
  on public.panic_index_history (date desc);

drop trigger if exists panic_index_history_set_updated_at on public.panic_index_history;
create trigger panic_index_history_set_updated_at
  before update on public.panic_index_history
  for each row execute function public.set_updated_at();

alter table public.panic_index_history enable row level security;

drop policy if exists "panic_index_history_select_public" on public.panic_index_history;
create policy "panic_index_history_select_public"
  on public.panic_index_history for select to anon, authenticated using (true);

drop policy if exists "panic_index_history_insert_auth" on public.panic_index_history;
create policy "panic_index_history_insert_auth"
  on public.panic_index_history for insert to authenticated with check (true);

drop policy if exists "panic_index_history_update_auth" on public.panic_index_history;
create policy "panic_index_history_update_auth"
  on public.panic_index_history for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- market_status (cycle / regime signals)
-- ---------------------------------------------------------------------------
create table if not exists public.market_status (
  id uuid primary key default gen_random_uuid(),
  market text not null default 'global',
  metric_name text not null,
  value double precision,
  signal text,
  status text,
  source text not null default 'yds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market, metric_name)
);

create index if not exists market_status_market_idx on public.market_status (market);
create index if not exists market_status_updated_at_idx on public.market_status (updated_at desc);

drop trigger if exists market_status_set_updated_at on public.market_status;
create trigger market_status_set_updated_at
  before update on public.market_status
  for each row execute function public.set_updated_at();

alter table public.market_status enable row level security;

drop policy if exists "market_status_select_public" on public.market_status;
create policy "market_status_select_public"
  on public.market_status for select to anon, authenticated using (true);

drop policy if exists "market_status_insert_auth" on public.market_status;
create policy "market_status_insert_auth"
  on public.market_status for insert to authenticated with check (true);

drop policy if exists "market_status_update_auth" on public.market_status;
create policy "market_status_update_auth"
  on public.market_status for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- ai_reports (briefings / memos as JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  market text not null default 'global',
  metric_name text,
  title text,
  content jsonb not null default '{}'::jsonb,
  signal text,
  status text not null default 'published',
  source text not null default 'yds',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_reports_updated_at_idx on public.ai_reports (updated_at desc);

drop trigger if exists ai_reports_set_updated_at on public.ai_reports;
create trigger ai_reports_set_updated_at
  before update on public.ai_reports
  for each row execute function public.set_updated_at();

alter table public.ai_reports enable row level security;

drop policy if exists "ai_reports_select_public" on public.ai_reports;
create policy "ai_reports_select_public"
  on public.ai_reports for select to anon, authenticated using (true);

drop policy if exists "ai_reports_insert_auth" on public.ai_reports;
create policy "ai_reports_insert_auth"
  on public.ai_reports for insert to authenticated with check (true);

drop policy if exists "ai_reports_update_auth" on public.ai_reports;
create policy "ai_reports_update_auth"
  on public.ai_reports for update to authenticated using (true) with check (true);

-- Vercel API writes use service_role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['panic_metrics', 'panic_index_history', 'market_status', 'ai_reports']
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
-- Seed: latest panic metrics + 3-day history + market_status + ai_reports
-- ---------------------------------------------------------------------------
insert into public.panic_metrics (metric_key, metric_value, change_percent, status, source, updated_at)
values
  ('vix', 18.42, -1.2, null, 'yds-seed', now()),
  ('vxn', 20.15, 0.4, null, 'yds-seed', now()),
  ('fearGreed', 52, 3, null, 'yds-seed', now()),
  ('bofa', 0.62, null, null, 'yds-seed', now()),
  ('move', 94.8, -0.5, null, 'yds-seed', now()),
  ('skew', 142.5, null, null, 'yds-seed', now()),
  ('putCall', 0.88, null, null, 'yds-seed', now()),
  ('highYield', 3.18, 0.02, null, 'yds-seed', now()),
  ('gsBullBear', 0.28, null, null, 'yds-seed', now()),
  ('risk_regime', null, null, 'neutral', 'yds-seed', now())
on conflict (metric_key) do update set
  metric_value = excluded.metric_value,
  change_percent = excluded.change_percent,
  status = excluded.status,
  source = excluded.source,
  updated_at = excluded.updated_at;

insert into public.panic_index_history (date, vix, vxn, fear_greed, move, bofa, skew, hy_oas, gs_sentiment, source, updated_at)
values
  ('2026-05-14', 19.1, 21.0, 48, 96.2, 0.64, 141.0, 3.22, 0.25, 'yds-seed', now()),
  ('2026-05-15', 18.9, 20.6, 50, 95.5, 0.63, 141.8, 3.20, 0.27, 'yds-seed', now()),
  ('2026-05-16', 18.42, 20.15, 52, 94.8, 0.62, 142.5, 3.18, 0.28, 'yds-seed', now())
on conflict (date) do update set
  vix = excluded.vix,
  vxn = excluded.vxn,
  fear_greed = excluded.fear_greed,
  move = excluded.move,
  bofa = excluded.bofa,
  skew = excluded.skew,
  hy_oas = excluded.hy_oas,
  gs_sentiment = excluded.gs_sentiment,
  source = excluded.source,
  updated_at = excluded.updated_at;

insert into public.market_status (market, metric_name, value, signal, status, source)
values
  ('global', 'cycle_stage', 2, 'mid-cycle', 'active', 'yds-seed'),
  ('global', 'risk_regime', null, 'neutral', 'active', 'yds-seed'),
  ('global', 'panic_board', 52, 'fear_greed', 'active', 'yds-seed')
on conflict (market, metric_name) do update set
  value = excluded.value,
  signal = excluded.signal,
  status = excluded.status,
  source = excluded.source,
  updated_at = now();

insert into public.ai_reports (report_key, market, metric_name, title, content, signal, status, source)
values (
  'macro_briefing_latest',
  'global',
  'macro_briefing',
  'YDS Macro Briefing (seed)',
  jsonb_build_object(
    'briefingLines', jsonb_build_array(
      'VIX 18대 — 변동성 완화 구간',
      'Fear & Greed 52 — 중립',
      '하이일드 OAS 3.18% — 신용 스프레드 안정'
    ),
    'locale', 'ko',
    'asOf', '2026-05-16'
  ),
  'neutral',
  'published',
  'yds-seed'
)
on conflict (report_key) do update set
  title = excluded.title,
  content = excluded.content,
  signal = excluded.signal,
  status = excluded.status,
  source = excluded.source,
  updated_at = now();
