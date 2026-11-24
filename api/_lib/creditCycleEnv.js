/**
 * Credit Cycle Staging env gate (Phase 9 + Phase 10B sb_secret support).
 * - Never falls back to VITE_SUPABASE_URL / generic SUPABASE_URL for CC DB.
 * - Never exposes service_role / sb_secret to the browser.
 * - Default: API disabled → safe local JSON mode remains UI primary.
 */

export const CREDIT_CYCLE_STAGING_REF = "qzunuksxwwzusyivaznx"
export const CREDIT_CYCLE_PRODUCTION_REF = "oausvweyocgynjpeguka"

/** ICE / license-restricted indicator codes — never return numeric fields publicly. */
export const CREDIT_CYCLE_LICENSE_RESTRICTED_CODES = new Set(["hy", "bbb"])

/**
 * @param {string | null | undefined} url
 * @returns {'staging'|'production'|'missing'|'other'}
 */
export function classifyCreditCycleSupabaseUrl(url) {
  const raw = String(url ?? "").trim().toLowerCase()
  if (!raw) return "missing"
  if (raw.includes(CREDIT_CYCLE_PRODUCTION_REF)) return "production"
  if (raw.includes(CREDIT_CYCLE_STAGING_REF)) return "staging"
  return "other"
}

/**
 * Classify Supabase API key shape without logging the value.
 * @param {string | null | undefined} key
 * @returns {'sb_secret'|'sb_publishable'|'jwt'|'unknown'|'missing'}
 */
export function classifyCreditCycleSupabaseKey(key) {
  const raw = String(key ?? "").trim()
  if (!raw) return "missing"
  const lower = raw.toLowerCase()
  if (lower.startsWith("sb_secret_")) return "sb_secret"
  if (lower.startsWith("sb_publishable_") || lower.startsWith("sb_p")) return "sb_publishable"
  // Classic JWT anon / service_role
  if (raw.startsWith("eyJ")) return "jwt"
  return "unknown"
}

/**
 * Build PostgREST auth headers for a key.
 * - sb_secret / sb_publishable: apikey only (no Authorization Bearer)
 * - JWT (and unknown legacy): apikey + Authorization Bearer
 * Never returns or logs the raw key outside header values used for the request.
 * @param {string} key
 * @returns {Record<string, string>}
 */
export function buildCreditCycleRestAuthHeaders(key) {
  const k = String(key ?? "").trim()
  const kind = classifyCreditCycleSupabaseKey(k)
  /** @type {Record<string, string>} */
  const headers = {
    apikey: k,
    Accept: "application/json",
  }
  if (kind === "sb_secret" || kind === "sb_publishable") {
    return headers
  }
  // JWT service_role / anon (and unknown fallback for legacy keys)
  headers.Authorization = `Bearer ${k}`
  return headers
}

