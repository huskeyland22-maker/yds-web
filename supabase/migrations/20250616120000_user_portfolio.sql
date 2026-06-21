-- User portfolio sync (Firebase UID → trades JSON + cash)
-- Client access via /api/portfolio-sync only (service role). No anon/authenticated RLS policies.

create table if not exists public.user_portfolio (
  firebase_uid text primary key,
  trades jsonb not null default '[]'::jsonb,
  cash_balance double precision not null default 0,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_portfolio_updated_at_idx on public.user_portfolio (updated_at desc);

drop trigger if exists user_portfolio_set_updated_at on public.user_portfolio;
create trigger user_portfolio_set_updated_at
  before update on public.user_portfolio
  for each row execute function public.set_updated_at();

alter table public.user_portfolio enable row level security;
