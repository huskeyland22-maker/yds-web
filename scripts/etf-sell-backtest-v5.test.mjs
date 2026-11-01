/**
 * node --test scripts/etf-sell-backtest-v5.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  analyzeSymbolV5,
  classifyAdvantage,
  measureHoldVsSell,
  measureLossHold,
  summarizeDecisions,
  summarizeEtf,
} from "./lib/etf-sell-backtest-v5.mjs"

const FAIL = { rsi14: 50, stochK: 50, bbPctB: 0.5, ma20DevPct: 0 }
const THREE = { rsi14: 30, stochK: 10, bbPctB: 0.5, ma20DevPct: -5 }

function row(i, close, flags = FAIL) {
  const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
  return { date, close, ...flags }
}

function closesFrom(rows) {
  return rows.map((item) => item.close)
}

function flat(length = 80) {
  return Array.from({ length }, (_, i) => row(i, 100))
}

function hold(rows, from, to, close) {
  for (let i = from; i <= to; i++) rows[i].close = close
}

describe("etf sell backtest v5", () => {
  it("sells the first peak drawdown and keeps the entry return separate from the T0 return", () => {
    const rows = flat()
    hold(rows, 6, 9, 118)
    rows[10].close = 112
    rows[30].close = 118
    const earlyDip = measureHoldVsSell(closesFrom(flat()), 1, 60, 0.1, 0.05)
    assert.equal(earlyDip.event, false)
    const hit = measureHoldVsSell(closesFrom(rows), 1, 60, 0.1, 0.05)
    assert.equal(hit.event, true)
    assert.equal(hit.t0, 10)
    assert.equal(Math.round(hit.sellVsEntry * 1000) / 10, 12)
    assert.equal(Math.round(hit.horizons.t20.vsEntry * 1000) / 10, 18)
    assert.equal(Math.round(hit.horizons.t20.vsT0 * 10000) / 100, 5.36)
    const laterHigh = rows.map((item) => ({ ...item, close: item.close }))
    laterHigh[40].close = 200
    const moved = measureHoldVsSell(closesFrom(laterHigh), 1, 60, 0.1, 0.05)
    assert.equal(moved.t0, hit.t0)

    const onlyTen = flat()
    hold(onlyTen, 6, 9, 112)
    onlyTen[10].close = 106.4
    hold(onlyTen, 11, 61, 106.4)
    const armed = measureHoldVsSell(closesFrom(onlyTen), 1, 60, 0.15, 0.05)
    assert.equal(armed.event, false)
    const ten = measureHoldVsSell(closesFrom(onlyTen), 1, 60, 0.1, 0.05)
    const deeper = measureHoldVsSell(closesFrom(onlyTen), 1, 60, 0.1, 0.07)
    assert.equal(ten.event, true)
    assert.equal(deeper.event, false)
  })

  it("drops a horizon that would fall outside the 60-day window instead of using day 60", () => {
    const rows = flat()
    hold(rows, 6, 49, 118)
    rows[50].close = 112
    rows[55].close = 114
    rows[60].close = 116
    rows[61].close = 130
    const hit = measureHoldVsSell(closesFrom(rows), 1, 60, 0.1, 0.05)
    assert.equal(hit.t0, 50)
    assert.notEqual(hit.horizons.t5, null)
    assert.notEqual(hit.horizons.t10, null)
    assert.equal(hit.horizons.t20, null)
    assert.equal(hit.horizons.t40, null)
    assert.equal(Math.round(hit.horizons.end.vsEntry * 1000) / 10, 30)
    assert.notEqual(hit.horizons.end.vsEntry, hit.sellVsEntry)
  })

  it("classifies hold advantage, sell advantage, and mixed results on the paired sample", () => {
    assert.equal(classifyAdvantage(0.02, 0.01, 60), "계속 보유 우위")
    assert.equal(classifyAdvantage(-0.02, -0.01, 40), "매도 우위 후보")
    assert.equal(classifyAdvantage(0.02, -0.01, 60), "혼합")
    const held = {
      event: true,
      sellVsEntry: 0.12,
      hasAfter: true,
      maxRise: 0.05,
      maxDrop: 0.01,
      horizons: { t20: { vsEntry: 0.18, vsT0: 0.05 } },
    }
    const sold = {
      event: true,
      sellVsEntry: 0.12,
      hasAfter: true,
      maxRise: -0.04,
      maxDrop: 0.08,
      horizons: { t20: { vsEntry: 0.04, vsT0: -0.07 } },
    }
    const better = summarizeDecisions({ id: "up", label: "up", arm: null, dd: 0.05 }, [held, held])
    const worse = summarizeDecisions({ id: "down", label: "down", arm: null, dd: 0.05 }, [sold, sold])
    assert.equal(better.advantage.rawLabel, "계속 보유 우위")
    assert.equal(better.advantage.label, "표본 부족")
    assert.equal(better.t20.pairedSellAvg, 12)
    assert.equal(better.t20.avgVsEntry, 18)
    assert.equal(worse.advantage.rawLabel, "매도 우위 후보")
    assert.equal(worse.advantage.label, "표본 부족")
    assert.equal(worse.sellAvg, 12)
    assert.notEqual(worse.t20.avgVsEntry, worse.sellAvg)
  })

  it("keeps the never-+10 group separate and aggregates an ETF sample", () => {
    const missed = flat()
    missed[1] = row(1, 100, THREE)
    missed[8].close = 90
    const part = analyzeSymbolV5("BOTZ", missed)
    assert.equal(part.missed, 1)
    assert.equal(part.profit["p10-d5"][0].event, false)
    assert.equal(part.losses.loss10[0].event, true)
    assert.equal(Math.round(part.losses.loss10[0].sellVsEntry * 1000) / 10, -10)

    const reached = flat()
    reached[1] = row(1, 100, THREE)
    hold(reached, 6, 9, 118)
    reached[10].close = 112
    const winner = analyzeSymbolV5("SMH", reached)
    assert.equal(winner.missed, 0)
    assert.equal(winner.losses.loss10.length, 0)
    assert.equal(winner.profit["p10-d5"][0].event, true)

    const thin = summarizeEtf({ id: "x", label: "x", arm: null, dd: 0.05 }, [
      { event: true, etf: "QQQ", sellVsEntry: 0.1, hasAfter: false, horizons: {} },
    ])
    assert.equal(thin.sampleNote, "표본 부족")
  })
})
