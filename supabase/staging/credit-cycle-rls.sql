-- =============================================================================
-- YDS Credit Cycle — STAGING-ONLY RLS draft (Phase 9 + Phase 10B harden)
-- =============================================================================
-- Apply ONLY after credit-cycle-schema.sql on Staging.
-- DO NOT RUN on Production.
-- Writes: service_role only (bypasses RLS). No anon/authenticated INSERT/UPDATE/DELETE.
-- Reads: anon/authenticated SELECT only on license-safe, non-restricted product rows.
-- HY/BBB (license_restricted OR indicator hy/bbb) are not selectable by anon.
-- snapshots.payload: column-level privilege — NO SELECT for anon/authenticated.
-- No INSERT/UPDATE/DELETE policies for anon/authenticated (writes = service_role only).
-- =============================================================================

do $$
begin
  raise notice 'CREDIT_CYCLE_RLS: staging draft — verify Staging project ref before apply';
end $$;

alter table public.credit_cycle_observations enable row level security;
alter table public.credit_cycle_snapshots enable row level security;
alter table public.credit_cycle_indicator_scores enable row level security;
alter table public.credit_cycle_ingest_runs enable row level security;

-- Drop prior draft policies if re-applied (idempotent; does not drop tables/data)
drop policy if exists "cc_obs_select_public_license_safe" on public.credit_cycle_observations;
drop policy if exists "cc_snap_select_public_license_safe" on public.credit_cycle_snapshots;
drop policy if exists "cc_scores_select_public_license_safe" on public.credit_cycle_indicator_scores;

-- ---------------------------------------------------------------------------
-- Table / column privileges (Phase 10B)
-- snapshots: revoke table-level SELECT, then grant only public columns (exclude payload).
-- observations / scores: table-level SELECT only (no write grants).
-- ---------------------------------------------------------------------------
revoke all on table public.credit_cycle_snapshots from anon, authenticated;
grant select (
  id,
  as_of_date,
  cci_score,
  coverage,
  confidence_status,
  regime,
  calculation_version,
  data_mode,
  pit_status,
  hold_reason,
  created_at
) on table public.credit_cycle_snapshots to anon, authenticated;
-- payload intentionally omitted — anon/authenticated cannot SELECT it

grant select on public.credit_cycle_observations to anon, authenticated;
grant select on public.credit_cycle_indicator_scores to anon, authenticated;
-- ingest_runs: intentionally no grant to anon/authenticated

-- ---------------------------------------------------------------------------
-- service_role table grants (Phase 10B fix)
-- sb_secret / legacy service_role JWT map to Postgres role service_role (BYPASSRLS).
-- Grants are evaluated BEFORE RLS — missing SELECT yields 42501 even with BYPASSRLS.
-- SELECT for API reads; INSERT for server-side seed/ingest (no UPDATE/DELETE here).
-- Does NOT change anon column limits, payload revoke, or HY/BBB policies.
-- ---------------------------------------------------------------------------
grant select on table public.credit_cycle_observations to service_role;
grant select on table public.credit_cycle_snapshots to service_role;
grant select on table public.credit_cycle_indicator_scores to service_role;
grant select on table public.credit_cycle_ingest_runs to service_role;
grant insert on table public.credit_cycle_snapshots to service_role;
grant insert on table public.credit_cycle_indicator_scores to service_role;
grant insert on table public.credit_cycle_ingest_runs to service_role;

-- Observations: non-restricted + never hy/bbb codes
create policy "cc_obs_select_public_license_safe"
  on public.credit_cycle_observations
  for select
  to anon, authenticated
  using (
    license_restricted = false
    and lower(indicator_code) not in ('hy', 'bbb')
    and series_id not in ('BAMLH0A0HYM2', 'BAMLC0A4CBBB')
  );

-- Snapshots: product license_safe only (research hidden from anon)
create policy "cc_snap_select_public_license_safe"
  on public.credit_cycle_snapshots
  for select
  to anon, authenticated
  using (data_mode = 'license_safe');

-- Indicator scores: non-restricted codes on license_safe snapshots only
create policy "cc_scores_select_public_license_safe"
  on public.credit_cycle_indicator_scores
  for select
  to anon, authenticated
  using (
    license_restricted = false
    and lower(indicator_code) not in ('hy', 'bbb')
    and exists (
      select 1
      from public.credit_cycle_snapshots s
      where s.id = snapshot_id
        and s.data_mode = 'license_safe'
    )
  );

-- ingest_runs: no anon policies + no grant → denied by default under RLS
-- Explicitly: no INSERT/UPDATE/DELETE policies for anon/authenticated.
-- Server reads use sb_secret → service_role after CREDIT_CYCLE_API_ENABLED + Staging URL gate.
-- service_role needs explicit SELECT grants above; BYPASSRLS alone is not sufficient.
