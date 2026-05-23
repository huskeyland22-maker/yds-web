-- panic_history_v2 — 일별 패닉 V2 동적 점수 + 입력 지표 스냅샷
create table if not exists public.panic_history_v2 (
  date date primary key,
  panic_v2 double precision,
  vix double precision,
  vxn double precision,
  fear_greed double precision,
  put_call double precision,
  hy double precision,
  move double precision,
  skew double precision,
  gs double precision,
  bofa double precision,
  source text not null default 'yds',
  updated_at timestamptz not null default now()
);

create index if not exists panic_history_v2_date_desc_idx
  on public.panic_history_v2 (date desc);

alter table public.panic_history_v2 enable row level security;

drop policy if exists "panic_history_v2_select_public" on public.panic_history_v2;
create policy "panic_history_v2_select_public"
  on public.panic_history_v2 for select to anon, authenticated using (true);

drop policy if exists "panic_history_v2_insert_auth" on public.panic_history_v2;
create policy "panic_history_v2_insert_auth"
  on public.panic_history_v2 for insert to authenticated with check (true);

drop policy if exists "panic_history_v2_update_auth" on public.panic_history_v2;
create policy "panic_history_v2_update_auth"
  on public.panic_history_v2 for update to authenticated using (true) with check (true);
