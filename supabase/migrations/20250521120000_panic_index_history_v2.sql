-- panic_index_history_v2 — 일별 패닉 V2 (레벨 점수 + 지표 스냅샷)
create table if not exists public.panic_index_history_v2 (
  date date primary key,
  vix double precision,
  vxn double precision,
  fear_greed double precision,
  put_call double precision,
  high_yield double precision,
  move double precision,
  skew double precision,
  gs double precision,
  bofa double precision,
  panic_index_v2 double precision,
  source text not null default 'yds',
  updated_at timestamptz not null default now()
);

alter table public.panic_index_history_v2
  add column if not exists high_yield double precision,
  add column if not exists panic_index_v2 double precision,
  add column if not exists vix double precision,
  add column if not exists vxn double precision,
  add column if not exists fear_greed double precision,
  add column if not exists put_call double precision,
  add column if not exists move double precision,
  add column if not exists skew double precision,
  add column if not exists gs double precision,
  add column if not exists bofa double precision;

create index if not exists panic_index_history_v2_date_desc_idx
  on public.panic_index_history_v2 (date desc);

alter table public.panic_index_history_v2 enable row level security;

drop policy if exists "panic_index_history_v2_select_public" on public.panic_index_history_v2;
create policy "panic_index_history_v2_select_public"
  on public.panic_index_history_v2 for select to anon, authenticated using (true);

drop policy if exists "panic_index_history_v2_insert_auth" on public.panic_index_history_v2;
create policy "panic_index_history_v2_insert_auth"
  on public.panic_index_history_v2 for insert to authenticated with check (true);

drop policy if exists "panic_index_history_v2_update_auth" on public.panic_index_history_v2;
create policy "panic_index_history_v2_update_auth"
  on public.panic_index_history_v2 for update to authenticated using (true) with check (true);

-- 레거시 panic_history_v2 → 신규 테이블 (있을 때만)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'panic_history_v2'
  ) then
    insert into public.panic_index_history_v2 (
      date, vix, vxn, fear_greed, put_call, high_yield, move, skew, gs, bofa,
      panic_index_v2, source, updated_at
    )
    select
      h.date,
      h.vix,
      h.vxn,
      h.fear_greed,
      h.put_call,
      coalesce(h.high_yield, h.hy),
      h.move,
      h.skew,
      h.gs,
      h.bofa,
      coalesce(h.panic_index_v2, h.panic_v2),
      coalesce(h.source, 'migrate'),
      coalesce(h.updated_at, now())
    from public.panic_history_v2 h
    on conflict (date) do update set
      panic_index_v2 = coalesce(excluded.panic_index_v2, panic_index_history_v2.panic_index_v2),
      high_yield = coalesce(excluded.high_yield, panic_index_history_v2.high_yield),
      updated_at = excluded.updated_at;
  end if;
end $$;
