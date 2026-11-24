#!/usr/bin/env node
/**
 * Local smoke: Credit Cycle Staging API handlers (read-only).
 * Loads .env.staging.local — never prints secrets, payload, or HY/BBB numerics.
 */
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  classifyCreditCycleSupabaseUrl,
  CREDIT_CYCLE_PRODUCTION_REF,
  CREDIT_CYCLE_STAGING_REF,
  resolveCreditCycleServerConfig,
  resolveCreditCycleRestKey,
} from "../api/_lib/creditCycleEnv.js"
import {
  handleCreditCycleLatest,
  handleCreditCycleHistory,
  handleCreditCycleIndicators,
  CREDIT_CYCLE_SNAPSHOT_SELECT,
} from "../api/_lib/creditCycleApiHandlers.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const ENV_PATH = path.join(ROOT, ".env.staging.local")

function loadEnvFile(filePath) {
  /** @type {Record<string, string>} */
  const m = {}
  if (!existsSync(filePath)) return m
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    m[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
  return m
}

function mockRes() {
  /** @type {{ status: number, body: any }} */
  const out = { status: 0, body: null }
  return {
    out,
    res: {
      setHeader() {},
      end(s) {
        out.body = JSON.parse(String(s))
      },
      set statusCode(v) {
        out.status = v
      },
      get statusCode() {
        return out.status
      },
    },
  }
}

function assertNoSecrets(obj) {
  const blob = JSON.stringify(obj)
  if (/service_role|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/i.test(blob)) {
    throw new Error("response_may_contain_jwt_or_service_role_marker")
  }
  if (/"payload"\s*:/.test(blob)) throw new Error("payload_key_in_response")
}

function assertHyBbbSafe(indicators) {
  if (!Array.isArray(indicators)) return
  for (const row of indicators) {
    const id = String(row.id || row.indicator_code || "").toLowerCase()
    if (id !== "hy" && id !== "bbb" && !row.license_restricted) continue
    if (row.value != null || row.riskScore != null || row.raw_value != null) {
      throw new Error(`hy_bbb_numeric_leak:${id}`)
    }
  }
}

const fileEnv = loadEnvFile(ENV_PATH)
const env = { ...process.env, ...fileEnv }
const url = String(env.CREDIT_CYCLE_SUPABASE_URL || "")
const kind = classifyCreditCycleSupabaseUrl(url)

if (kind === "production" || url.includes(CREDIT_CYCLE_PRODUCTION_REF)) {
  console.log(JSON.stringify({ ok: false, reason: "production_url_refused" }))
  process.exit(2)
}
if (kind !== "staging" || !url.includes(CREDIT_CYCLE_STAGING_REF)) {
  console.log(JSON.stringify({ ok: false, reason: "not_staging", kind }))
  process.exit(2)
}

const cfg = resolveCreditCycleServerConfig(env)
const restKey = resolveCreditCycleRestKey(env)
const keyKind = restKey.keyKind || cfg.keyKind

/** @type {Record<string, unknown>} */
const report = {
  ok: false,
  stagingRef: CREDIT_CYCLE_STAGING_REF,
  configOk: cfg.ok,
  configReason: cfg.reason,
  keyKind,
  privileged: restKey.privileged,
  snapshotSelectExcludesPayload: !CREDIT_CYCLE_SNAPSHOT_SELECT.includes("payload"),
  uiStagingFlag: String(env.VITE_CREDIT_CYCLE_USE_STAGING_API || "0"),
  endpoints: {},
}

if (!cfg.ok) {
  console.log(JSON.stringify({ ...report, reason: cfg.reason, blockers: cfg.blockers }, null, 2))
  process.exit(1)
}

const latest = mockRes()
await handleCreditCycleLatest({ url: "/api/credit-cycle?mode=latest", method: "GET" }, latest.res, {
  env,
})
assertNoSecrets(latest.out.body)
report.endpoints.latest = {
  status: latest.out.status,
  ok: latest.out.body?.ok === true,
  feedStatus: latest.out.body?.feedStatus,
  reason: latest.out.body?.reason,
  hasPayload: Object.prototype.hasOwnProperty.call(latest.out.body || {}, "payload"),
  hasCci: latest.out.body?.cci != null,
}

const history = mockRes()
await handleCreditCycleHistory(
  { url: "/api/credit-cycle?mode=history&limit=5", method: "GET" },
  history.res,
  { env },
)
assertNoSecrets(history.out.body)
const points = history.out.body?.points
report.endpoints.history = {
  status: history.out.status,
  ok: history.out.body?.ok === true,
  pointCount: Array.isArray(points) ? points.length : 0,
  anyPointHasPayload: Array.isArray(points)
    ? points.some((p) => p && Object.prototype.hasOwnProperty.call(p, "payload"))
    : false,
}

const indicators = mockRes()
await handleCreditCycleIndicators(
  { url: "/api/credit-cycle?mode=indicators", method: "GET" },
  indicators.res,
  { env },
)
assertNoSecrets(indicators.out.body)
try {
  assertHyBbbSafe(indicators.out.body?.indicators)
  report.endpoints.indicators = {
    status: indicators.out.status,
    ok: indicators.out.body?.ok === true,
    indicatorCount: Array.isArray(indicators.out.body?.indicators)
      ? indicators.out.body.indicators.length
      : 0,
    hyBbbSafe: true,
  }
} catch (e) {
  report.endpoints.indicators = {
    status: indicators.out.status,
    ok: false,
    hyBbbSafe: false,
    error: e.message,
  }
}

const statuses = [
  report.endpoints.latest.status,
  report.endpoints.history.status,
  report.endpoints.indicators.status,
]
// 200 = data present; 404 = armed but empty tables (still valid connection)
const connectOk = statuses.every((s) => s === 200 || s === 404)
const securityOk =
  report.snapshotSelectExcludesPayload &&
  report.endpoints.latest.hasPayload === false &&
  report.endpoints.history.anyPointHasPayload === false &&
  report.endpoints.indicators.hyBbbSafe !== false
// uiStagingFlag may be 1 on local Phase 10C; Production guards live in the UI bridge.

report.ok = connectOk && securityOk && cfg.ok
report.connectOk = connectOk
report.securityOk = securityOk
report.note =
  statuses.includes(404) && !statuses.includes(200)
    ? "API armed against Staging; no license_safe snapshots yet (404)."
    : statuses.every((s) => s === 200)
      ? "API read paths returned data."
      : "See endpoint statuses."

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
