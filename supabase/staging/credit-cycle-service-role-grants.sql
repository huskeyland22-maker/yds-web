-- =============================================================================
-- YDS Credit Cycle — Staging service_role SELECT grants (Phase 10B 403 fix)
-- =============================================================================
-- Target: Staging ONLY — project ref qzunuksxwwzusyivaznx
-- NEVER run on Production (oausvweyocgynjpeguka).
--
-- Context:
--   service_role.rolbypassrls = true, but credit_cycle_* lacked SELECT grants.
--   Postgres checks GRANTs before RLS → 42501 permission denied for table.
--   anon/authenticated column limits, payload block, HY/BBB policies unchanged.
--   Panic tables are not touched.
--
-- Apply AFTER schema + rls (or alone if those already applied).
-- Idempotent: GRANT SELECT is safe to re-run.
-- No DROP / DELETE / TRUNCATE / REVOKE of anon privileges.
-- =============================================================================

do $$
begin
  raise notice 'CREDIT_CYCLE_SERVICE_ROLE_GRANTS: Staging only — verify project ref qzunuksxwwzusyivaznx';
end $$;

-- API read path minimum: snapshots + indicator_scores
-- Also grant observations + ingest_runs for consistent server-side CC access
grant select on table public.credit_cycle_observations to service_role;
grant select on table public.credit_cycle_snapshots to service_role;
grant select on table public.credit_cycle_indicator_scores to service_role;
grant select on table public.credit_cycle_ingest_runs to service_role;

-- Read-only verification (optional — run after apply; no data mutation)
select
  'service_role_select_' || table_name as check_name,
  case when count(*) filter (where privilege_type = 'SELECT') > 0 then 'PASS' else 'FAIL' end as result
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee = 'service_role'
   and table_name in (
     'credit_cycle_observations',
     'credit_cycle_snapshots',
     'credit_cycle_indicator_scores',
     'credit_cycle_ingest_runs'
   )
 group by table_name
 order by table_name;

-- Confirm anon payload still blocked (must stay PASS / 0 rows)
select
  'anon_payload_still_blocked' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name = 'credit_cycle_snapshots'
   and column_name = 'payload'
   and grantee in ('anon', 'authenticated')
   and privilege_type = 'SELECT';
