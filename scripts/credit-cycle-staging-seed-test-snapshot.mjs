#!/usr/bin/env node
/**
 * Insert ONE license-safe TEST snapshot + indicator scores into Staging.
 * - Refuses Production
 * - INSERT only (no UPDATE/DELETE/TRUNCATE)
 * - No HY/BBB rows, payload null
 * - Never logs secrets
 */
import { readFileSync, existsSync } from "node:fs"
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const ENV_PATH = path.join(ROOT, ".env.staging.local")

/** Distinctive fake as-of — not a real market date. */
export const TEST_AS_OF = "1900-01-01"
export const TEST_CALC_VERSION = "phase10b-staging-test-seed"
export const TEST_DATA_MODE = "license_safe"
export const TEST_PIT = "UNKNOWN"

/** License-safe indicators only — never hy/bbb. */
const TEST_SCORES = [
  { indicator_code: "sloos", indicator_score: 55, weighted_contribution: 11, quality_status: "TEST_SEED" },
  { indicator_code: "cpff", indicator_score: 48, weighted_contribution: 9.6, quality_status: "TEST_SEED" },
  { indicator_code: "bank", indicator_score: 52, weighted_contribution: 10.4, quality_status: "TEST_SEED" },
  { indicator_code: "cre", indicator_score: 47, weighted_contribution: 7.05, quality_status: "TEST_SEED" },
  { indicator_code: "corp_delinq", indicator_score: 50, weighted_contribution: 5, quality_status: "TEST_SEED" },
]

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
    const err = new Error("privileged_key_required_for_seed")
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
        ? json.message.slice(0, 160)
        : null,
  }
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

/** @type {Record<string, unknown>} */
const report = {
  ok: false,
  stagingRef: CREDIT_CYCLE_STAGING_REF,
  testAsOf: TEST_AS_OF,
  testCalcVersion: TEST_CALC_VERSION,
  dataMode: TEST_DATA_MODE,
  insertedSnapshots: 0,
  insertedScores: 0,
  reusedExisting: false,
  snapshotIdPresent: false,
}

const existing = await rest(
  env,
  "GET",
  `credit_cycle_snapshots?select=id,as_of_date,data_mode,calculation_version,cci_score&calculation_version=eq.${encodeURIComponent(TEST_CALC_VERSION)}&data_mode=eq.${TEST_DATA_MODE}&limit=1`,
)
if (!existing.ok) {
  console.log(
    JSON.stringify(
      {
        ...report,
        reason: "lookup_failed",
        httpStatus: existing.status,
        code: existing.code,
        message: existing.message,
        keyKind: existing.keyKind,
      },
      null,
      2,
    ),
  )
  process.exit(1)
}

const found = Array.isArray(existing.json) ? existing.json[0] : null
let snapshotId = found?.id || null

if (snapshotId) {
  report.reusedExisting = true
  report.snapshotIdPresent = true
} else {
  const snapBody = {
    as_of_date: TEST_AS_OF,
    cci_score: 42,
    coverage: 1,
    confidence_status: "TEST_SEED_ONLY",
    regime: "TEST_NEUTRAL",
    calculation_version: TEST_CALC_VERSION,
    data_mode: TEST_DATA_MODE,
    pit_status: TEST_PIT,
    hold_reason: "PHASE10B_STAGING_TEST_SEED_NOT_MARKET_DATA",
    payload: null,
  }
  const ins = await rest(env, "POST", "credit_cycle_snapshots", snapBody)
  if (!ins.ok) {
    console.log(
      JSON.stringify(
        {
          ...report,
          reason: "snapshot_insert_failed",
          httpStatus: ins.status,
          code: ins.code,
          message: ins.message,
          keyKind: ins.keyKind,
          hint:
            ins.status === 401 || ins.status === 403 || ins.code === "42501"
              ? "Apply supabase/staging/credit-cycle-service-role-insert-grants.sql on Staging, then re-run."
              : undefined,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }
  const row = Array.isArray(ins.json) ? ins.json[0] : ins.json
  snapshotId = row?.id || null
  if (!snapshotId) {
    console.log(JSON.stringify({ ...report, reason: "snapshot_id_missing_after_insert" }, null, 2))
    process.exit(1)
  }
  report.insertedSnapshots = 1
  report.snapshotIdPresent = true
}

// Score rows: insert only missing codes (no UPDATE)
const scoreLookup = await rest(
  env,
  "GET",
  `credit_cycle_indicator_scores?select=indicator_code&snapshot_id=eq.${snapshotId}`,
)
const existingCodes = new Set(
  Array.isArray(scoreLookup.json)
    ? scoreLookup.json.map((r) => String(r.indicator_code || "").toLowerCase())
    : [],
)

for (const code of ["hy", "bbb"]) {
  if (existingCodes.has(code)) {
    console.log(
      JSON.stringify({
        ...report,
        reason: "hy_bbb_row_present_abort",
        code,
        note: "Refusing to continue; HY/BBB must not be seeded.",
      }),
    )
    process.exit(1)
  }
}

const toInsert = TEST_SCORES.filter((s) => !existingCodes.has(s.indicator_code)).map((s) => ({
  snapshot_id: snapshotId,
  indicator_code: s.indicator_code,
  indicator_score: s.indicator_score,
  weighted_contribution: s.weighted_contribution,
  observation_date: TEST_AS_OF,
  release_date: TEST_AS_OF,
  quality_status: s.quality_status,
  license_restricted: false,
  raw_value: null,
}))

if (toInsert.length) {
  const scoreIns = await rest(env, "POST", "credit_cycle_indicator_scores", toInsert)
  if (!scoreIns.ok) {
    console.log(
      JSON.stringify(
        {
          ...report,
          reason: "scores_insert_failed",
          httpStatus: scoreIns.status,
          code: scoreIns.code,
          message: scoreIns.message,
          attempted: toInsert.length,
          hint:
            scoreIns.status === 401 || scoreIns.status === 403 || scoreIns.code === "42501"
              ? "Apply supabase/staging/credit-cycle-service-role-insert-grants.sql on Staging, then re-run."
              : undefined,
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }
  report.insertedScores = Array.isArray(scoreIns.json) ? scoreIns.json.length : toInsert.length
}

report.ok = true
report.scoreCodes = TEST_SCORES.map((s) => s.indicator_code)
report.hyBbbSeeded = false
report.payloadIsNull = true
console.log(JSON.stringify(report, null, 2))
process.exit(0)
