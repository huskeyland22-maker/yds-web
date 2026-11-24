#!/usr/bin/env node
/**
 * Phase 12 — INSERT license-safe snapshots into Staging only.
 * - Refuses Production
 * - INSERT only (no UPDATE/DELETE/TRUNCATE)
 * - Skips duplicates and 1900-01-01 test seed
 * - Never inserts HY/BBB numerics; omits hy/bbb score rows
 * - Never logs secrets
 *
 *   node scripts/credit-cycle-staging-seed-license-safe.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  classifyCreditCycleSupabaseUrl,
  CREDIT_CYCLE_PRODUCTION_REF,
  CREDIT_CYCLE_STAGING_REF,
  resolveCreditCycleRestKey,
  buildCreditCycleRestAuthHeaders,
  resolveCreditCycleServerConfig,
} from "../api/_lib/creditCycleEnv.js"
import { isStagingTestSeedPoint } from "../src/credit-cycle/stagingTestSeed.js"
import { LICENSE_SAFE_INDICATOR_IDS } from "../src/credit-cycle/licenseSafeSnapshotBuilder.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const ENV_PATH = path.join(ROOT, ".env.staging.local")
const SNAP_PATH = path.join(
  ROOT,
  "vite-project/public/credit-cycle/license-safe-snapshots.json",
)
const REPORT_PATH = path.join(ROOT, "reports/credit-cycle-phase12-staging-seed.json")

const SAFE_CODES = new Set(LICENSE_SAFE_INDICATOR_IDS)

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

async function rest(env, method, pathQuery, body) {
  const cfg = resolveCreditCycleServerConfig(env)
  if (!cfg.ok) {
    const err = new Error(`not_configured:${cfg.reason}`)
    err.code = "NOT_CONFIGURED"
    throw err
  }
  const { key, keyKind, privileged } = resolveCreditCycleRestKey(env)
  if (!privileged) {
    const err = new Error("privileged_key_required")
    err.code = "NOT_PRIVILEGED"
    throw err
  }
  const headers = {
    ...buildCreditCycleRestAuthHeaders(key),
    "Content-Type": "application/json",
    Prefer: method === "GET" ? "count=exact" : "return=representation",
  }
  const res = await fetch(`${cfg.url}/rest/v1/${pathQuery}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return {
    ok: res.ok,
    status: res.status,
    json,
    keyKind,
    code: json && typeof json === "object" ? json.code || null : null,
    message:
      json && typeof json === "object" && typeof json.message === "string"
        ? json.message.slice(0, 180)
        : null,
  }
}

/**
 * @param {object} snap
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function validateSnapshot(snap) {
  if (!snap || typeof snap !== "object") return { ok: false, reason: "not_object" }
  if (snap.data_mode !== "license_safe") return { ok: false, reason: "data_mode_not_license_safe" }
  if (snap.pit_status !== "NON_PIT") return { ok: false, reason: "pit_status_not_non_pit" }
  if (!snap.as_of_date || !/^\d{4}-\d{2}-\d{2}$/.test(snap.as_of_date)) {
    return { ok: false, reason: "invalid_as_of_date" }
  }
  if (isStagingTestSeedPoint({ asOf: snap.as_of_date, calculationVersion: snap.calculation_version, holdReason: snap.hold_reason })) {
    return { ok: false, reason: "test_seed_excluded" }
  }
  if (snap.payload != null) return { ok: false, reason: "payload_must_be_null" }
  if (!snap.calculation_version) return { ok: false, reason: "missing_calculation_version" }
  if (snap.coverage != null && (snap.coverage < 0 || snap.coverage > 1)) {
    return { ok: false, reason: "coverage_out_of_range" }
  }

  const scores = Array.isArray(snap.indicator_scores) ? snap.indicator_scores : []
  for (const row of scores) {
    const code = String(row.indicator_code || "").toLowerCase()
    if (code === "hy" || code === "bbb") {
      if (
        row.raw_value != null ||
        row.indicator_score != null ||
        row.weighted_contribution != null
      ) {
        return { ok: false, reason: `hy_bbb_numeric_present:${code}` }
      }
    }
  }

  const safeRows = scores.filter((r) => SAFE_CODES.has(String(r.indicator_code || "").toLowerCase()))
  if (safeRows.length === 0) return { ok: false, reason: "no_license_safe_scores" }

  return { ok: true }
}

function dupKey(asOf, dataMode, pit, calc) {
  return `${asOf}|${dataMode}|${pit}|${calc}`
}

const fileEnv = loadEnvFile(ENV_PATH)
const env = {
  ...process.env,
  ...fileEnv,
  CREDIT_CYCLE_API_ENABLED: "1",
  CREDIT_CYCLE_DATA_MODE: "staging",
  CREDIT_CYCLE_ALLOW_REMOTE: "1",
}

const url = String(env.CREDIT_CYCLE_SUPABASE_URL || "")
const kind = classifyCreditCycleSupabaseUrl(url)
if (kind === "production" || url.includes(CREDIT_CYCLE_PRODUCTION_REF)) {
  console.log(JSON.stringify({ ok: false, reason: "production_url_refused" }))
  process.exit(2)
}
if (kind !== "staging" || !url.includes(CREDIT_CYCLE_STAGING_REF)) {
  console.log(JSON.stringify({ ok: false, reason: "staging_ref_required", kind }))
  process.exit(2)
}

if (!existsSync(SNAP_PATH)) {
  console.log(JSON.stringify({ ok: false, reason: "missing_license_safe_snapshots_json" }))
  process.exit(1)
}

const fileJson = JSON.parse(readFileSync(SNAP_PATH, "utf8"))
const candidates = Array.isArray(fileJson.snapshots) ? fileJson.snapshots : []

/** @type {{ ok: false, reason: string, asOf?: string }[]} */
const excluded = []
/** @type {object[]} */
const accepted = []

