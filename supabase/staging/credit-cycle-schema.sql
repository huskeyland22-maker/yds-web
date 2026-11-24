-- =============================================================================
-- YDS Credit Cycle — STAGING-ONLY schema draft (Phase 9)
-- =============================================================================
-- DO NOT RUN against Production (project ref oausvweyocgynjpeguka).
-- Target Staging only (project ref qzunuksxwwzusyivaznx) after explicit approval.
--
-- Pre-flight (human operator):
--   1) Confirm connected project ref == Staging
--   2) Confirm this is NOT Production
--   3) Take Staging backup / snapshot if any prior CC objects exist
--   4) Apply schema.sql then rls.sql
--
-- Does NOT alter panic_* or any non-credit-cycle tables.
-- Missing values MUST remain NULL (never coerce to 0).
-- =============================================================================

-- Safety banner for operators reading the file
do $$
begin
  raise notice 'CREDIT_CYCLE_SCHEMA: staging draft only — verify project ref before apply';
end $$;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- A. Raw observations (source series) — separate from computed CCI
-- ---------------------------------------------------------------------------
create table if not exists public.credit_cycle_observations (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  series_id text not null,
  indicator_code text not null,
  observation_date date not null,
  release_date date,
  vintage_date date,
  retrieved_at timestamptz,
  frequency text not null check (frequency in ('daily', 'monthly', 'quarterly')),
  value double precision,
  unit text,
  quality_status text not null default 'VALID',
  pit_status text not null check (pit_status in ('PIT', 'NON_PIT', 'UNKNOWN')),
  license_restricted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_cycle_observations_value_finite
    check (value is null or value = value), -- reject NaN if ever cast
  -- Belt-and-suspenders: HY/BBB rows must always be flagged restricted (Phase 10A)
  constraint credit_cycle_observations_hy_bbb_must_restrict
    check (
      (
        lower(indicator_code) not in ('hy', 'bbb')
        and series_id not in ('BAMLH0A0HYM2', 'BAMLC0A4CBBB')
      )
      or license_restricted = true
    )
);

comment on table public.credit_cycle_observations is
  'STAGING Credit Cycle raw observations. Panic-independent. HY/BBB rows must set license_restricted=true.';

comment on column public.credit_cycle_observations.value is
  'May be NULL for missing; never store invented zeros for missing data.';

-- Dedup: same source point + vintage + release + pit lane
create unique index if not exists credit_cycle_observations_uq
  on public.credit_cycle_observations (
    source,
    series_id,
    observation_date,
    pit_status,
    coalesce(vintage_date, 'epoch'::date),
    coalesce(release_date, 'epoch'::date)
  );

create index if not exists credit_cycle_observations_series_obs_idx
  on public.credit_cycle_observations (indicator_code, observation_date desc);

create index if not exists credit_cycle_observations_pit_idx
  on public.credit_cycle_observations (pit_status, observation_date desc);

-- ---------------------------------------------------------------------------
-- B. CCI snapshots (license-safe product path by default)
-- ---------------------------------------------------------------------------
create table if not exists public.credit_cycle_snapshots (
  id uuid primary key default gen_random_uuid(),
  as_of_date date not null,
  cci_score double precision,
  coverage double precision,
  confidence_status text,
  regime text,
  calculation_version text not null default 'phase2-engine-hypothesis',
  data_mode text not null check (data_mode in ('license_safe', 'research')),
  pit_status text not null check (pit_status in ('PIT', 'NON_PIT', 'UNKNOWN', 'MIXED')),
  hold_reason text,
  -- Server/service_role only. anon/authenticated must not SELECT this column (see rls.sql).
  payload jsonb,
  created_at timestamptz not null default now(),
  constraint credit_cycle_snapshots_cci_null_ok check (cci_score is null or cci_score = cci_score),
  constraint credit_cycle_snapshots_coverage_range
    check (coverage is null or (coverage >= 0 and coverage <= 1))
);

comment on table public.credit_cycle_snapshots is
  'STAGING Credit Cycle computed CCI snapshots. Prefer data_mode=license_safe for product reads.';

comment on column public.credit_cycle_snapshots.payload is
  'Optional server-side JSON. Never grant SELECT on this column to anon/authenticated. Prefer NULL for license_safe product rows; never store HY/BBB numerics here.';

create unique index if not exists credit_cycle_snapshots_uq
  on public.credit_cycle_snapshots (as_of_date, data_mode, pit_status, calculation_version);

create index if not exists credit_cycle_snapshots_asof_idx
  on public.credit_cycle_snapshots (as_of_date desc);

-- ---------------------------------------------------------------------------
-- C. Per-indicator scores for a snapshot
-- ---------------------------------------------------------------------------
create table if not exists public.credit_cycle_indicator_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.credit_cycle_snapshots(id) on delete cascade,
  indicator_code text not null,
  indicator_score double precision,
  weighted_contribution double precision,
  observation_date date,
  release_date date,
  quality_status text,
  license_restricted boolean not null default false,
  raw_value double precision,
  created_at timestamptz not null default now(),
  constraint credit_cycle_indicator_scores_score_finite
    check (indicator_score is null or indicator_score = indicator_score),
  -- HY/BBB: no public numerics — raw_value, indicator_score, weighted_contribution all NULL
  constraint credit_cycle_indicator_scores_hy_bbb_must_restrict
    check (
      lower(indicator_code) not in ('hy', 'bbb')
      or (
        license_restricted = true
        and raw_value is null
        and indicator_score is null
        and weighted_contribution is null
      )
    )
);

comment on column public.credit_cycle_indicator_scores.raw_value is
  'License-restricted indicators must keep raw_value NULL. HY/BBB also force indicator_score and weighted_contribution NULL.';

-- Idempotent upgrade if table already existed with the weaker Phase 10A CHECK
alter table public.credit_cycle_indicator_scores
  drop constraint if exists credit_cycle_indicator_scores_hy_bbb_must_restrict;

alter table public.credit_cycle_indicator_scores
  add constraint credit_cycle_indicator_scores_hy_bbb_must_restrict
  check (
    lower(indicator_code) not in ('hy', 'bbb')
    or (
      license_restricted = true
      and raw_value is null
      and indicator_score is null
      and weighted_contribution is null
    )
  );

create unique index if not exists credit_cycle_indicator_scores_uq
  on public.credit_cycle_indicator_scores (snapshot_id, indicator_code);

create index if not exists credit_cycle_indicator_scores_snap_idx
  on public.credit_cycle_indicator_scores (snapshot_id);

-- ---------------------------------------------------------------------------
-- D. Ingest audit (optional but recommended for failed-run protection)
-- ---------------------------------------------------------------------------
create table if not exists public.credit_cycle_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'ok', 'failed')),
  error text,
  series_summary jsonb,
  created_at timestamptz not null default now()
);

comment on table public.credit_cycle_ingest_runs is
  'STAGING ingest audit. Failed runs must not delete prior OK observations/snapshots.';
