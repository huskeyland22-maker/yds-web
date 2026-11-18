import { describe, expect, it } from "vitest"
import { mapPanicIndexHistoryRowToClient, pickHyFromRow } from "../../../api/_lib/panicIndexHistoryColumns.js"
import { attachBbbDisplay } from "../../../api/_lib/panicMetricsHub.js"
import { PANIC_HISTORY_SEED } from "./panicHistorySeed.js"
import {
  DATA_STATE,
  classifyPanicScoreState,
  readFiniteMetric,
  resolveLivePanicData,
} from "./panicDataFreshness.js"
import { panicDataFromHubMetrics } from "./resolveLatestPanicMetrics.js"
import { getPanicScoreV2 } from "./tradingScores.js"
import {
  PRODUCTION_SUPABASE_REF,
  STAGING_SUPABASE_REF,
  classifyPanicReadRequest,
  inspectStagingPanicEnv,
} from "../../../api/_lib/stagingPanicRead.js"

const NOW = new Date("2026-11-13T03:00:00Z")
const scoreInputs = { vix: 22.22, fearGreed: 27, putCall: 0.71 }

describe("panic card metric values", () => {
  it("keeps null BofA missing and keeps a real zero", () => {
    expect(readFiniteMetric(null)).toBeNull()
    expect(readFiniteMetric(undefined)).toBeNull()
    expect(readFiniteMetric("")).toBeNull()
    expect(readFiniteMetric(0)).toBe(0)
    expect(readFiniteMetric("0")).toBe(0)
  })

  it("distinguishes a stored HY zero from a missing HY", () => {
    expect(readFiniteMetric(0)).toBe(0)
    expect(readFiniteMetric(null)).toBeNull()
    const hub = panicDataFromHubMetrics({
      ...scoreInputs,
      highYield: 0,
      bofa: null,
      updatedAt: "2026-11-05T21:00:00.000Z",
    })
    expect(hub.highYield).toBe(0)
    expect(hub.bofa).toBeNull()
  })

  it("passes BBB OAS through the latest snapshot and omits a null BBB", () => {
    const history = { ...scoreInputs, bofa: null, highYield: 0, updatedAt: "2026-11-05T21:00:00.000Z" }
    const withValue = attachBbbDisplay(history, [{ metric_key: "bbbOas", metric_value: 1.7 }])
    expect(withValue.bbbOas).toBe(1.7)
    const withNull = attachBbbDisplay(history, [{ metric_key: "bbbOas", metric_value: null }])
    expect(withNull.bbbOas ?? null).toBeNull()
    const hub = panicDataFromHubMetrics({ ...withValue, date: "2026-11-05" })
    expect(hub.bbbOas).toBe(1.7)
    expect(hub.bofa).toBeNull()
    const historyRow = { date: "2026-11-05", ...scoreInputs, bofa: null, highYield: 0 }
    const selected = resolveLivePanicData(historyRow, { ...historyRow, bbbOas: 1.7 }, null)
    expect(selected?.date).toBe("2026-11-05")
    expect(selected?.bofa).toBeNull()
    expect(selected?.bbbOas).toBe(1.7)
    expect(selected?.highYield).toBe(0)
  })

  it("does not change the panic score when BofA, HY, or BBB are attached", () => {
    expect(getPanicScoreV2(scoreInputs)).toBe(42)
    expect(getPanicScoreV2({ ...scoreInputs, bofa: null, highYield: 0, bbbOas: 1.7 })).toBe(42)
    expect(getPanicScoreV2({ ...scoreInputs, bofa: 0, highYield: 0, bbbOas: null })).toBe(42)
  })

  it("keeps seed rows off the latest card and keeps a stale staging date", () => {
    const seed = PANIC_HISTORY_SEED.find((row) => row.date === "2026-05-19")
    expect(resolveLivePanicData(seed, null, null)).toBeNull()
    const staging = {
      date: "2026-11-05",
      ...scoreInputs,
      bofa: null,
      highYield: 0,
      __fetchSource: "HUB",
      updatedAt: "2026-11-05T21:00:00.000Z",
    }
    expect(resolveLivePanicData(seed, staging, null)?.date).toBe("2026-11-05")
    expect(classifyPanicScoreState(staging, NOW)).toBe(DATA_STATE.STALE)
  })

  it("does not turn a null history field into zero, and keeps HY zero", () => {
    const row = mapPanicIndexHistoryRowToClient({
      date: "2026-11-05",
      vix: 28,
      fear_greed: 20,
      put_call: 0.8,
      bofa: null,
      hy_oas: 0,
    })
    expect(row?.bofa).toBeNull()
    expect(row?.highYield).toBe(0)
    expect(pickHyFromRow({ hy_oas: null, high_yield: null })).toBeNull()
    expect(pickHyFromRow({ hy_oas: 0 })).toBe(0)
  })

  it("keeps the hub off static path and the staging read gate", () => {
    expect(resolveLivePanicData(null, null, null)).toBeNull()
    expect(classifyPanicReadRequest({ method: "GET", mode: "latest" }).allow).toBe(true)
    expect(classifyPanicReadRequest({ method: "POST", mode: "update" }).allow).toBe(false)
    const staging = inspectStagingPanicEnv({
      SUPABASE_URL: `https://${STAGING_SUPABASE_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
      VITE_SUPABASE_ANON_KEY: "anon-test",
    })
    expect(staging.ref).toBe("staging")
    expect(staging.clientHubReady).toBe(false)
    const production = inspectStagingPanicEnv({
      SUPABASE_URL: `https://${PRODUCTION_SUPABASE_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test",
    })
    expect(production.serverReadReady).toBe(false)
    expect(production.reason).toBe("production_url_refused")
  })
})
