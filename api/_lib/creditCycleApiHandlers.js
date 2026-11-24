/**
 * Credit Cycle read API handlers (Phase 9).
 * Default: disabled. No Production fallback. No invented defaults.
 * Remote PostgREST only when CREDIT_CYCLE_API_ENABLED + staging URL + CREDIT_CYCLE_ALLOW_REMOTE.
 */

import {
  CREDIT_CYCLE_LICENSE_RESTRICTED_CODES,
  redactLicenseRestrictedIndicator,
  resolveCreditCycleServerConfig,
  resolveCreditCycleRestKey,
  buildCreditCycleRestAuthHeaders,
  maskCreditCycleUrl,
} from "./creditCycleEnv.js"

/**
 * PostgREST select list for snapshots — excludes `payload` (anon column revoke + defense in depth).
 * Keep in sync with rls.sql column grants (minus payload).
 */
export const CREDIT_CYCLE_SNAPSHOT_SELECT =
  "id,as_of_date,cci_score,coverage,confidence_status,regime,calculation_version,data_mode,pit_status,hold_reason,created_at"

/** Indicator score columns used by public mapping (no nested payload). */
export const CREDIT_CYCLE_SCORE_SELECT =
  "indicator_code,indicator_score,weighted_contribution,observation_date,release_date,quality_status,license_restricted,raw_value"

export function creditCycleNoStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
}

function json(res, status, body) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.end(JSON.stringify(body))
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function buildCreditCycleDisabledPayload(env = process.env) {
  const cfg = resolveCreditCycleServerConfig(env)
  return {
    ok: false,
    enabled: false,
    feedStatus: "API_DISABLED",
    mode: "license_safe",
    reason: cfg.reason,
    blockers: cfg.blockers,
    projectKind: cfg.projectKind,
    hint: "UI should keep using LOCAL_CACHE bundle until Staging is explicitly armed.",
    warningEvidence: "INSUFFICIENT_EVIDENCE",
  }
}

function remoteArmed(env = process.env) {
  const s = String(env.CREDIT_CYCLE_ALLOW_REMOTE || "").trim().toLowerCase()
  return s === "1" || s === "true" || s === "yes"
}

/**
 * Dedicated PostgREST fetch — uses ONLY CREDIT_CYCLE_* URL/key (no VITE fallback).
 * sb_secret / sb_publishable → apikey only; JWT → apikey + Authorization Bearer.
 * @param {string} pathQuery
 * @param {{ env?: NodeJS.ProcessEnv, preferService?: boolean }} [opts]
 */
export async function creditCycleStagingRest(pathQuery, opts = {}) {
  const env = opts.env || process.env
  const cfg = resolveCreditCycleServerConfig(env)
  if (!cfg.ok) {
    const err = new Error(`credit_cycle_not_configured:${cfg.reason}`)
    err.code = "NOT_CONFIGURED"
    throw err
  }
  if (!remoteArmed(env)) {
    const err = new Error("credit_cycle_remote_not_armed")
    err.code = "REMOTE_NOT_ARMED"
    throw err
  }
  const { key } = resolveCreditCycleRestKey(env)
  if (!key) {
    const err = new Error("credit_cycle_missing_key")
    err.code = "MISSING_KEY"
    throw err
  }
  const url = `${cfg.url}/rest/v1/${pathQuery}`
  const res = await fetch(url, {
    method: "GET",
    headers: buildCreditCycleRestAuthHeaders(key),
  })
  if (!res.ok) {
    const err = new Error(`credit_cycle_rest_http_${res.status}`)
    err.code = "REST_HTTP"
    throw err
  }
  return res.json()
}

/**
 * Public snapshot DTO — never forwards `payload` even if present on the row.
 * @param {Record<string, unknown> | null | undefined} row
 */
export function mapSnapshotRow(row) {
  if (!row) return null
  return {
    asOf: row.as_of_date,
    cci: row.cci_score ?? null,
    coverage: row.coverage ?? null,
    confidence: row.confidence_status ?? null,
    regime: row.regime ?? null,
    dataMode: row.data_mode,
    pitStatus: row.pit_status,
    holdReason: row.hold_reason ?? null,
    calculationVersion: row.calculation_version,
    updatedAt: row.created_at ?? null,
  }
}

