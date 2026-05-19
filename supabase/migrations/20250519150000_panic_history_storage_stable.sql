-- 패닉 히스토리 저장 구조 안정화
-- latest_panic_metrics (1행 스냅샷) + panic_index_history (일별 누적, NULL-fill upsert)
-- market_cycle_history (패닉 저장 후 사이클 파생)

-- ---------------------------------------------------------------------------
-- 1) 최신 스냅샷 (단일 행)
-- ---------------------------------------------------------------------------
create table if not exists public.latest_panic_metrics (
  id text primary key default 'global' check (id = 'global'),
  date date not null,
  vix double precision,
  vxn double precision,
  fear_greed double precision,
  put_call double precision,
  move double precision,
  bofa double precision,
  skew double precision,
  hy_oas double precision,
  gs_sentiment double precision,
  panic_score double precision,
  updated_at timestamptz not null default now()
);

alter table public.latest_panic_metrics enable row level security;

drop policy if exists "latest_panic_metrics_select_public" on public.latest_panic_metrics;
create policy "latest_panic_metrics_select_public"
  on public.latest_panic_metrics
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 2) panic_index_history 확장
-- ---------------------------------------------------------------------------
alter table public.panic_index_history
  add column if not exists put_call double precision,
  add column if not exists high_yield double precision,
  add column if not exists gs_bb double precision,
  add column if not exists market text,
  add column if not exists source text,
  add column if not exists panic_score double precision,
  add column if not exists market_phase text,
  add column if not exists risk_level text,
  add column if not exists strategy text;

-- ---------------------------------------------------------------------------
-- 3) 시장 사이클 히스토리 (일별)
-- ---------------------------------------------------------------------------
create table if not exists public.market_cycle_history (
  date date primary key,
  panic_score double precision,
  market_state text,
  risk_signal text,
  sector text,
  volatility text,
  short_score double precision,
  mid_score double precision,
  long_score double precision,
  recommendation text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_cycle_history_date_desc_idx
  on public.market_cycle_history (date desc);

alter table public.market_cycle_history enable row level security;

drop policy if exists "market_cycle_history_select_public" on public.market_cycle_history;
create policy "market_cycle_history_select_public"
  on public.market_cycle_history
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 4) stock_signal_history 백테스트 컬럼
-- ---------------------------------------------------------------------------
alter table public.stock_signal_history
  add column if not exists sector text,
  add column if not exists volume_ratio double precision,
  add column if not exists future_5d double precision,
  add column if not exists future_20d double precision;

-- ---------------------------------------------------------------------------
-- NULL-fill upsert: 기존 값이 있으면 유지, NULL/빈 칸만 보완
-- ---------------------------------------------------------------------------
create or replace function public.upsert_panic_index_history_fill(p_payload jsonb)
returns public.panic_index_history
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.panic_index_history;
  d date;
begin
  d := (p_payload->>'date')::date;
  if d is null then
    raise exception 'invalid date';
  end if;

  insert into public.panic_index_history as t (
    date,
    vix, vxn, fear_greed, put_call, move, bofa, skew, hy_oas, gs_sentiment,
    high_yield, gs_bb, market, source,
    panic_score, market_phase, risk_level, strategy,
    created_at, updated_at
  )
  values (
    d,
    nullif(p_payload->>'vix', '')::double precision,
    nullif(p_payload->>'vxn', '')::double precision,
    nullif(p_payload->>'fear_greed', '')::double precision,
    nullif(p_payload->>'put_call', '')::double precision,
    nullif(p_payload->>'move', '')::double precision,
    nullif(p_payload->>'bofa', '')::double precision,
    nullif(p_payload->>'skew', '')::double precision,
    nullif(p_payload->>'hy_oas', '')::double precision,
    nullif(p_payload->>'gs_sentiment', '')::double precision,
    nullif(p_payload->>'high_yield', '')::double precision,
    nullif(p_payload->>'gs_bb', '')::double precision,
    coalesce(nullif(p_payload->>'market', ''), 'global'),
    coalesce(nullif(p_payload->>'source', ''), 'api'),
    nullif(p_payload->>'panic_score', '')::double precision,
    nullif(p_payload->>'market_phase', ''),
    nullif(p_payload->>'risk_level', ''),
    nullif(p_payload->>'strategy', ''),
    coalesce((p_payload->>'created_at')::timestamptz, now()),
    coalesce((p_payload->>'updated_at')::timestamptz, now())
  )
  on conflict (date) do update set
    vix = coalesce(excluded.vix, t.vix),
    vxn = coalesce(excluded.vxn, t.vxn),
    fear_greed = coalesce(excluded.fear_greed, t.fear_greed),
    put_call = coalesce(excluded.put_call, t.put_call),
    move = coalesce(excluded.move, t.move),
    bofa = coalesce(excluded.bofa, t.bofa),
    skew = coalesce(excluded.skew, t.skew),
    hy_oas = coalesce(excluded.hy_oas, t.hy_oas),
    gs_sentiment = coalesce(excluded.gs_sentiment, t.gs_sentiment),
    high_yield = coalesce(excluded.high_yield, t.high_yield),
    gs_bb = coalesce(excluded.gs_bb, t.gs_bb),
    market = coalesce(excluded.market, t.market),
    source = coalesce(excluded.source, t.source),
    panic_score = coalesce(excluded.panic_score, t.panic_score),
    market_phase = coalesce(excluded.market_phase, t.market_phase),
    risk_level = coalesce(excluded.risk_level, t.risk_level),
    strategy = coalesce(excluded.strategy, t.strategy),
    updated_at = now()
  returning * into r;

  perform public.sync_latest_panic_metrics(d);
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- 최신 스냅샷 동기화 (해당 일자 history → 1행 전체 갱신)
-- ---------------------------------------------------------------------------
create or replace function public.sync_latest_panic_metrics(p_date date default null)
returns public.latest_panic_metrics
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.panic_index_history;
  d date;
  out public.latest_panic_metrics;
