-- =============================================================================
-- P2-24 DRAFT 02 — RPC: Official score write contract (A+C hybrid)
-- P2-26: P1 fixes (status null reject, long/recommendation independent,
--         INSERT=UPDATE validation, legacy bad-score reject)
-- P2-28: legacy numeric write → stored_unverified (never keep/promote ok)
-- DO NOT APPLY without P2-24_01 and staging tests.
--
-- Confirmed baseline function signatures (unchanged returns):
--   upsert_panic_index_history_fill(jsonb) → panic_index_history
--   sync_latest_panic_metrics(date) → latest_panic_metrics
--   upsert_market_cycle_history_fill(jsonb) → market_cycle_history
--   upsert_daily_ai_report_fill(jsonb) → daily_ai_reports
-- Source: migrations 20250519150000_*, 20250519160000_*
--
-- short_score / mid_score / long_score / recommendation: independent coalesce
--   (baseline contract preserved; NOT auto-bound to Official clear)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: resolve panic_score + panic_score_status write intent from jsonb
-- apply = false → UPDATE/INSERT must keep existing / insert null (key omit)
-- err  != null → caller MUST raise (never silent-ignore ambiguous/invalid)
-- -----------------------------------------------------------------------------
create or replace function public.yds_resolve_panic_score_write(p_payload jsonb)
returns table (
  apply boolean,
  new_score double precision,
  new_status text,
  err text
)
language plpgsql
immutable
as $$
declare
  has_score boolean := (p_payload ? 'panic_score');
  has_status boolean := (p_payload ? 'panic_score_status');
  raw_status text;
  raw_score_txt text;
  score_num double precision;
begin
  -- Both omitted → keep existing
  if not has_score and not has_status then
    return query select false, null::double precision, null::text, null::text;
    return;
  end if;

  -- Status key present: null / empty string is explicit reject (P2-26)
  if has_status then
    raw_status := nullif(btrim(p_payload->>'panic_score_status'), '');
    if raw_status is null then
      return query select false, null::double precision, null::text,
        'panic_score_status_null_or_empty_not_allowed'::text;
      return;
    end if;

    if raw_status = 'stored_unverified' then
      return query select false, null::double precision, null::text,
        'stored_unverified_not_allowed_on_write'::text;
      return;
    end if;

    -- Explicit Official insufficient → clear score (numeric panic_score ignored if also sent)
    if raw_status = 'data_insufficient' then
      return query select true, null::double precision, 'data_insufficient'::text, null::text;
      return;
    end if;

    -- ok requires finite 0..100 (includes real Official 50)
    if raw_status = 'ok' then
      raw_score_txt := p_payload->>'panic_score';
      if raw_score_txt is null or btrim(raw_score_txt) = '' then
        return query select false, null::double precision, null::text,
          'ok_requires_finite_panic_score'::text;
        return;
      end if;
      begin
        score_num := raw_score_txt::double precision;
      exception when others then
        return query select false, null::double precision, null::text,
          'ok_requires_finite_panic_score'::text;
        return;
      end;
      -- NaN / ±Infinity / non-finite / out of range
      if score_num is null
         or score_num <> score_num
         or score_num = 'Infinity'::double precision
         or score_num = '-Infinity'::double precision then
        return query select false, null::double precision, null::text,
          'ok_requires_finite_panic_score'::text;
        return;
      end if;
      if score_num < 0 or score_num > 100 then
        return query select false, null::double precision, null::text,
          'ok_score_out_of_range'::text;
        return;
      end if;
      return query select true, score_num, 'ok'::text, null::text;
      return;
    end if;

    return query select false, null::double precision, null::text,
      'invalid_panic_score_status'::text;
    return;
  end if;

  -- Legacy payload: score key present, status key fully omitted
  -- null/empty score → do NOT clear (compat with old coalesce)
  -- numeric score → finite 0..100 + status stored_unverified (P2-28)
  --   Does NOT prove Official provenance: never leave/promote status=ok.
  --   Clears prior data_insufficient contradiction (score set + insufficient).
  -- App writers still cannot send status=stored_unverified explicitly (above).
  raw_score_txt := p_payload->>'panic_score';
  if raw_score_txt is null or btrim(raw_score_txt) = '' then
    return query select false, null::double precision, null::text, null::text;
    return;
  end if;
  begin
    score_num := raw_score_txt::double precision;
  exception when others then
    return query select false, null::double precision, null::text,
      'legacy_panic_score_invalid'::text;
    return;
  end;
  if score_num is null
     or score_num <> score_num
     or score_num = 'Infinity'::double precision
     or score_num = '-Infinity'::double precision then
    return query select false, null::double precision, null::text,
      'legacy_panic_score_invalid'::text;
    return;
  end if;
  if score_num < 0 or score_num > 100 then
    return query select false, null::double precision, null::text,
      'legacy_panic_score_out_of_range'::text;
    return;
  end if;
  return query select true, score_num, 'stored_unverified'::text, null::text;
