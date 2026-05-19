-- 일별 AI 시장 리포트 + 섹터 점수 히스토리

create table if not exists public.daily_ai_reports (
  date date primary key,
  summary text not null default '',
  market_view text,
  short_strategy text,
  mid_strategy text,
  long_strategy text,
  risk_note text,
  priority_sector text,
  panic_score double precision,
  market_state text,
  source text default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_ai_reports_date_desc_idx
  on public.daily_ai_reports (date desc);

alter table public.daily_ai_reports enable row level security;

drop policy if exists "daily_ai_reports_select_public" on public.daily_ai_reports;
create policy "daily_ai_reports_select_public"
  on public.daily_ai_reports
  for select
  to anon, authenticated
  using (true);

-- 섹터 우선도 점수 (일별)
create table if not exists public.sector_score_history (
  date date not null,
  sector text not null,
  score double precision not null default 0,
  label text,
  reasons jsonb default '[]'::jsonb,
  source text default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, sector)
);

create index if not exists sector_score_history_date_desc_idx
  on public.sector_score_history (date desc, score desc);

alter table public.sector_score_history enable row level security;

drop policy if exists "sector_score_history_select_public" on public.sector_score_history;
create policy "sector_score_history_select_public"
  on public.sector_score_history
  for select
  to anon, authenticated
  using (true);

create or replace function public.upsert_daily_ai_report_fill(p_payload jsonb)
returns public.daily_ai_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.daily_ai_reports;
  d date;
begin
  d := (p_payload->>'date')::date;
  if d is null then raise exception 'invalid date'; end if;

  insert into public.daily_ai_reports as t (
    date, summary, market_view, short_strategy, mid_strategy, long_strategy,
    risk_note, priority_sector, panic_score, market_state, source,
    created_at, updated_at
  )
  values (
    d,
    coalesce(nullif(p_payload->>'summary', ''), ''),
    nullif(p_payload->>'market_view', ''),
    nullif(p_payload->>'short_strategy', ''),
    nullif(p_payload->>'mid_strategy', ''),
    nullif(p_payload->>'long_strategy', ''),
    nullif(p_payload->>'risk_note', ''),
    nullif(p_payload->>'priority_sector', ''),
    nullif(p_payload->>'panic_score', '')::double precision,
    nullif(p_payload->>'market_state', ''),
    coalesce(nullif(p_payload->>'source', ''), 'auto'),
    coalesce((p_payload->>'created_at')::timestamptz, now()),
    now()
  )
  on conflict (date) do update set
    summary = coalesce(nullif(excluded.summary, ''), t.summary),
    market_view = coalesce(excluded.market_view, t.market_view),
    short_strategy = coalesce(excluded.short_strategy, t.short_strategy),
    mid_strategy = coalesce(excluded.mid_strategy, t.mid_strategy),
    long_strategy = coalesce(excluded.long_strategy, t.long_strategy),
    risk_note = coalesce(excluded.risk_note, t.risk_note),
    priority_sector = coalesce(excluded.priority_sector, t.priority_sector),
    panic_score = coalesce(excluded.panic_score, t.panic_score),
    market_state = coalesce(excluded.market_state, t.market_state),
    source = coalesce(excluded.source, t.source),
    updated_at = now()
  returning * into r;

  return r;
end;
$$;

grant execute on function public.upsert_daily_ai_report_fill(jsonb) to service_role;
