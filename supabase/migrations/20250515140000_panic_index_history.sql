-- Daily panic index snapshots (one row per calendar date).
-- Same date → upsert; different dates → accumulate.

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists panic_index_history_date_desc_idx
  on public.panic_index_history (date desc);

alter table public.panic_index_history enable row level security;

create policy "panic_index_history_select_public"
  on public.panic_index_history
  for select
  to anon, authenticated
  using (true);
