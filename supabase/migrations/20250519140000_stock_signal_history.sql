-- 실시간 종목 시그널 히스토리 (일별 스냅샷)
create table if not exists public.stock_signal_history (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  ticker text not null,
  price double precision,
  ma10 double precision,
  ma20 double precision,
  rsi double precision,
  position_52w double precision,
  volume_change_pct double precision,
  sector_score double precision,
  panic_index double precision,
  signal text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_signal_history_date_ticker_key unique (date, ticker)
);

create index if not exists stock_signal_history_ticker_date_idx
  on public.stock_signal_history (ticker, date desc);

create index if not exists stock_signal_history_date_idx
  on public.stock_signal_history (date desc);

alter table public.stock_signal_history enable row level security;

create policy "stock_signal_history_select_public"
  on public.stock_signal_history
  for select
  to anon, authenticated
  using (true);
