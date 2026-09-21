/**
 * Split-buy simulation unit tests
 * node --test scripts/daily-bottom-split-buy-sim.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import {
  FROZEN_THRESHOLDS,
  buildSplitBuyEpisodes,
  simulateSchemeOnEpisodes,
  analyzeEtfSplitBuy,
} from "./lib/daily-bottom-split-buy-sim.mjs"

function makeBars(closes, startDate = "2020-01-02") {
  const start = new Date(`${startDate}T00:00:00Z`)
  return closes.map((c, i) => {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    return {
      date: d.toISOString().slice(0, 10),
      open: c,
      high: c * 1.02,
      low: c * 0.98,
      close: c,
      volume: 1e6,
    }
  })
}

/** Force ge3 / eq4 flags by patching indicator fields after enrich */
function patchFlags(enriched, map) {
  return enriched.map((r, i) => {
    const m = map[i]
    if (!m) return r
    return {
      ...r,
      rsi14: m.rsi ?? r.rsi14,
      stochK: m.stoch ?? r.stochK,
      bbPctB: m.bb ?? r.bbPctB,
      ma20DevPct: m.ma ?? r.ma20DevPct,
    }
  })
}

describe("split-buy episodes", () => {
  it("bundles 3→4 into one episode and does not daily rebuy", () => {
    const closes = Array.from({ length: 80 }, () => 100)
    const bars = makeBars(closes)
    let enriched = enrichBarsWithIndicators(bars)
    // days 40-45: count 3, day 42: count 4, then cool
    const map = {}
    for (let i = 40; i <= 45; i++) {
      map[i] = { rsi: 30, stoch: 10, bb: 0.5, ma: -5 } // 3 flags (rsi,stoch,ma) — bb not
    }
    map[42] = { rsi: 30, stoch: 10, bb: 0, ma: -5 } // 4
    map[46] = { rsi: 50, stoch: 50, bb: 0.5, ma: 0 } // cool <2
    enriched = patchFlags(enriched, map)

    const eps = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
      fromIdx: 0,
      toIdx: enriched.length,
    })
    assert.ok(eps.length >= 1)
    const ep = eps.find((e) => e.openIdx === 40)
    assert.ok(ep)
    assert.equal(ep.reached4, true)
    assert.equal(ep.fill4Idx, 42)
    assert.equal(ep.no4Rebound, false)
    // Should not create separate episode on day 41-45
    assert.equal(eps.filter((e) => e.openIdx > 40 && e.openIdx <= 45).length, 0)
  })

  it("records no4 rebound when 4 never arrives", () => {
    const closes = Array.from({ length: 80 }, () => 100)
    const bars = makeBars(closes)
    let enriched = enrichBarsWithIndicators(bars)
    const map = {}
    for (let i = 40; i <= 44; i++) {
      map[i] = { rsi: 30, stoch: 10, bb: 0.5, ma: -5 } // 3 only
    }
    map[45] = { rsi: 55, stoch: 55, bb: 0.5, ma: 1 }
    enriched = patchFlags(enriched, map)
    const eps = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
      fromIdx: 0,
      toIdx: enriched.length,
    })
    const ep = eps.find((e) => e.openIdx === 40)
    assert.ok(ep)
    assert.equal(ep.reached4, false)
    assert.equal(ep.no4Rebound, true)
  })

  it("scheme A deploys both tranches when 4 hits", () => {
    const closes = Array.from({ length: 100 }, (_, i) => 100 - (i > 50 && i < 60 ? (i - 50) : 0))
    // flatten after
    for (let i = 60; i < 100; i++) closes[i] = 90
    const bars = makeBars(closes)
    let enriched = enrichBarsWithIndicators(bars)
    const map = {}
    for (let i = 50; i <= 55; i++) map[i] = { rsi: 30, stoch: 10, bb: 0.5, ma: -5 }
    map[52] = { rsi: 30, stoch: 10, bb: 0, ma: -5 }
    map[56] = { rsi: 60, stoch: 60, bb: 0.5, ma: 0 }
    enriched = patchFlags(enriched, map)
    const eps = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
      fromIdx: 0,
      toIdx: enriched.length,
    })
    const sim = simulateSchemeOnEpisodes(enriched, eps, {
      id: "A",
      label: "A",
      w3: 0.5,
      w4: 0.5,
    })
    assert.ok(sim.reached4Count >= 1)
    assert.ok(sim.nPerf >= 1)
  })
})

describe("analyzeEtfSplitBuy smoke", () => {
  it("runs on long synthetic series", () => {
    const closes = []
    for (let w = 0; w < 12; w++) {
      for (let i = 0; i < 40; i++) closes.push(100 + i * 0.2)
      for (let i = 0; i < 25; i++) closes.push(108 - i * 0.6)
      for (let i = 0; i < 25; i++) closes.push(93 + i * 0.4)
    }
    const bars = makeBars(closes, "2016-01-02")
    const r = analyzeEtfSplitBuy(
      { symbol: "TEST", theme: "synthetic" },
      bars,
      FROZEN_THRESHOLDS,
    )
    assert.ok(r.split.splitIdx > 0)
    assert.ok(r.schemes.A)
    assert.ok(r.schemes.ALL3)
    assert.ok(r.schemes.WAIT4)
  })
})
