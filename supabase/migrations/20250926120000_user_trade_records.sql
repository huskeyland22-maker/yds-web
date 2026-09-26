-- User trade records sync (Firebase UID → DBB/Panic manual buy records JSON)
-- Client access via /api/trade-records-sync only (service role). No anon/authenticated RLS policies.

create table if not exists public.user_trade_records (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  records jsonb not null default '{"version":1,"records":{}}'::jsonb,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_trade_records_updated_at_idx
  on public.user_trade_records (updated_at desc);

create index if not exists user_trade_records_firebase_uid_idx
  on public.user_trade_records (firebase_uid);

drop trigger if exists user_trade_records_set_updated_at on public.user_trade_records;
create trigger user_trade_records_set_updated_at
  before update on public.user_trade_records
  for each row execute function public.set_updated_at();

alter table public.user_trade_records enable row level security;
