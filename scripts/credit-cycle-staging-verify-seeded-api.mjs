#!/usr/bin/env node
/** Read-only verify of seeded Staging API responses. No DB writes. Never logs secrets. */
import { readFileSync, existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  handleCreditCycleLatest,
  handleCreditCycleHistory,
  handleCreditCycleIndicators,
} from "../api/_lib/creditCycleApiHandlers.js"
import {
  CREDIT_CYCLE_STAGING_REF,
  CREDIT_CYCLE_PRODUCTION_REF,
  classifyCreditCycleSupabaseUrl,
} from "../api/_lib/creditCycleEnv.js"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function parse(p) {
  /** @type {Record<string, string>} */
  const m = {}
  if (!existsSync(p)) return m
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i <= 0) continue
    m[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return m
}

function mock() {
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

const env = { ...process.env, ...parse(path.join(ROOT, ".env.staging.local")) }
const url = String(env.CREDIT_CYCLE_SUPABASE_URL || "")
const kind = classifyCreditCycleSupabaseUrl(url)
if (
  kind !== "staging" ||
  !url.includes(CREDIT_CYCLE_STAGING_REF) ||
  url.includes(CREDIT_CYCLE_PRODUCTION_REF)
) {
  console.log(JSON.stringify({ ok: false, reason: "not_staging", kind }))
  process.exit(2)
}

const L = mock()
await handleCreditCycleLatest({ url: "/api/credit-cycle?mode=latest", method: "GET" }, L.res, {
  env,
})
const H = mock()
await handleCreditCycleHistory(
  { url: "/api/credit-cycle?mode=history&limit=20", method: "GET" },
  H.res,
  { env },
)
const I = mock()
await handleCreditCycleIndicators(
  { url: "/api/credit-cycle?mode=indicators", method: "GET" },
  I.res,
  { env },
)

const points = Array.isArray(H.out.body?.points) ? H.out.body.points : []
const testPoint = points.find((p) => p.asOf === "1900-01-01")
const inds = Array.isArray(I.out.body?.indicators) ? I.out.body.indicators : []
const codes = inds.map((x) => String(x.id || x.indicator_code || "").toLowerCase())
const expected = ["sloos", "cpff", "bank", "cre", "corp_delinq"]
const hasAllFive = expected.every((c) => codes.includes(c))
const hy = inds.filter((x) => ["hy", "bbb"].includes(String(x.id || x.indicator_code || "").toLowerCase()))
const hyNumeric = hy.some((x) => x.value != null || x.riskScore != null || x.raw_value != null)
const blob = JSON.stringify({ L: L.out.body, H: H.out.body, I: I.out.body })
const payloadExposed = /"payload"\s*:/.test(blob)

const report = {
  ok: false,
  stagingRef: CREDIT_CYCLE_STAGING_REF,
  uiStagingFlag: String(env.VITE_CREDIT_CYCLE_USE_STAGING_API || "0"),
  latest: {
    status: L.out.status,
    ok: L.out.body?.ok === true,
    asOf: L.out.body?.asOf || null,
    cci: L.out.body?.cci ?? null,
    calculationVersion: L.out.body?.calculationVersion || null,
    hasPayload: Object.prototype.hasOwnProperty.call(L.out.body || {}, "payload"),
  },
  history: {
    status: H.out.status,
    ok: H.out.body?.ok === true,
    pointCount: points.length,
    includesTest1900: Boolean(testPoint),
    testCci: testPoint?.cci ?? null,
    anyPayload: points.some((p) => p && Object.prototype.hasOwnProperty.call(p, "payload")),
  },
  indicators: {
    status: I.out.status,
    ok: I.out.body?.ok === true,
    count: inds.length,
    codes,
    hasAllFiveSeedCodes: hasAllFive,
    hyBbbNumericLeak: hyNumeric,
  },
  security: {
    payloadExposed,
    hyBbbNumericLeak: hyNumeric,
    // Phase 10C may set UI flag to 1 locally; Production is blocked in the UI bridge.
    uiStagingFlag: String(env.VITE_CREDIT_CYCLE_USE_STAGING_API || "0"),
  },
}

report.ok =
  report.latest.status === 200 &&
  report.latest.ok &&
  report.history.status === 200 &&
  report.history.includesTest1900 &&
  report.indicators.status === 200 &&
  report.indicators.hasAllFiveSeedCodes &&
  !report.security.payloadExposed &&
  !report.security.hyBbbNumericLeak

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
