/**
 * Profit/loss validation unit tests (new file only; does not modify existing DBB tests).
 * node --test scripts/daily-bottom-profit-loss-validation.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  analyzeEntryPath,
  computeExpectancy,
  split5050ReturnAt,
} from "./lib/daily-bottom-profit-loss-validation.mjs"

function bars(closes) {
  return closes.map((c, i) => ({
    date: `2020-01-${String(i + 1).padStart(2, "0")}`,
    close: c,
  }))
}

describe("analyzeEntryPath MAE/MFE and levels", () => {
  it("tracks MAE, MFE, up/down first hits", () => {
    // entry 100; 95 (-5%); 110 (+10%); 80 (-20%)
    const b = bars([100, 95, 110, 80, 105])
    const r = analyzeEntryPath(b, 0, 100, 60)
    assert.equal(r.maePct, 20)
    assert.equal(r.mfePct, 10)
    assert.equal(r.hitUp[10], true)
    assert.equal(r.daysToUp[10], 2)
    assert.equal(r.hitDown[5], true)
    assert.equal(r.daysToDown[5], 1)
    assert.equal(r.hitDown[20], true)
    assert.equal(r.daysToDown[20], 3)
  })
})

describe("split5050ReturnAt", () => {
  it("keeps cash half when no 4/4", () => {
    const b = bars([100, 110, 120])
    const ep = {
      openIdx: 0,
      openPrice: 100,
      reached4: false,
      fill4Idx: null,
      fill4Price: null,
    }
    // at +1: px=110 → NAV = 0.5*1.1 + 0.5 = 1.05 → +5%
    const r = split5050ReturnAt(b, ep, 1)
    assert.equal(r.available, true)
    assert.equal(r.retPct, 5)
    assert.equal(r.deployed4, false)
  })

  it("deploys both halves when 4/4 filled", () => {
    const b = bars([100, 90, 95])
    const ep = {
      openIdx: 0,
      openPrice: 100,
      reached4: true,
      fill4Idx: 1,
      fill4Price: 90,
    }
    // at +2: px=95 → NAV = 0.5*(95/100)+0.5*(95/90)
    const r = split5050ReturnAt(b, ep, 2)
    assert.equal(r.deployed4, true)
    const expected = (0.5 * (95 / 100) + 0.5 * (95 / 90) - 1) * 100
    assert.ok(Math.abs(r.retPct - Math.round(expected * 100) / 100) < 0.02)
  })
})

describe("computeExpectancy", () => {
  it("computes payoff and positive expectancy on toy set", () => {
    // +10,+10,-5 → winRate 2/3, avgWin 10, avgLoss -5, E = 2/3*10 - 1/3*5 = 5
    const e = computeExpectancy([10, 10, -5])
    assert.equal(e.winRate, 66.67)
    assert.equal(e.avgWin, 10)
    assert.equal(e.avgLoss, -5)
    assert.equal(e.payoffRatio, 2)
    assert.equal(e.expectancy, 5)
    assert.equal(e.expectancySign, "positive")
  })
})