function mapIndicatorPublic(row) {
  const code = String(row.indicator_code || "").toLowerCase()
  if (CREDIT_CYCLE_LICENSE_RESTRICTED_CODES.has(code) || row.license_restricted) {
    return redactLicenseRestrictedIndicator({
      id: code,
      indicator_code: code,
      license_restricted: true,
    })
  }
  return {
    id: code,
    indicator_code: code,
    value: row.raw_value ?? null,
    riskScore: row.indicator_score ?? null,
    contribution: row.weighted_contribution ?? null,
    observationDate: row.observation_date ?? null,
    releaseDate: row.release_date ?? null,
    qualityStatus: row.quality_status ?? null,
    license_restricted: false,
  }
}

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 */
export async function handleCreditCycleLatest(req, res, opts = {}) {
  creditCycleNoStore(res)
  const env = opts.env || process.env
  const cfg = resolveCreditCycleServerConfig(env)
  if (!cfg.ok || !remoteArmed(env)) {
    json(res, 503, {
      ...buildCreditCycleDisabledPayload(env),
      remoteArmed: remoteArmed(env),
      urlMasked: maskCreditCycleUrl(env.CREDIT_CYCLE_SUPABASE_URL || ""),
    })
    return
  }
  try {
    const rows = await creditCycleStagingRest(
      `credit_cycle_snapshots?select=${CREDIT_CYCLE_SNAPSHOT_SELECT}&data_mode=eq.license_safe&order=as_of_date.desc&limit=1`,
      { env },
    )
    const latest = Array.isArray(rows) ? rows[0] : null
    if (!latest) {
      json(res, 404, {
        ok: false,
        feedStatus: "STAGING_API",
        reason: "no_snapshot",
        mode: "license_safe",
      })
      return
    }
    const mapped = mapSnapshotRow(latest)
    json(res, 200, {
      ok: true,
      feedStatus: "STAGING_API",
      mode: "license_safe",
      ...mapped,
      warningEvidence: "INSUFFICIENT_EVIDENCE",
    })
  } catch (e) {
    json(res, 503, {
      ok: false,
      feedStatus: "STAGING_API_ERROR",
      reason: e?.code || e?.message || "latest_failed",
    })
  }
}

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 */
export async function handleCreditCycleHistory(req, res, opts = {}) {
  creditCycleNoStore(res)
  const env = opts.env || process.env
  const cfg = resolveCreditCycleServerConfig(env)
  if (!cfg.ok || !remoteArmed(env)) {
    json(res, 503, {
      ...buildCreditCycleDisabledPayload(env),
      remoteArmed: remoteArmed(env),
    })
    return
  }
  try {
    const url = new URL(req.url || "", "http://localhost")
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 120) || 120))
    const rows = await creditCycleStagingRest(
      `credit_cycle_snapshots?select=${CREDIT_CYCLE_SNAPSHOT_SELECT}&data_mode=eq.license_safe&order=as_of_date.asc&limit=${limit}`,
      { env },
    )
    const list = Array.isArray(rows) ? rows : []
    const sorted = list
      .map(mapSnapshotRow)
      .filter(Boolean)
      .sort((a, b) => String(a.asOf).localeCompare(String(b.asOf)))
    json(res, 200, {
      ok: true,
      feedStatus: "STAGING_API",
      mode: "license_safe",
      points: sorted,
    })
  } catch (e) {
    json(res, 503, {
      ok: false,
      feedStatus: "STAGING_API_ERROR",
      reason: e?.code || e?.message || "history_failed",
    })
  }
}

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 */
export async function handleCreditCycleIndicators(req, res, opts = {}) {
  creditCycleNoStore(res)
  const env = opts.env || process.env
  const cfg = resolveCreditCycleServerConfig(env)
  if (!cfg.ok || !remoteArmed(env)) {
    json(res, 503, {
      ...buildCreditCycleDisabledPayload(env),
      remoteArmed: remoteArmed(env),
    })
    return
  }
  try {
    const snaps = await creditCycleStagingRest(
      `credit_cycle_snapshots?select=${CREDIT_CYCLE_SNAPSHOT_SELECT}&data_mode=eq.license_safe&order=as_of_date.desc&limit=1`,
      { env },
    )
    const snap = Array.isArray(snaps) ? snaps[0] : null
    if (!snap?.id) {
      json(res, 404, { ok: false, reason: "no_snapshot", feedStatus: "STAGING_API" })
      return
    }
    const scores = await creditCycleStagingRest(
      `credit_cycle_indicator_scores?select=${CREDIT_CYCLE_SCORE_SELECT}&snapshot_id=eq.${snap.id}`,
      { env },
    )
    const indicators = (Array.isArray(scores) ? scores : []).map(mapIndicatorPublic)
    // Ensure HY/BBB placeholders exist as restricted even if absent
    for (const code of CREDIT_CYCLE_LICENSE_RESTRICTED_CODES) {
      if (!indicators.some((i) => i.id === code || i.indicator_code === code)) {
        indicators.push(
          redactLicenseRestrictedIndicator({ indicator_code: code, license_restricted: true }),
        )
      }
    }
    json(res, 200, {
      ok: true,
      feedStatus: "STAGING_API",
      mode: "license_safe",
      asOf: snap.as_of_date,
      indicators,
    })
  } catch (e) {
    json(res, 503, {
      ok: false,
      feedStatus: "STAGING_API_ERROR",
      reason: e?.code || e?.message || "indicators_failed",
    })
  }
}
