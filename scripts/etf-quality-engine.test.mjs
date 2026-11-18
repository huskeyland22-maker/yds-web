/**
 * ETF Quality Score engine tests
 * node --test scripts/etf-quality-engine.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ETF_QUALITY_MIN_DATA_COVERAGE_PCT,
  ETF_QUALITY_MIN_PEER_RELATIVE,
  ETF_QUALITY_PILLAR_WEIGHTS,
  absoluteMetricScore,
  buildQualityFeatureRow,
  computeQualityPriceMetrics,
  evaluateEtfQualityUniverse,
  peerPercentile,
  resolveEtfQualityEvaluation,
  scoreQualityPeerCohort,
} from "../api/_lib/etfQualityEngine.js"
import { getEtfQualityFundMeta } from "../api/_lib/etfQualityMeta.js"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import { DAILY_BOTTOM_BUY_ETFS } from "../api/_lib/dailyBottomBuyUniverse.js"

function synthBars(n, start = 100, drift = 0.0004) {
  const bars = []
  let px = start
  const day0 = Date.parse("2015-01-02T00:00:00Z")
  for (let i = 0; i < n; i++) {
    px = Math.max(5, px * (1 + drift + (i % 17 === 0 ? -0.03 : 0.001)))
    const d = new Date(day0 + i * 86400 * 1000)
    bars.push({
      date: d.toISOString().slice(0, 10),
      open: px,
      high: px * 1.01,
      low: px * 0.99,
      close: px,
      volume: 1_000_000 + i * 100,
    })
  }
  return bars
}

describe("etf quality engine", () => {
  it("keeps DBB thresholds untouched", () => {
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.stochKMax, 15.4)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })

  it("keeps product universe at 15 symbols", () => {
    assert.equal(DAILY_BOTTOM_BUY_ETFS.length, 15)
  })

  it("uses nominal pillar weights summing to 100", () => {
    const sum = Object.values(ETF_QUALITY_PILLAR_WEIGHTS).reduce((a, b) => a + b, 0)
    assert.equal(sum, 100)
  })

  it("marks QQQM pending when issuer AUM is missing (no invented AUM)", () => {
    const meta = getEtfQualityFundMeta("QQQM")
    assert.equal(meta.aumUsd, null)
    const row = buildQualityFeatureRow("QQQM", synthBars(900))
    assert.equal(row.eligible, false)
    assert.ok(row.reasons.includes("missing_aum"))
  })

  it("computes price metrics only with enough history", () => {
    const short = computeQualityPriceMetrics(synthBars(100))
    assert.equal(short.ok, false)
    const long = computeQualityPriceMetrics(synthBars(900))
    assert.equal(long.ok, true)
    assert.ok(Number.isFinite(long.ret3y))
  })

  it("peerPercentile ranks higher/lower correctly", () => {
    assert.equal(peerPercentile(10, [1, 5, 10], "higher"), 100)
    assert.equal(peerPercentile(1, [1, 5, 10], "higher"), 0)
    assert.equal(peerPercentile(0.1, [0.1, 0.2, 0.3], "lower"), 100)
  })

  it("peerPercentile ties resolve to neutral 50 (all equal)", () => {
    assert.equal(peerPercentile(0.08, [0.08, 0.08, 0.08, 0.08], "lower"), 50)
    assert.equal(peerPercentile(10, [10, 10, 10], "higher"), 50)
  })

  it("peerPercentile is order-independent for identical values", () => {
    const a = peerPercentile(0.08, [0.08, 0.08, 0.15, 0.08], "lower")
    const b = peerPercentile(0.08, [0.15, 0.08, 0.08, 0.08], "lower")
    const c = peerPercentile(0.08, [0.08, 0.15, 0.08, 0.08], "lower")
    assert.equal(a, b)
    assert.equal(b, c)
    assert.ok(a > 50) // tied best among lower-is-better with one worse peer
  })

  it("absoluteMetricScore maps bands", () => {
    assert.equal(absoluteMetricScore(0.03, { direction: "lower", good: 0.05, bad: 0.75 }), 100)
    assert.equal(absoluteMetricScore(0.75, { direction: "lower", good: 0.05, bad: 0.75 }), 0)
    assert.ok(absoluteMetricScore(0.4, { direction: "lower", good: 0.05, bad: 0.75 }) > 0)
  })

  it("stores MDD as positive magnitude so deeper drawdowns score worse", () => {
    const mild = []
    const deep = []
    let pxMild = 100
    let pxDeep = 100
    const day0 = Date.parse("2015-01-02T00:00:00Z")
    for (let i = 0; i < 800; i++) {
      // Mild: small chop; Deep: one -40% crash then flat recovery path length.
      if (i === 400) pxDeep *= 0.6
      else {
        pxMild = Math.max(5, pxMild * 1.0003)
        pxDeep = Math.max(5, pxDeep * 1.0003)
      }
      const d = new Date(day0 + i * 86400 * 1000).toISOString().slice(0, 10)
      mild.push({ date: d, open: pxMild, high: pxMild, low: pxMild, close: pxMild, volume: 1e6 })
      deep.push({ date: d, open: pxDeep, high: pxDeep, low: pxDeep, close: pxDeep, volume: 1e6 })
    }
    const mMild = computeQualityPriceMetrics(mild)
    const mDeep = computeQualityPriceMetrics(deep)
    assert.equal(mMild.ok, true)
    assert.equal(mDeep.ok, true)
    assert.ok(mMild.mdd3y >= 0)
    assert.ok(mDeep.mdd3y >= 0)
    assert.ok(mDeep.mdd3y > mMild.mdd3y)

    const peers = [mMild.mdd3y, mDeep.mdd3y, 0.25]
    const mildPct = peerPercentile(mMild.mdd3y, peers, "lower")
    const deepPct = peerPercentile(mDeep.mdd3y, peers, "lower")
    assert.ok(mildPct > deepPct, `expected mild MDD better than deep (${mildPct} vs ${deepPct})`)

    const mddBand = { direction: "lower", good: 0.15, bad: 0.55 }
    assert.ok(
      absoluteMetricScore(mMild.mdd3y, mddBand) > absoluteMetricScore(mDeep.mdd3y, mddBand),
    )
    // Signed-negative convention must not score as "good" (~100) under positive bands.
    assert.equal(absoluteMetricScore(-0.3, mddBand), 100)
    assert.ok(absoluteMetricScore(0.3, mddBand) < 100)
  })

  it("scores sector SPDR cohort with official Top10 composition", () => {
    const barsA = synthBars(2800, 100, 0.0008)
    const barsB = synthBars(2800, 100, 0.0002)
    const barsC = synthBars(2800, 100, 0.0005)
    const barsD = synthBars(2800, 100, 0.0003)
    const results = evaluateEtfQualityUniverse(["XLU", "XLI", "XLV", "XLF"], {
      XLU: barsA,
      XLI: barsB,
      XLV: barsC,
      XLF: barsD,
    })
    assert.equal(results.XLU.status, "scored")
    assert.equal(results.XLI.status, "scored")
    assert.equal(results.XLU.scoringMode, "peer_relative")
    assert.equal(results.XLU.peerSampleSize, 4)
    assert.equal(results.XLU.pillars.composition.excluded, false)
    assert.ok(results.XLU.metrics.top10WeightPct > 0)
    assert.ok(results.XLU.dataConfidence.score != null)
    assert.notEqual(results.XLU.dataConfidence.score, results.XLU.score)
    assert.ok(results.XLU.appliedWeights.cost > 0)
    // Tied expense ratios across Sector SPDR must not collapse to 0.
    assert.equal(results.XLU.pillars.cost.score, 50)
    assert.equal(results.XLI.pillars.cost.score, 50)
  })

  it("uses absolute reference when peer sample is below minimum", () => {
    assert.ok(ETF_QUALITY_MIN_PEER_RELATIVE >= 3)
    const results = evaluateEtfQualityUniverse(["SMH", "VGT"], {
      SMH: synthBars(900, 100, 0.0007),
      VGT: synthBars(900, 100, 0.0006),
    })
    assert.equal(results.SMH.peerGroup, "semiconductor")
    assert.equal(results.VGT.peerGroup, "broad_tech")
    assert.equal(results.SMH.scoringMode, "absolute_reference")
    assert.equal(results.VGT.scoringMode, "absolute_reference")
    assert.equal(results.SMH.peerSampleSize, 1)
  })

  it("renormalization exposes nominal vs applied weights", () => {
    const results = evaluateEtfQualityUniverse(["XLU", "XLI", "XLV", "XLF"], {
      XLU: synthBars(2800),
      XLI: synthBars(2800, 110, 0.0003),
      XLV: synthBars(2800, 120, 0.0004),
      XLF: synthBars(2800, 90, 0.0002),
    })
    const appliedSum = Object.values(results.XLU.appliedWeights).reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(appliedSum - 100) < 0.2)
    assert.ok(results.XLU.dataCoveragePct >= ETF_QUALITY_MIN_DATA_COVERAGE_PCT)
    assert.equal(results.XLU.dataConfidence.holdEvaluation, false)
  })

  it("official Top10 meta present for Phase D enrichment set", () => {
    for (const sym of ["SMH", "VGT", "AIQ", "BOTZ", "IGV", "GRID", "XLU", "XLI", "XLV", "XLF", "CIBR"]) {
      const m = getEtfQualityFundMeta(sym)
      assert.ok(m.top10WeightPct != null, `${sym} top10`)
      assert.ok(m.maxNameWeightPct != null, `${sym} max`)
      assert.ok(m.holdingsAsOf, `${sym} asOf`)
      assert.ok(m.holdingsSource, `${sym} source`)
    }
  })

  it("peer groups match Phase D redesign", () => {
    assert.equal(getEtfQualityFundMeta("VOO").peerGroup, "core_style")
    assert.equal(getEtfQualityFundMeta("VGT").peerGroup, "broad_tech")
    assert.equal(getEtfQualityFundMeta("IGV").peerGroup, "software_security")
    assert.equal(getEtfQualityFundMeta("CIBR").peerGroup, "software_security")
    assert.equal(getEtfQualityFundMeta("SMH").peerGroup, "semiconductor")
    assert.equal(getEtfQualityFundMeta("BOTZ").peerGroup, "ai_robotics")
    assert.equal(getEtfQualityFundMeta("AIQ").peerGroup, "ai_robotics")
    assert.equal(getEtfQualityFundMeta("GRID").peerGroup, "infrastructure")
  })

  it("resolve without bars stays pending (scaffold)", () => {
    const q = resolveEtfQualityEvaluation("VOO")
    assert.equal(q.status, "pending")
    assert.ok(q.pendingReasons.includes("awaiting_price_context"))
  })

  it("scoreQualityPeerCohort holds when coverage gate fails", () => {
    const row = buildQualityFeatureRow("VOO", synthBars(900))
    // Strip optional-like fields by cloning meta without holdings/spread — coverage still high.
    // Simulate excessive exclusion by nulling composition inputs.
    row.meta = {
      ...row.meta,
      top10WeightPct: null,
      maxNameWeightPct: null,
      medianSpreadPct: null,
    }
    // Also null ret5/10/recovery via short-circuit: keep bars but mutate price metrics.
    row.price = {
      ...row.price,
      ret5y: null,
      ret10y: null,
      recoveryDays: null,
    }
    const map = scoreQualityPeerCohort([row])
    const q = map.get("VOO")
    // Single peer → absolute; composition excluded (15) ≤ MAX 25 → may still score if coverage ok.
    assert.ok(q)
    assert.ok(q.dataConfidence)
    if (q.status === "pending") {
      assert.ok(
        q.pendingReasons.includes("low_data_coverage") ||
          q.pendingReasons.includes("excessive_pillar_exclusion"),
      )
    } else {
      assert.equal(q.pillars.composition.excluded, true)
      assert.equal(q.pillars.composition.excludeReason, "missing_official_top10")
    }
  })
})