end;
$$;

-- =============================================================================
-- upsert_panic_index_history_fill
-- Metric columns keep NULL-fill coalesce; score uses yds_resolve_panic_score_write
-- INSERT and UPDATE use the same intent (no second payload cast for score)
-- =============================================================================
create or replace function public.upsert_panic_index_history_fill(p_payload jsonb)
returns public.panic_index_history
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.panic_index_history;
  d date;
  intent record;
begin
  d := (p_payload->>'date')::date;
  if d is null then
    raise exception 'invalid date';
  end if;

  select * into intent from public.yds_resolve_panic_score_write(p_payload);
  if intent.err is not null then
    raise exception '%', intent.err;
  end if;

  insert into public.panic_index_history as t (
    date,
    vix, vxn, fear_greed, put_call, move, bofa, skew, hy_oas, gs_sentiment,
    high_yield, gs_bb, market, source,
    panic_score, panic_score_status, market_phase, risk_level, strategy,
    created_at, updated_at
  )
  values (
    d,
    nullif(p_payload->>'vix', '')::double precision,
    nullif(p_payload->>'vxn', '')::double precision,
    nullif(p_payload->>'fear_greed', '')::double precision,
    nullif(p_payload->>'put_call', '')::double precision,
    nullif(p_payload->>'move', '')::double precision,
    nullif(p_payload->>'bofa', '')::double precision,
    nullif(p_payload->>'skew', '')::double precision,
    nullif(p_payload->>'hy_oas', '')::double precision,
    nullif(p_payload->>'gs_sentiment', '')::double precision,
    nullif(p_payload->>'high_yield', '')::double precision,
    nullif(p_payload->>'gs_bb', '')::double precision,
    coalesce(nullif(p_payload->>'market', ''), 'global'),
    coalesce(nullif(p_payload->>'source', ''), 'api'),
    case when intent.apply then intent.new_score else null end,
    case when intent.apply then intent.new_status else null end,
    nullif(p_payload->>'market_phase', ''),
    nullif(p_payload->>'risk_level', ''),
    nullif(p_payload->>'strategy', ''),
    coalesce((p_payload->>'created_at')::timestamptz, now()),
    coalesce((p_payload->>'updated_at')::timestamptz, now())
  )
  on conflict (date) do update set
    vix = coalesce(excluded.vix, t.vix),
    vxn = coalesce(excluded.vxn, t.vxn),
    fear_greed = coalesce(excluded.fear_greed, t.fear_greed),
    put_call = coalesce(excluded.put_call, t.put_call),
    move = coalesce(excluded.move, t.move),
    bofa = coalesce(excluded.bofa, t.bofa),
    skew = coalesce(excluded.skew, t.skew),
    hy_oas = coalesce(excluded.hy_oas, t.hy_oas),
    gs_sentiment = coalesce(excluded.gs_sentiment, t.gs_sentiment),
    high_yield = coalesce(excluded.high_yield, t.high_yield),
    gs_bb = coalesce(excluded.gs_bb, t.gs_bb),
    market = coalesce(excluded.market, t.market),
    source = coalesce(excluded.source, t.source),
    panic_score = case
      when intent.apply then intent.new_score
      else t.panic_score
    end,
    panic_score_status = case
      when intent.apply and intent.new_status is not null then intent.new_status
      else t.panic_score_status
    end,
    market_phase = coalesce(excluded.market_phase, t.market_phase),
    risk_level = coalesce(excluded.risk_level, t.risk_level),
    strategy = coalesce(excluded.strategy, t.strategy),
    updated_at = now()
  returning * into r;

  perform public.sync_latest_panic_metrics(d);
  return r;
