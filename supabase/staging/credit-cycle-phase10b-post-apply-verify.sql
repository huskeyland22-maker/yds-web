-- =============================================================================
-- Phase 10B post-apply verify (READ-ONLY) — Staging qzunuksxwwzusyivaznx ONLY
-- No INSERT/UPDATE/DELETE/SET ROLE. Never run on Production.
-- Each query returns check_name + result PASS|FAIL.
-- =============================================================================

-- 1) payload: anon/authenticated must have NO SELECT
select
  '1_payload_no_select' as check_name,
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as result,
  count(*)::int as bad_grants
  from information_schema.column_privileges
 where table_schema = 'public'
   and table_name = 'credit_cycle_snapshots'
   and column_name = 'payload'
   and grantee in ('anon', 'authenticated')
   and privilege_type = 'SELECT';

-- 2) public columns: exactly the 11 allowed SELECT grants per role (no payload)
with expected(col) as (
  values
    ('id'),
    ('as_of_date'),
    ('cci_score'),
    ('coverage'),
    ('confidence_status'),
    ('regime'),
    ('calculation_version'),
    ('data_mode'),
    ('pit_status'),
    ('hold_reason'),
    ('created_at')
),
granted as (
  select grantee, column_name
    from information_schema.column_privileges
   where table_schema = 'public'
     and table_name = 'credit_cycle_snapshots'
     and grantee in ('anon', 'authenticated')
     and privilege_type = 'SELECT'
),
per_role as (
  select r.grantee,
         count(*) filter (where g.column_name in (select col from expected)) as ok_cols,
         count(*) filter (where g.column_name not in (select col from expected)) as extra_cols,
         count(distinct g.column_name) filter (where g.column_name in (select col from expected)) as distinct_ok
    from (values ('anon'), ('authenticated')) as r(grantee)
    left join granted g on g.grantee = r.grantee
   group by r.grantee
)
select
  '2_public_columns_' || grantee as check_name,
  case
    when distinct_ok = 11 and extra_cols = 0 then 'PASS'
    else 'FAIL'
  end as result,
  distinct_ok,
  extra_cols
  from per_role
 order by grantee;

-- 3) HY/BBB CHECK includes raw_value + indicator_score + weighted_contribution NULL
select
  '3_hy_bbb_score_check' as check_name,
  case
    when def is null then 'FAIL'
    when def ~* 'raw_value\s+is\s+null'
     and def ~* 'indicator_score\s+is\s+null'
     and def ~* 'weighted_contribution\s+is\s+null'
     and def ~* 'license_restricted'
    then 'PASS'
    else 'FAIL'
  end as result,
  def as constraint_def
  from (
    select pg_get_constraintdef(con.oid) as def
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'credit_cycle_indicator_scores'
       and con.conname = 'credit_cycle_indicator_scores_hy_bbb_must_restrict'
     limit 1
  ) s;

-- 4) RLS enabled on all four Credit Cycle tables
select
  '4_rls_' || c.relname as check_name,
  case when c.relrowsecurity then 'PASS' else 'FAIL' end as result
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in (
     'credit_cycle_observations',
     'credit_cycle_snapshots',
     'credit_cycle_indicator_scores',
     'credit_cycle_ingest_runs'
   )
 order by c.relname;

-- 5) service_role SELECT present on all four CC tables (sb_secret 403 fix)
select
  '5_service_role_select_' || t.table_name as check_name,
  case when count(*) filter (where g.privilege_type = 'SELECT') > 0 then 'PASS' else 'FAIL' end as result
  from (
    values
      ('credit_cycle_observations'),
      ('credit_cycle_snapshots'),
      ('credit_cycle_indicator_scores'),
      ('credit_cycle_ingest_runs')
  ) as t(table_name)
  left join information_schema.role_table_grants g
    on g.table_schema = 'public'
   and g.table_name = t.table_name
   and g.grantee = 'service_role'
 group by t.table_name
 order by t.table_name;