/**
 * Prefer server privileged key: SECRET_KEY alias, then SERVICE_ROLE_KEY, then anon.
 * Values are never logged by this helper.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveCreditCycleRestKey(env = process.env) {
  const secretAlias = String(env.CREDIT_CYCLE_SUPABASE_SECRET_KEY || "").trim()
  const serviceKey = String(env.CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY || "").trim()
  const anonKey = String(env.CREDIT_CYCLE_SUPABASE_ANON_KEY || "").trim()
  const privileged = secretAlias || serviceKey
  if (privileged) {
    const kind = classifyCreditCycleSupabaseKey(privileged)
    return {
      key: privileged,
      keyKind:
        kind === "sb_secret"
          ? "sb_secret"
          : kind === "jwt"
            ? "jwt_service_role"
            : kind === "unknown"
              ? "service_role"
              : kind,
      privileged: true,
    }
  }
  if (anonKey) {
    const kind = classifyCreditCycleSupabaseKey(anonKey)
    return {
      key: anonKey,
      keyKind: kind === "sb_publishable" ? "sb_publishable" : kind === "jwt" ? "anon_jwt" : "anon",
      privileged: false,
    }
  }
  return { key: "", keyKind: null, privileged: false }
}

function truthy(v) {
  const s = String(v ?? "").trim().toLowerCase()
  return s === "1" || s === "true" || s === "yes" || s === "on"
}

/**
 * Resolve CC-dedicated config from process.env (server only).
 * Does NOT read VITE_SUPABASE_URL as a fallback for DB URL.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveCreditCycleServerConfig(env = process.env) {
  const apiEnabled = truthy(env.CREDIT_CYCLE_API_ENABLED)
  const dataMode = String(env.CREDIT_CYCLE_DATA_MODE || "local").trim().toLowerCase()
  const url = String(env.CREDIT_CYCLE_SUPABASE_URL || "").trim().replace(/\/+$/, "")
  const restKey = resolveCreditCycleRestKey(env)
  const serviceKey = String(
    env.CREDIT_CYCLE_SUPABASE_SECRET_KEY || env.CREDIT_CYCLE_SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim()
  // Anon is optional for server-side reads; prefer privileged key on server.
  const anonKey = String(env.CREDIT_CYCLE_SUPABASE_ANON_KEY || "").trim()

  const projectKind = classifyCreditCycleSupabaseUrl(url)

  /** @type {string[]} */
  const blockers = []

  if (!apiEnabled) blockers.push("api_disabled")
  if (dataMode === "local" || dataMode === "local_cache") {
    blockers.push("data_mode_local")
  }
  if (!url) blockers.push("missing_credit_cycle_supabase_url")
  if (projectKind === "production") blockers.push("production_url_refused")
  if (projectKind === "missing") blockers.push("url_missing")
  if (projectKind === "other") blockers.push("non_staging_project_ref")
  if (!serviceKey && !anonKey) blockers.push("missing_credit_cycle_key")
  // Hard rule: never allow Prod
  if (projectKind === "production") {
    return {
      ok: false,
      enabled: false,
      apiEnabled,
      dataMode,
      projectKind,
      url: "",
      keyPresent: false,
      keyKind: null,
      blockers: [...new Set(blockers)],
      reason: "production_url_refused",
    }
  }

  const ok =
    apiEnabled &&
    (dataMode === "staging" || dataMode === "staging_api") &&
    projectKind === "staging" &&
    Boolean(url) &&
    Boolean(serviceKey || anonKey)

  return {
    ok,
    enabled: ok,
    apiEnabled,
    dataMode,
    projectKind,
    url: ok ? url : "",
    keyPresent: Boolean(serviceKey || anonKey),
    keyKind: ok ? restKey.keyKind : serviceKey ? restKey.keyKind : anonKey ? restKey.keyKind : null,
    blockers: ok ? [] : [...new Set(blockers)],
    reason: ok ? "ok" : blockers[0] || "not_ready",
  }
}

/**
 * Redact a URL for logs/tests — project ref only.
 * @param {string} url
 */
export function maskCreditCycleUrl(url) {
  const kind = classifyCreditCycleSupabaseUrl(url)
  if (kind === "staging") return `staging:${CREDIT_CYCLE_STAGING_REF.slice(0, 8)}…`
  if (kind === "production") return `production:${CREDIT_CYCLE_PRODUCTION_REF.slice(0, 8)}…`
  if (kind === "missing") return "(missing)"
  return "other:(ref-hidden)"
}

/**
 * Strip HY/BBB numerics from indicator-like objects.
 * @param {object} row
 */
export function redactLicenseRestrictedIndicator(row) {
  if (!row || typeof row !== "object") return row
  const code = String(row.indicator_code || row.id || row.code || "").toLowerCase()
  if (!CREDIT_CYCLE_LICENSE_RESTRICTED_CODES.has(code) && !row.license_restricted) {
    return row
  }
  return {
    ...row,
    indicator_code: code || row.indicator_code,
    license_restricted: true,
    value: null,
    latest_value: null,
    previous_value: null,
    change: null,
    delta: null,
    riskScore: null,
    indicator_score: null,
    weighted_contribution: null,
    raw_value: null,
    status: "LICENSE_RESTRICTED",
  }
}