for (const snap of candidates) {
  const v = validateSnapshot(snap)
  if (!v.ok) {
    excluded.push({ ok: false, reason: v.reason, asOf: snap?.as_of_date })
    continue
  }
  accepted.push(snap)
}

const existing = await rest(
  env,
  "GET",
  "credit_cycle_snapshots?select=as_of_date,data_mode,pit_status,calculation_version&data_mode=eq.license_safe&limit=2000",
)
if (!existing.ok) {
  console.log(
    JSON.stringify({
      ok: false,
      reason: "existing_lookup_failed",
      httpStatus: existing.status,
      code: existing.code,
      message: existing.message,
      keyKind: existing.keyKind,
    }),
  )
  process.exit(1)
}

const existingKeys = new Set(
  (Array.isArray(existing.json) ? existing.json : []).map((r) =>
    dupKey(r.as_of_date, r.data_mode, r.pit_status, r.calculation_version),
  ),
)

let insertedSnapshots = 0
let insertedScores = 0
let skippedDuplicate = 0
/** @type {string[]} */
const insertedAsOf = []

for (const snap of accepted) {
  const key = dupKey(
    snap.as_of_date,
    snap.data_mode,
    snap.pit_status,
    snap.calculation_version,
  )
  if (existingKeys.has(key)) {
    skippedDuplicate += 1
    excluded.push({ ok: false, reason: "duplicate_skip", asOf: snap.as_of_date })
    continue
  }

  const snapBody = {
    as_of_date: snap.as_of_date,
    cci_score: snap.cci_score,
    coverage: snap.coverage,
    confidence_status: snap.confidence_status,
    regime: snap.regime,
    calculation_version: snap.calculation_version,
    data_mode: snap.data_mode,
    pit_status: snap.pit_status,
    hold_reason: snap.hold_reason,
    payload: null,
  }

  const ins = await rest(env, "POST", "credit_cycle_snapshots", snapBody)
  if (!ins.ok) {
    console.log(
      JSON.stringify({
        ok: false,
        reason: "snapshot_insert_failed",
        asOf: snap.as_of_date,
        httpStatus: ins.status,
        code: ins.code,
        message: ins.message,
        insertedSnapshots,
        insertedScores,
        skippedDuplicate,
      }),
    )
    process.exit(1)
  }

  const row = Array.isArray(ins.json) ? ins.json[0] : ins.json
  const snapshotId = row?.id
  if (!snapshotId) {
    console.log(
      JSON.stringify({
        ok: false,
        reason: "snapshot_id_missing",
        asOf: snap.as_of_date,
        insertedSnapshots,
      }),
    )
    process.exit(1)
  }

  insertedSnapshots += 1
  insertedAsOf.push(snap.as_of_date)
  existingKeys.add(key)

  const scoreRows = (Array.isArray(snap.indicator_scores) ? snap.indicator_scores : [])
    .filter((r) => SAFE_CODES.has(String(r.indicator_code || "").toLowerCase()))
    .map((r) => ({
      snapshot_id: snapshotId,
      indicator_code: String(r.indicator_code).toLowerCase(),
      indicator_score: r.indicator_score ?? null,
      weighted_contribution: r.weighted_contribution ?? null,
      observation_date: r.observation_date ?? null,
      release_date: r.release_date ?? null,
      quality_status: r.quality_status ?? null,
      license_restricted: false,
      raw_value: r.raw_value ?? null,
    }))

  if (scoreRows.length) {
    const scoreIns = await rest(env, "POST", "credit_cycle_indicator_scores", scoreRows)
    if (!scoreIns.ok) {
      console.log(
        JSON.stringify({
          ok: false,
          reason: "scores_insert_failed",
          asOf: snap.as_of_date,
          httpStatus: scoreIns.status,
          code: scoreIns.code,
          message: scoreIns.message,
          insertedSnapshots,
          insertedScores,
        }),
      )
      process.exit(1)
    }
    insertedScores += Array.isArray(scoreIns.json) ? scoreIns.json.length : scoreRows.length
  }
}

const excludeReasons = {}
for (const e of excluded) {
  excludeReasons[e.reason] = (excludeReasons[e.reason] || 0) + 1
}

const report = {
  ok: true,
  stagingRef: CREDIT_CYCLE_STAGING_REF,
  candidates: candidates.length,
  acceptedAfterValidation: accepted.length,
  insertedSnapshots,
  insertedScores,
  skippedDuplicate,
  excludedCount: excluded.length,
  excludeReasons,
  insertedAsOfMin: insertedAsOf[0] || null,
  insertedAsOfMax: insertedAsOf[insertedAsOf.length - 1] || null,
  hyBbbScoreRowsInserted: false,
  payloadInserted: false,
  mutations: "insert_only",
}

mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8")
console.log(JSON.stringify(report, null, 2))
process.exit(0)