end;
$$;

-- =============================================================================
-- sync_latest_panic_metrics — copy score + status atomically from history
-- =============================================================================
create or replace function public.sync_latest_panic_metrics(p_date date default null)
returns public.latest_panic_metrics
language plpgsql
security definer
set search_path = public
as $$
declare
  src public.panic_index_history;
  d date;
  out public.latest_panic_metrics;
begin
  if p_date is not null then
    d := p_date;
  else
    select h.date into d
    from public.panic_index_history h
    order by h.date desc
    limit 1;
  end if;

  if d is null then
    return null;
  end if;

  select * into src from public.panic_index_history where date = d;
  if not found then
    return null;
  end if;

  insert into public.latest_panic_metrics (
    id, date, vix, vxn, fear_greed, put_call, move, bofa, skew, hy_oas, gs_sentiment,
    panic_score, panic_score_status, updated_at
  )
  values (
    'global',
    src.date,
    src.vix,
    src.vxn,
    src.fear_greed,
    src.put_call,
    src.move,
    src.bofa,
    src.skew,
    coalesce(src.hy_oas, src.high_yield),
    coalesce(src.gs_sentiment, src.gs_bb),
    src.panic_score,
    src.panic_score_status,
    now()
  )
  on conflict (id) do update set
    date = excluded.date,
    vix = excluded.vix,
    vxn = excluded.vxn,
    fear_greed = excluded.fear_greed,
    put_call = excluded.put_call,
    move = excluded.move,
    bofa = excluded.bofa,
    skew = excluded.skew,
    hy_oas = excluded.hy_oas,
    gs_sentiment = excluded.gs_sentiment,
    panic_score = excluded.panic_score,
    panic_score_status = excluded.panic_score_status,
    updated_at = now()
  returning * into out;

  return out;
end;
$$;

-- =============================================================================
-- upsert_market_cycle_history_fill
-- short_score / mid_score / long_score / recommendation: baseline independent coalesce
-- P2-26: do NOT bind long_score or recommendation to Official panic clear/apply
-- =============================================================================
create or replace function public.upsert_market_cycle_history_fill(p_payload jsonb)
returns public.market_cycle_history
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.market_cycle_history;
  d date;
  intent record;
begin
  d := (p_payload->>'date')::date;
  if d is null then
    raise exception 'invalid date';
  end if;

  select * into intent from public.yds_resolve_panic_score_write(p_payload);
  if intent.err is not null then
    raise exception '%', intent.err;
  end if;

  insert into public.market_cycle_history as t (
    date, panic_score, panic_score_status, market_state, risk_signal, sector, volatility,
    short_score, mid_score, long_score, recommendation, source,
    created_at, updated_at
  )
  values (
    d,
    case when intent.apply then intent.new_score else null end,
    case when intent.apply then intent.new_status else null end,
    nullif(p_payload->>'market_state', ''),
    nullif(p_payload->>'risk_signal', ''),
    nullif(p_payload->>'sector', ''),
    nullif(p_payload->>'volatility', ''),
    nullif(p_payload->>'short_score', '')::double precision,
    nullif(p_payload->>'mid_score', '')::double precision,
    nullif(p_payload->>'long_score', '')::double precision,
    nullif(p_payload->>'recommendation', ''),
    coalesce(nullif(p_payload->>'source', ''), 'api'),
    coalesce((p_payload->>'created_at')::timestamptz, now()),
    coalesce((p_payload->>'updated_at')::timestamptz, now())
  )
  on conflict (date) do update set
    panic_score = case
      when intent.apply then intent.new_score
      else t.panic_score
    end,
    panic_score_status = case
      when intent.apply and intent.new_status is not null then intent.new_status
      else t.panic_score_status
    end,
    market_state = coalesce(excluded.market_state, t.market_state),
    risk_signal = coalesce(excluded.risk_signal, t.risk_signal),
    sector = coalesce(excluded.sector, t.sector),
    volatility = coalesce(excluded.volatility, t.volatility),
    short_score = coalesce(excluded.short_score, t.short_score),
    mid_score = coalesce(excluded.mid_score, t.mid_score),
    long_score = coalesce(excluded.long_score, t.long_score),
    recommendation = coalesce(excluded.recommendation, t.recommendation),
    source = coalesce(excluded.source, t.source),
    updated_at = now()
  returning * into r;

  return r;
