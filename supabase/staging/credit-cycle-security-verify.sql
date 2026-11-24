-- =============================================================================
-- YDS Credit Cycle — STAGING security verification (DO NOT auto-run)
-- =============================================================================
-- Manual checks AFTER schema.sql + rls.sql on Staging only
-- (ref qzunuksxwwzusyivaznx). Never run against Production.
-- Does not DELETE/TRUNCATE/DROP tables or touch panic_*.
-- =============================================================================

-- 1) Allowed snapshot columns: should succeed for roles with grants (as postgres/owner)
--    Expect: query OK (0+ rows).
select id, as_of_date, cci_score, coverage, confidence_status, regime,
       calculation_version, data_mode, pit_status, hold_reason, created_at
  from public.credit_cycle_snapshots
 where data_mode = 'license_safe'
 limit 1;

-- 2) payload column privilege for anon — expect FAILURE (permission denied for column payload)
--    Run in a session that SET ROLE anon; (or via PostgREST with anon key selecting payload)
-- set local role anon;
-- select payload from public.credit_cycle_snapshots limit 1;
-- Expected: ERROR: permission denied for column payload
-- Reset: reset role;

-- 3) Documented check (owner): confirm privilege catalog — payload must NOT appear for anon
select privilege_type, column_name
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name = 'credit_cycle_snapshots'
   and grantee in ('anon', 'authenticated')
 order by grantee, column_name;
-- Expected: listed public columns only; no row for column_name = 'payload'

-- 4) HY/BBB score insert must fail when numerics present
--    Expect: CHECK violation (credit_cycle_indicator_scores_hy_bbb_must_restrict)
-- do $$
-- declare
--   sid uuid;
-- begin
--   insert into public.credit_cycle_snapshots (as_of_date, data_mode, pit_status)
--   values (current_date, 'license_safe', 'UNKNOWN')
--   returning id into sid;
--   insert into public.credit_cycle_indicator_scores (
--     snapshot_id, indicator_code, license_restricted,
--     raw_value, indicator_score, weighted_contribution
--   ) values (sid, 'hy', true, 1.0, 80.0, 16.0);
-- end $$;
-- Prefer ROLLBACK in a transaction when testing inserts.

-- 5) HY/BBB placeholder row with all numerics NULL — allowed
-- insert into ... (..., 'hy', true, null, null, null) — should succeed, then ROLLBACK.

-- 6) Panic isolation — expect existing panic objects unchanged (read-only probe)
select c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
   and c.relname like 'panic%'
 order by 1;
-- Credit Cycle DDL must not appear in this list as panic_* renames; CC tables are credit_cycle_*.
