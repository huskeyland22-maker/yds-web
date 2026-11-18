/**
 * Local panic reads stay on Staging and never follow the Production proxy.
 * This module does not open a network connection.
 */

export const STAGING_SUPABASE_REF = "qzunuksxwwzusyivaznx"
export const PRODUCTION_SUPABASE_REF = "oausvweyocgynjpeguka"
export const BLOCKED_PANIC_PROXY_HOSTS = Object.freeze(["yds-web-kappa.vercel.app"])

const READ_MODES = new Set(["latest", "history", "historylatest", "v2", "v2history"])

export function parseStagingEnvText(text) {
  const out = {}
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

function normalizeMode(raw) {
  const mode = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "")
  if (!mode) return "latest"
  if (mode === "v2" || mode === "v2history" || mode === "historyv2") return "v2"
  if (mode === "historylatest" || mode === "latesthistory") return "historylatest"
  return mode
}

function urlOf(env) {
  return String(env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || "").trim()
}

/**
 * Safe summary. Returned fields never include URL credentials or key material.
 * @param {Record<string, string | undefined>} env
 */
export function inspectStagingPanicEnv(env) {
  const url = urlOf(env)
  const hasAnon = Boolean(String(env?.VITE_SUPABASE_ANON_KEY ?? "").trim())
  const hasServiceRole = Boolean(String(env?.SUPABASE_SERVICE_ROLE_KEY ?? "").trim())
  const hubRaw = String(env?.VITE_PANIC_HUB ?? "").trim()
  const hubOn = hubRaw === "1" || hubRaw === "true"
  const production = url.includes(PRODUCTION_SUPABASE_REF)
  const staging = url.includes(STAGING_SUPABASE_REF)
  const ref = production ? "production" : staging ? "staging" : url ? "other" : "missing"
  const serverReadReady = staging && !production && hasServiceRole
  const clientHubReady = staging && !production && hasAnon && hubOn
  let reason = "staging"
  if (production) reason = "production_url_refused"
  else if (!staging) reason = url ? "staging_url_required" : "missing_staging_url"
  else if (!hasServiceRole) reason = "service_role_missing"
  return { ok: serverReadReady, reason, ref, hubOn, hasAnon, hasServiceRole, serverReadReady, clientHubReady }
}

/**
 * Server assignments for a Staging read. Null when the URL is not Staging.
 * @param {Record<string, string | undefined>} env
 */
export function stagingServerEnvAssignments(env) {
  const info = inspectStagingPanicEnv(env)
  if (!info.serverReadReady) return { ok: false, reason: info.reason, assignments: null }
  return {
    ok: true,
    reason: info.reason,
    assignments: {
      SUPABASE_URL: urlOf(env),
      SUPABASE_SERVICE_ROLE_KEY: String(env.SUPABASE_SERVICE_ROLE_KEY).trim(),
    },
  }
}

/**
 * Browser-public values only. Service role is never copied.
 * @param {Record<string, string | undefined>} env
 */
export function stagingClientPublicEnv(env) {
  const info = inspectStagingPanicEnv(env)
  if (info.ref !== "staging" || !info.hasAnon) {
    return { ok: false, reason: info.ref === "staging" ? "anon_key_missing" : info.reason, url: null, anonKey: null, hub: null }
  }
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim()
  return {
    ok: true,
    reason: "staging",
    url,
    anonKey: String(env.VITE_SUPABASE_ANON_KEY).trim(),
    hub: info.hubOn ? "1" : null,
  }
}

export function isBlockedPanicProxyTarget(target) {
  const text = String(target ?? "")
  if (!text) return false
  if (text.includes(PRODUCTION_SUPABASE_REF)) return true
  if (BLOCKED_PANIC_PROXY_HOSTS.some((host) => text.includes(host))) return true
  return false
}

/**
 * Local /api/panic accepts GET reads. Writes, backfill, and insert probes stop here.
 * @param {{ method?: string, mode?: string | null, probe?: string | null }} request
 */
export function classifyPanicReadRequest(request) {
  const method = String(request?.method ?? "GET").toUpperCase()
  const mode = normalizeMode(request?.mode)
  const probe = String(request?.probe ?? "")
  if (probe === "1" || probe === "true") {
    return { allow: false, status: 403, reason: "write_probe_blocked", mode }
  }
  if (method !== "GET") return { allow: false, status: 405, reason: "read_only", mode }
  if (!READ_MODES.has(mode)) return { allow: false, status: 403, reason: "read_only", mode }
  return { allow: true, status: 200, reason: "read", mode }
}
