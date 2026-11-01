-- =============================================================================
-- P2-24 DRAFT 03 — privilege VERIFY + optional HARDEN (P2-26)
-- DO NOT APPLY harden section without operator review of VERIFY results.
--
-- LIVE FACT: PUBLIC / anon / authenticated EXECUTE on these functions is
--            UNCONFIRMED. Migration files only show GRANT TO service_role;
--            that does NOT prove PUBLIC was revoked in the live DB.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) VERIFY (read-only) — run on staging/live to inspect current grants
-- -----------------------------------------------------------------------------
-- Expected minimum policy (proposal, not yet enforced):
--   service_role: EXECUTE yes
--   anon / authenticated / PUBLIC: EXECUTE no
-- on:
--   yds_resolve_panic_score_write(jsonb)
--   upsert_panic_index_history_fill(jsonb)
--   sync_latest_panic_metrics(date)
--   upsert_market_cycle_history_fill(jsonb)
--   upsert_daily_ai_report_fill(jsonb)

-- Role grantees (anon / authenticated / service_role). Skip missing roles.
select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  r.rolname as grantee,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.rolname in ('anon', 'authenticated', 'service_role')
where n.nspname = 'public'
  and p.proname in (
    'yds_resolve_panic_score_write',
    'upsert_panic_index_history_fill',
    'sync_latest_panic_metrics',
    'upsert_market_cycle_history_fill',
    'upsert_daily_ai_report_fill'
  )
order by p.proname, r.rolname;

-- PUBLIC pseudo-grantee via ACL explode (PUBLIC is not in pg_roles; oid 0)
-- If a row appears with privilege_type EXECUTE, PUBLIC can execute that function.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  'PUBLIC'::text as grantee,
  a.privilege_type,
  a.is_grantable
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as a on true
where n.nspname = 'public'
  and p.proname in (
    'yds_resolve_panic_score_write',
    'upsert_panic_index_history_fill',
    'sync_latest_panic_metrics',
    'upsert_market_cycle_history_fill',
    'upsert_daily_ai_report_fill'
  )
  and a.grantee = 0
  and a.privilege_type = 'EXECUTE'
order by p.proname;

-- ACL text dump (includes PUBLIC if present)
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'yds_resolve_panic_score_write',
    'upsert_panic_index_history_fill',
    'sync_latest_panic_metrics',
    'upsert_market_cycle_history_fill',
    'upsert_daily_ai_report_fill'
  )
order by p.proname;

-- -----------------------------------------------------------------------------
-- B) OPTIONAL HARDEN (draft only — DO NOT RUN until VERIFY reviewed)
-- Proposed least privilege: revoke broad execute, keep service_role.
-- Uncomment and run only after confirming VERIFY output and change window.
-- -----------------------------------------------------------------------------
/*
revoke all on function public.yds_resolve_panic_score_write(jsonb) from public;
revoke all on function public.yds_resolve_panic_score_write(jsonb) from anon;
revoke all on function public.yds_resolve_panic_score_write(jsonb) from authenticated;
grant execute on function public.yds_resolve_panic_score_write(jsonb) to service_role;

revoke all on function public.upsert_panic_index_history_fill(jsonb) from public;
revoke all on function public.upsert_panic_index_history_fill(jsonb) from anon;
revoke all on function public.upsert_panic_index_history_fill(jsonb) from authenticated;
grant execute on function public.upsert_panic_index_history_fill(jsonb) to service_role;

revoke all on function public.sync_latest_panic_metrics(date) from public;
revoke all on function public.sync_latest_panic_metrics(date) from anon;
revoke all on function public.sync_latest_panic_metrics(date) from authenticated;
grant execute on function public.sync_latest_panic_metrics(date) to service_role;

revoke all on function public.upsert_market_cycle_history_fill(jsonb) from public;
revoke all on function public.upsert_market_cycle_history_fill(jsonb) from anon;
revoke all on function public.upsert_market_cycle_history_fill(jsonb) from authenticated;
grant execute on function public.upsert_market_cycle_history_fill(jsonb) to service_role;

revoke all on function public.upsert_daily_ai_report_fill(jsonb) from public;
revoke all on function public.upsert_daily_ai_report_fill(jsonb) from anon;
revoke all on function public.upsert_daily_ai_report_fill(jsonb) from authenticated;
grant execute on function public.upsert_daily_ai_report_fill(jsonb) to service_role;
*/
