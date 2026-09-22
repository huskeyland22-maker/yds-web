/**
 * Daily Bottom Buy validation — unit tests (synthetic bars).
 * node --test scripts/daily-bottom-buy-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  rsiWilderSeries,
  stochasticSeries,
  bollingerSeries,
  maDeviationSeries,
  enrichBarsWithIndicators,
} from "./lib/daily-bottom-indicators.mjs"
import {
  DAILY_BOTTOM_BUY_ETFS,
  DIP_DEF,
  TRAIN_RATIO,
  findDailyBottomEvents,
  percentile,
  proposeThresholdsFromTroughs,
  conditionFlags,
  risingEdgeSignals,
  analyzeEtf,
  timeSplitBars,
  partitionEventsBySplit,
  freezeThresholdsFromTrainTroughs,
  analyzeEtfTrainTest,
} from "./lib/daily-bottom-buy-validation-core.mjs"

function makeBars(closes, startDate = "2020-01-02") {
  const start = new Date(`${startDate}T00:00:00Z`)
  return closes.map((c, i) => {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    // skip weekends roughly by advancing calendar days only — fine for synthetic
    const date = d.toISOString().slice(0, 10)
    return {
      date,
      open: c,
      high: c * 1.01,
      low: c * 0.99,
      close: c,
      volume: 1e6,
    }
  })
}

describe("daily-bottom indicators", () => {
  it("computes Wilder RSI series length and warmup", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 5 + i * 0.1)
    const rsi = rsiWilderSeries(closes, 14)
    assert.equal(rsi.length, 40)
    assert.equal(rsi[13], null)
    assert.ok(rsi[14] != null)
    assert.ok(rsi[39] >= 0 && rsi[39] <= 100)
  })

  it("computes stochastic in 0..100 band after warmup", () => {
    const bars = makeBars(
      Array.from({ length: 50 }, (_, i) => 50 + Math.sin(i / 4) * 10),
    )
    const { k, d } = stochasticSeries(bars, 14, 3, 3)
    assert.equal(k.length, 50)
    const lastK = k[k.length - 1]
    const lastD = d[d.length - 1]
    assert.ok(lastK != null && lastK >= 0 && lastK <= 100)
    assert.ok(lastD != null && lastD >= 0 && lastD <= 100)
  })

  it("bollinger %B near 0.5 on flat series", () => {
    const closes = Array(40).fill(100)
    const bb = bollingerSeries(closes, 20, 2)
    assert.equal(bb.pctB[19], 0.5)
  })

  it("ma20 deviation is 0 on flat series", () => {
    const closes = Array(40).fill(100)
    const { deviationPct } = maDeviationSeries(closes, 20)
    assert.equal(deviationPct[39], 0)
  })
})

describe("daily-bottom event detection", () => {
  it("finds a clear dip+rebound as an event", () => {
    // Build: flat 80, drop 12%, trough, rebound 8%+
    const closes = []
    for (let i = 0; i < 80; i++) closes.push(100)
    for (let i = 0; i < 15; i++) closes.push(100 - i * 0.8) // down to ~88.8
    closes.push(87) // trough-ish
    for (let i = 1; i <= 25; i++) closes.push(87 + i * 0.6) // rebound
    for (let i = 0; i < 30; i++) closes.push(102)

    const bars = makeBars(closes)
    const { events } = findDailyBottomEvents(bars, DIP_DEF)
    assert.ok(events.length >= 1, `expected ≥1 event, got ${events.length}`)
    const e = events[0]
    assert.ok(e.drawdownPct >= 5)
    assert.ok(e.reboundDays != null && e.reboundDays <= 20)
    assert.ok(e.rsi14 != null)
  })

  it("V2 ETF list is fixed at 9 in official order", () => {
    assert.equal(DAILY_BOTTOM_BUY_ETFS.length, 9)
    const symbols = DAILY_BOTTOM_BUY_ETFS.map((e) => e.symbol)
    assert.deepEqual(symbols, [
      "SMH",
      "GRID",
      "QQQ",
      "IGV",
      "CIBR",
      "BOTZ",
      "ITA",
      "URA",
      "IBB",
    ])
    for (const bad of ["XLK", "XLF", "XLY", "XLV", "TQQQ", "SOXL", "XLP", "VOO", "QQQM", "SCHD", "IAU"]) {
      assert.ok(!symbols.includes(bad))
    }
  })
})

describe("thresholds & flags", () => {
  it("percentile and proposeThresholdsFromTroughs", () => {
    assert.equal(percentile([1, 2, 3, 4, 5], 50), 3)
    const th = proposeThresholdsFromTroughs([
      { rsi14: 30, stochK: 20, bbPctB: 0.1, ma20DevPct: -5 },
      { rsi14: 40, stochK: 30, bbPctB: 0.2, ma20DevPct: -3 },
      { rsi14: 35, stochK: 25, bbPctB: 0.15, ma20DevPct: -4 },
    ])
    assert.equal(th.rsiMax, 35)
    assert.ok(th.stochKMax === 25)
  })

  it("conditionFlags count 0..4", () => {
    const th = { rsiMax: 35, stochKMax: 25, bbPctBMax: 0.15, ma20DevMax: -4 }
    const f = conditionFlags(
      { rsi14: 30, stochK: 20, bbPctB: 0.1, ma20DevPct: -5 },
      th,
    )
    assert.equal(f.count, 4)
    const f2 = conditionFlags(
      { rsi14: 50, stochK: 50, bbPctB: 0.5, ma20DevPct: 0 },
      th,
    )
    assert.equal(f2.count, 0)
  })

  it("risingEdgeSignals fires once per streak", () => {
    const rows = [
      { v: false },
      { v: true },
      { v: true },
      { v: false },
      { v: true },
    ]
    const idxs = risingEdgeSignals(rows, (r) => r.v)
    assert.deepEqual(idxs, [1, 4])
  })
})

describe("analyzeEtf smoke", () => {
  it("returns structured report on synthetic path", () => {
    const closes = []
    for (let wave = 0; wave < 6; wave++) {
      for (let i = 0; i < 40; i++) closes.push(100 + i * 0.3)
      for (let i = 0; i < 20; i++) closes.push(112 - i * 0.7)
      for (let i = 0; i < 20; i++) closes.push(98 + i * 0.5)
    }
    const bars = makeBars(closes, "2018-01-02")
    const r = analyzeEtf(
      { symbol: "TEST", theme: "synthetic", group: "ai" },
      bars,
      null,
    )
    assert.equal(r.symbol, "TEST")
    assert.ok(r.barCount > 100)
    assert.ok(r.thresholdsUsed.rsiMax != null)
    assert.ok(r.perIndicator.rsi)
    assert.ok(r.combo.ge3)
    assert.ok(Array.isArray(r.troughSnapshots))
  })
})

describe("train/test temporal split", () => {
  it("splits chronologically at ~70% without shuffle", () => {
    const bars = makeBars(Array.from({ length: 100 }, (_, i) => 100 + i * 0.01), "2019-01-01")
    const split = timeSplitBars(bars, TRAIN_RATIO)
    assert.equal(split.trainBarCount, 70)
    assert.equal(split.testBarCount, 30)
    assert.ok(split.trainLastDate < split.testFirstDate)
    assert.equal(split.splitDate, bars[70].date)
  })

  it("excludes boundary-straddling events from train and test", () => {
    const events = [
      { index: 49 }, // 49+20=69 < 70 → train
      { index: 50 }, // 50+20=70 not < 70 → boundary excluded
      { index: 68 }, // straddles → excluded
      { index: 75 }, // test
    ]
    const { train, test } = partitionEventsBySplit(events, 70, 20)
    assert.deepEqual(
      train.map((e) => e.index),
      [49],
    )
    assert.deepEqual(
      test.map((e) => e.index),
      [75],
    )
  })

  it("freezes thresholds from train troughs only", () => {
    const th = freezeThresholdsFromTrainTroughs([
      { rsi14: 30, stochK: 10, bbPctB: 0, ma20DevPct: -5 },
      { rsi14: 40, stochK: 20, bbPctB: 0.1, ma20DevPct: -3 },
      { rsi14: 35, stochK: 15, bbPctB: 0.05, ma20DevPct: -4 },
    ])
    assert.equal(th.rsiMax, 35)
    assert.ok(String(th.source).includes("TRAIN"))
  })

  it("analyzeEtfTrainTest keeps frozen thresholds on test", () => {
    const closes = []
    for (let wave = 0; wave < 10; wave++) {
      for (let i = 0; i < 40; i++) closes.push(100 + i * 0.3)
      for (let i = 0; i < 20; i++) closes.push(112 - i * 0.7)
      for (let i = 0; i < 20; i++) closes.push(98 + i * 0.5)
    }
    const bars = makeBars(closes, "2016-01-02")
    const frozen = {
      rsiMax: 36,
      stochKMax: 15,
      bbPctBMax: 0.05,
      ma20DevMax: -4,
      source: "unit-test-frozen",
    }
    const r = analyzeEtfTrainTest(
      { symbol: "TEST", theme: "synthetic", group: "ai" },
      bars,
      frozen,
      TRAIN_RATIO,
    )
    assert.equal(r.thresholdsFrozen.rsiMax, 36)
    assert.ok(r.split.trainBarCount > r.split.testBarCount)
    assert.ok(r.test.combo.ge3)
    assert.ok(r.train.combo.ge3)
  })
})
