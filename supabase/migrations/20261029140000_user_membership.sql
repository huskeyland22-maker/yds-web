-- User membership ledger (Firebase UID → FREE/PRO plan)
-- Server access via /api/me-membership (and later gated APIs) using service role only.
-- No anon/authenticated RLS policies — browser cannot read or write this table.
-- Does not alter existing tables, functions, or policies.

create table if not exists public.user_membership (
  firebase_uid text primary key,
  plan text not null default 'free',
  status text not null default 'active',
  source text not null default 'manual',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_membership_plan_check check (plan in ('free', 'pro')),
  constraint user_membership_status_check check (status in ('active', 'revoked'))
);

create index if not exists user_membership_updated_at_idx
  on public.user_membership (updated_at desc);

create index if not exists user_membership_plan_status_idx
  on public.user_membership (plan, status);

-- Reuse public.set_updated_at() from 20250516120000_yds_initial_schema_seed.sql
-- (BEFORE UPDATE trigger: sets NEW.updated_at = now()).
drop trigger if exists user_membership_set_updated_at on public.user_membership;
create trigger user_membership_set_updated_at
  before update on public.user_membership
  for each row execute function public.set_updated_at();

alter table public.user_membership enable row level security;

comment on table public.user_membership is
  'Billing membership plan by Firebase UID. Missing row = FREE. Not related to panic accessTier/isPro.';

comment on column public.user_membership.plan is
  'free | pro. Server is source of truth; clients must not set this.';

comment on column public.user_membership.status is
  'active | revoked. Non-active rows resolve as FREE.';

comment on column public.user_membership.source is
  'How the row was set (e.g. manual). Payment webhook may use payment later. No public self-upgrade API.';