end;
$$;

-- =============================================================================
-- upsert_daily_ai_report_fill
-- =============================================================================
create or replace function public.upsert_daily_ai_report_fill(p_payload jsonb)
returns public.daily_ai_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.daily_ai_reports;
  d date;
  intent record;
begin
  d := (p_payload->>'date')::date;
  if d is null then raise exception 'invalid date'; end if;

  select * into intent from public.yds_resolve_panic_score_write(p_payload);
  if intent.err is not null then
    raise exception '%', intent.err;
  end if;

  insert into public.daily_ai_reports as t (
    date, summary, market_view, short_strategy, mid_strategy, long_strategy,
    risk_note, priority_sector, panic_score, panic_score_status, market_state, source,
    created_at, updated_at
  )
  values (
    d,
    coalesce(nullif(p_payload->>'summary', ''), ''),
    nullif(p_payload->>'market_view', ''),
    nullif(p_payload->>'short_strategy', ''),
    nullif(p_payload->>'mid_strategy', ''),
    nullif(p_payload->>'long_strategy', ''),
    nullif(p_payload->>'risk_note', ''),
    nullif(p_payload->>'priority_sector', ''),
    case when intent.apply then intent.new_score else null end,
    case when intent.apply then intent.new_status else null end,
    nullif(p_payload->>'market_state', ''),
    coalesce(nullif(p_payload->>'source', ''), 'auto'),
    coalesce((p_payload->>'created_at')::timestamptz, now()),
    now()
  )
  on conflict (date) do update set
    summary = coalesce(nullif(excluded.summary, ''), t.summary),
    market_view = coalesce(excluded.market_view, t.market_view),
    short_strategy = coalesce(excluded.short_strategy, t.short_strategy),
    mid_strategy = coalesce(excluded.mid_strategy, t.mid_strategy),
    long_strategy = coalesce(excluded.long_strategy, t.long_strategy),
    risk_note = coalesce(excluded.risk_note, t.risk_note),
    priority_sector = coalesce(excluded.priority_sector, t.priority_sector),
    panic_score = case
      when intent.apply then intent.new_score
      else t.panic_score
    end,
    panic_score_status = case
      when intent.apply and intent.new_status is not null then intent.new_status
      else t.panic_score_status
    end,
    market_state = coalesce(excluded.market_state, t.market_state),
    source = coalesce(excluded.source, t.source),
    updated_at = now()
  returning * into r;

  return r;
end;
$$;

grant execute on function public.yds_resolve_panic_score_write(jsonb) to service_role;
grant execute on function public.upsert_panic_index_history_fill(jsonb) to service_role;
grant execute on function public.sync_latest_panic_metrics(date) to service_role;
grant execute on function public.upsert_market_cycle_history_fill(jsonb) to service_role;
grant execute on function public.upsert_daily_ai_report_fill(jsonb) to service_role;

-- NOTE: Live PUBLIC/anon/authenticated EXECUTE is UNCONFIRMED.
-- See P2-24_03_privilege_verify_and_harden.sql (verify + optional harden draft only).
