-- =============================================================================
-- P2-24 DRAFT 01 — schema: panic_score_status
-- DO NOT APPLY to production without staging review (P2-23).
-- Source of truth for current tables:
--   20250515140000_panic_index_history.sql + 20250519150000_* alters
--   20250519150000_panic_history_storage_stable.sql (latest_panic_metrics, market_cycle_history)
--   20250519160000_daily_ai_reports.sql
-- =============================================================================

-- Allow-list for status (NULL permitted for pre-backfill / legacy writers)
-- Values: ok | data_insufficient | stored_unverified

alter table public.panic_index_history
  add column if not exists panic_score_status text;

alter table public.latest_panic_metrics
  add column if not exists panic_score_status text;

alter table public.market_cycle_history
  add column if not exists panic_score_status text;

alter table public.daily_ai_reports
  add column if not exists panic_score_status text;

-- CHECK constraints (nullable). Names are stable for later drop if needed.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'panic_index_history_panic_score_status_chk'
  ) then
    alter table public.panic_index_history
      add constraint panic_index_history_panic_score_status_chk
      check (
        panic_score_status is null
        or panic_score_status in ('ok', 'data_insufficient', 'stored_unverified')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'latest_panic_metrics_panic_score_status_chk'
  ) then
    alter table public.latest_panic_metrics
      add constraint latest_panic_metrics_panic_score_status_chk
      check (
        panic_score_status is null
        or panic_score_status in ('ok', 'data_insufficient', 'stored_unverified')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'market_cycle_history_panic_score_status_chk'
  ) then
    alter table public.market_cycle_history
      add constraint market_cycle_history_panic_score_status_chk
      check (
        panic_score_status is null
        or panic_score_status in ('ok', 'data_insufficient', 'stored_unverified')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'daily_ai_reports_panic_score_status_chk'
  ) then
    alter table public.daily_ai_reports
      add constraint daily_ai_reports_panic_score_status_chk
      check (
        panic_score_status is null
        or panic_score_status in ('ok', 'data_insufficient', 'stored_unverified')
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Backfill: numeric rows only → stored_unverified (never classify as Official)
-- NULL score rows: leave status NULL (P2-23)
-- Do NOT modify panic_score values.
-- -----------------------------------------------------------------------------
update public.panic_index_history
set panic_score_status = 'stored_unverified'
where panic_score is not null
  and panic_score_status is null;

update public.latest_panic_metrics
set panic_score_status = 'stored_unverified'
where panic_score is not null
  and panic_score_status is null;

update public.market_cycle_history
set panic_score_status = 'stored_unverified'
where panic_score is not null
  and panic_score_status is null;

update public.daily_ai_reports
set panic_score_status = 'stored_unverified'
where panic_score is not null
  and panic_score_status is null;

-- Optional comment for operators
comment on column public.panic_index_history.panic_score_status is
  'P2-24: ok | data_insufficient | stored_unverified; null = pre-contract / unset';
comment on column public.latest_panic_metrics.panic_score_status is
  'P2-24: synced from panic_index_history; same allow-list';
comment on column public.market_cycle_history.panic_score_status is
  'P2-24: ok | data_insufficient | stored_unverified; null = pre-contract / unset';
comment on column public.daily_ai_reports.panic_score_status is
  'P2-24: ok | data_insufficient | stored_unverified; null = pre-contract / unset';
