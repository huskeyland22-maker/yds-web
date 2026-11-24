-- =============================================================================
-- Staging ONLY — minimal service_role INSERT for Credit Cycle test seed
-- Project ref: qzunuksxwwzusyivaznx
-- NEVER run on Production (oausvweyocgynjpeguka).
--
-- Prerequisite: SELECT grants already applied.
-- Scope: INSERT on snapshots + indicator_scores ONLY.
-- No INSERT on observations / ingest_runs.
-- No change to anon/authenticated.
-- No UPDATE / DELETE / TRUNCATE grants.
-- =============================================================================

do $$
begin
  raise notice 'CREDIT_CYCLE_SERVICE_ROLE_INSERT_GRANTS: verify Staging ref before apply';
end $$;

grant insert on table public.credit_cycle_snapshots to service_role;
grant insert on table public.credit_cycle_indicator_scores to service_role;

-- Verify (read-only)
select
  table_name,
  privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee = 'service_role'
   and table_name in (
     'credit_cycle_snapshots',
     'credit_cycle_indicator_scores'
   )
   and privilege_type in ('SELECT', 'INSERT')
 order by table_name, privilege_type;
