-- Staging ONLY (qzunuksxwwzusyivaznx) — never run against Production.
-- Supabase Dashboard → SQL Editor → Run this file once.
-- Purpose: Preview market-input save requires panic_index_history (+ compat columns).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.panic_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null unique,
  metric_value double precision,
  change_percent double precision,
  status text,
  source text not null default 'yds',
  market text not null default 'global',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panic_metrics_updated_at_idx on public.panic_metrics (updated_at desc);

alter table public.panic_metrics enable row level security;
drop policy if exists "panic_metrics_select_public" on public.panic_metrics;
create policy "panic_metrics_select_public"
  on public.panic_metrics for select to anon, authenticated using (true);

create table if not exists public.panic_index_history (
  date date primary key,
  vix double precision,
  vxn double precision,
  fear_greed double precision,
  put_call double precision,
  move double precision,
  bofa double precision,
  skew double precision,
  hy_oas double precision,
  high_yield double precision,
  gs_sentiment double precision,
  gs_bb double precision,
  panic_score double precision,
  source text not null default 'yds',
  market text not null default 'global',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panic_index_history_date_desc_idx
  on public.panic_index_history (date desc);

alter table public.panic_index_history enable row level security;
drop policy if exists "panic_index_history_select_public" on public.panic_index_history;
create policy "panic_index_history_select_public"
  on public.panic_index_history for select to anon, authenticated using (true);

create table if not exists public.latest_panic_metrics (
  id text primary key default 'global',
  vix double precision,
  vxn double precision,
  fear_greed double precision,
  put_call double precision,
  move double precision,
  bofa double precision,
  skew double precision,
  hy_oas double precision,
  updated_at timestamptz,
  trade_date date
);

alter table public.latest_panic_metrics enable row level security;
drop policy if exists "latest_panic_metrics_select_public" on public.latest_panic_metrics;
create policy "latest_panic_metrics_select_public"
  on public.latest_panic_metrics for select to anon, authenticated using (true);

-- Required for Vercel Preview API (service_role) and PostgREST roles.
-- Without these GRANTs, tables exist but upsert returns 403 permission denied.
grant select, insert, update, delete on table public.panic_metrics to anon, authenticated, service_role;
grant select, insert, update, delete on table public.panic_index_history to anon, authenticated, service_role;
grant select, insert, update, delete on table public.latest_panic_metrics to anon, authenticated, service_role;

notify pgrst, 'reload schema';
