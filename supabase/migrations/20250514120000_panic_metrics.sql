-- Panic metrics hub (Supabase). Apply in Supabase SQL editor or CLI.
-- After migrate: Dashboard → Database → Replication → enable panic_metrics for Realtime if needed.

create table if not exists public.panic_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null unique,
  metric_value double precision,
  change_percent double precision,
  status text,
  updated_at timestamptz not null default now()
);

create index if not exists panic_metrics_updated_at_idx on public.panic_metrics (updated_at desc);

alter table public.panic_metrics enable row level security;

-- Read-only for browser clients (anon + authenticated). Writes go through Vercel API (service role).
create policy "panic_metrics_select_public"
  on public.panic_metrics
  for select
  to anon, authenticated
  using (true);

-- Realtime publication (ignore error if already member)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'panic_metrics'
  ) then
    alter publication supabase_realtime add table public.panic_metrics;
  end if;
end $$;