begin
  if p_date is not null then
    d := p_date;
  else
    select h.date into d
    from public.panic_index_history h
    order by h.date desc
    limit 1;
  end if;

  if d is null then
    return null;
  end if;

  select * into src from public.panic_index_history where date = d;
  if not found then
    return null;
  end if;

  insert into public.latest_panic_metrics (
    id, date, vix, vxn, fear_greed, put_call, move, bofa, skew, hy_oas, gs_sentiment,
    panic_score, updated_at
  )
  values (
    'global',
    src.date,
    src.vix,
    src.vxn,
    src.fear_greed,
    src.put_call,
    src.move,
    src.bofa,
    src.skew,
    coalesce(src.hy_oas, src.high_yield),
    coalesce(src.gs_sentiment, src.gs_bb),
    src.panic_score,
    now()
  )
  on conflict (id) do update set
    date = excluded.date,
    vix = excluded.vix,
    vxn = excluded.vxn,
    fear_greed = excluded.fear_greed,
    put_call = excluded.put_call,
    move = excluded.move,
    bofa = excluded.bofa,
    skew = excluded.skew,
    hy_oas = excluded.hy_oas,
    gs_sentiment = excluded.gs_sentiment,
    panic_score = excluded.panic_score,
    updated_at = now()
  returning * into out;

  return out;
end;
$$;

-- market_cycle_history NULL-fill upsert
create or replace function public.upsert_market_cycle_history_fill(p_payload jsonb)
returns public.market_cycle_history
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.market_cycle_history;
  d date;
begin
  d := (p_payload->>'date')::date;
  if d is null then
    raise exception 'invalid date';
  end if;

  insert into public.market_cycle_history as t (
    date, panic_score, market_state, risk_signal, sector, volatility,
    short_score, mid_score, long_score, recommendation, source,
    created_at, updated_at
  )
  values (
    d,
    nullif(p_payload->>'panic_score', '')::double precision,
    nullif(p_payload->>'market_state', ''),
    nullif(p_payload->>'risk_signal', ''),
    nullif(p_payload->>'sector', ''),
    nullif(p_payload->>'volatility', ''),
    nullif(p_payload->>'short_score', '')::double precision,
    nullif(p_payload->>'mid_score', '')::double precision,
    nullif(p_payload->>'long_score', '')::double precision,
    nullif(p_payload->>'recommendation', ''),
    coalesce(nullif(p_payload->>'source', ''), 'api'),
    coalesce((p_payload->>'created_at')::timestamptz, now()),
    coalesce((p_payload->>'updated_at')::timestamptz, now())
  )
  on conflict (date) do update set
    panic_score = coalesce(excluded.panic_score, t.panic_score),
    market_state = coalesce(excluded.market_state, t.market_state),
    risk_signal = coalesce(excluded.risk_signal, t.risk_signal),
    sector = coalesce(excluded.sector, t.sector),
    volatility = coalesce(excluded.volatility, t.volatility),
    short_score = coalesce(excluded.short_score, t.short_score),
    mid_score = coalesce(excluded.mid_score, t.mid_score),
    long_score = coalesce(excluded.long_score, t.long_score),
    recommendation = coalesce(excluded.recommendation, t.recommendation),
    source = coalesce(excluded.source, t.source),
    updated_at = now()
  returning * into r;

  return r;
end;
$$;

grant execute on function public.upsert_panic_index_history_fill(jsonb) to service_role;
grant execute on function public.sync_latest_panic_metrics(date) to service_role;
grant execute on function public.upsert_market_cycle_history_fill(jsonb) to service_role;
