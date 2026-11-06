/**
 * Credit spread collect helpers (no network / no DB).
 * node --test scripts/credit-spreads.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCreditRiskAnalysis,
  formatCreditAsOfStatus,
  isCreditSpreadCollectDayKst,
  isCreditSpreadMetricKey,
  parseCreditAsOfStatus,
  FRED_BBB_OAS_SERIES,
  FRED_HY_OAS_SERIES,
} from "../api/_lib/creditSpreads.js"
import { finiteMetricOrNull, pickHyFromRow } from "../api/_lib/panicIndexHistoryColumns.js"
import { rowsFromPanicPayload } from "../api/_lib/panicMetricsHub.js"
import {
  applyLatestCreditEavMerge,
  mergeLatestCreditMetric,
} from "../api/_lib/panicApiHandlers.js"

describe("creditSpreads schedule + series", () => {
  it("uses expected FRED series ids", () => {
    assert.equal(FRED_HY_OAS_SERIES, "BAMLH0A0HYM2")
    assert.equal(FRED_BBB_OAS_SERIES, "BAMLC0A4CBBB")
  })

  it("detects Tue/Fri in Asia/Seoul", () => {
    // 2026-11-06 is Friday UTC morning → still Friday KST
    assert.equal(isCreditSpreadCollectDayKst(new Date("2026-11-06T01:00:00Z")), true)
    // 2026-11-03 is Tuesday
    assert.equal(isCreditSpreadCollectDayKst(new Date("2026-11-03T01:00:00Z")), true)
    // 2026-11-04 is Wednesday
    assert.equal(isCreditSpreadCollectDayKst(new Date("2026-11-04T01:00:00Z")), false)
  })

  it("parses asOf status", () => {
    assert.equal(formatCreditAsOfStatus("2026-11-04"), "asOf:2026-11-04")
    assert.equal(parseCreditAsOfStatus("asOf:2026-11-04"), "2026-11-04")
    assert.equal(parseCreditAsOfStatus(null), null)
  })
})

describe("null metric hygiene", () => {
  it("does not coerce null to 0", () => {
    assert.equal(finiteMetricOrNull(null), null)
    assert.equal(finiteMetricOrNull(undefined), null)
    assert.equal(finiteMetricOrNull(""), null)
    assert.equal(finiteMetricOrNull(0), 0)
    assert.equal(pickHyFromRow({ hy_oas: null }), null)
    assert.equal(pickHyFromRow({ hy_oas: 3.2 }), 3.2)
  })
})

describe("manual rows preserve credit spreads", () => {
  it("omits missing/null HY and BBB on manual forceAllKeys path", () => {
    const rows = rowsFromPanicPayload(
      {
        vix: 20,
        fearGreed: 30,
        putCall: 1.0,
        highYield: null,
        bbbOas: null,
        updatedAt: "2026-11-06T12:00:00.000Z",
      },
      { source: "manual", forceAllKeys: true },
    )
    const keys = rows.map((r) => r.metric_key)
    assert.ok(keys.includes("vix"))
    assert.equal(keys.includes("highYield"), false)
    assert.equal(keys.includes("bbbOas"), false)
  })

  it("writes credit rows only when values present", () => {
    const rows = rowsFromPanicPayload(
      {
        highYield: 3.45,
        highYieldAsOf: "2026-11-04",
        bbbOas: 1.12,
        bbbOasAsOf: "2026-11-04",
        updatedAt: "2026-11-06T00:00:00.000Z",
      },
      { source: "cron-credit", forceAllKeys: false },
    )
    const hy = rows.find((r) => r.metric_key === "highYield")
    const bbb = rows.find((r) => r.metric_key === "bbbOas")
    assert.equal(hy?.metric_value, 3.45)
    assert.equal(hy?.status, "asOf:2026-11-04")
    assert.equal(bbb?.metric_value, 1.12)
    assert.equal(isCreditSpreadMetricKey("bbbOas"), true)
  })
})

describe("credit risk analysis for AI", () => {
  it("labels widening / easing without panic weights", () => {
    const widening = buildCreditRiskAnalysis({
      highYield: 4.2,
      bbbOas: 1.5,
      highYieldPrev: 3.5,
      bbbOasPrev: 1.2,
      highYieldAsOf: "2026-11-04",
    })
    assert.equal(widening.axis, "credit_risk")
    assert.equal(widening.trend, "widening")
    assert.match(widening.summaryKo, /확대/)
    assert.match(widening.summaryKo, /기준일 2026-11-04/)
  })
})

describe("latest credit EAV merge", () => {
  it("lets cron-credit override probe/manual residual highYield 0", () => {
    assert.equal(mergeLatestCreditMetric(0, 3.32, "cron-credit"), 3.32)
    assert.equal(mergeLatestCreditMetric(null, 1.13, "cron-credit"), 1.13)
  })

  it("does not treat non-cron 0 as globally missing", () => {
    assert.equal(mergeLatestCreditMetric(0, 3.32, "probe"), 0)
    assert.equal(mergeLatestCreditMetric(0, 3.32, "manual"), 0)
    assert.equal(mergeLatestCreditMetric(2.5, 3.32, "manual"), 2.5)
  })

  it("fills null from any finite EAV value", () => {
    assert.equal(mergeLatestCreditMetric(null, 1.13, "manual"), 1.13)
    assert.equal(mergeLatestCreditMetric(undefined, 0, "manual"), 0)
  })

  it("applies Preview bugfix scenario into creditRisk inputs", () => {
    const data = {
      vix: 28.18,
      fearGreed: 20,
      putCall: 0.8,
      highYield: 0,
      bbbOas: null,
      panicIndex: 54,
    }
    const fromEav = {
      highYield: 3.32,
      bbbOas: 1.13,
      highYieldAsOf: "2026-11-04",
      bbbOasAsOf: "2026-11-04",
    }
    const rows = [
      { metric_key: "highYield", metric_value: 3.32, source: "cron-credit" },
      { metric_key: "bbbOas", metric_value: 1.13, source: "cron-credit" },
      { metric_key: "vix", metric_value: 28.18, source: "manual" },
    ]
    applyLatestCreditEavMerge(data, fromEav, rows)
    assert.equal(data.highYield, 3.32)
    assert.equal(data.bbbOas, 1.13)
    assert.equal(data.highYieldAsOf, "2026-11-04")
    assert.equal(data.bbbOasAsOf, "2026-11-04")
    assert.equal(data.vix, 28.18)
    assert.equal(data.fearGreed, 20)
    assert.equal(data.putCall, 0.8)
    assert.equal(data.panicIndex, 54)

    const risk = buildCreditRiskAnalysis({
      highYield: data.highYield,
      bbbOas: data.bbbOas,
      highYieldAsOf: data.highYieldAsOf,
      bbbOasAsOf: data.bbbOasAsOf,
    })
    assert.equal(risk.highYield, 3.32)
    assert.equal(risk.bbbOas, 1.13)
    assert.match(risk.summaryKo, /3\.32/)
    assert.match(risk.summaryKo, /1\.13/)
  })
})
