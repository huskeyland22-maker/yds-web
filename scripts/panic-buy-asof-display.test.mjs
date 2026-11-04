/**
 * 공포·패닉 매수 기준 시각.
 * node --test scripts/panic-buy-asof-display.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveMarketUpdateTime } from "../vite-project/src/utils/marketUpdateTime.js"
import {
  resolvePanicBuyDisplay,
  resolvePanicBuyLoadingState,
  selectPanicHistoryRows,
} from "../vite-project/src/content/ydsPanicBuyAsOf.js"

const SEED_AT = "2026-05-19T12:00:00.000Z"
const LATEST_AT = "2026-11-03T21:00:00.000Z"

const seedPanic = {
  date: "2026-05-19",
  updatedAt: SEED_AT,
  vix: 17.82,
  fearGreed: 66,
  putCall: 0.5,
}

const hubLatest = {
  vix: 18.4,
  fearGreed: 41,
  putCall: 0.92,
  updatedAt: LATEST_AT,
  __fromHub: true,
}

describe("panic buy as-of display", () => {
  it("does not show the 2026-05-19 seed as the latest date", () => {
    const view = resolvePanicBuyDisplay({
      historySource: "localStorage",
      historyPanic: seedPanic,
      hubPanic: hubLatest,
    })
    assert.equal(view.source, "hub-latest")
    assert.notEqual(view.panicData?.date, "2026-05-19")
    assert.notEqual(view.panicData?.updatedAt, SEED_AT)
    const label = resolveMarketUpdateTime(view.panicData)
    assert.equal(label.iso, LATEST_AT)
    assert.match(label.kstLabel, /^2026-11-04 /)
    assert.doesNotMatch(label.kstLabel, /2026-05-19/)
  })

  it("shows latest.updatedAt when history is missing", () => {
    const view = resolvePanicBuyDisplay({
      historySource: "none",
      historyPanic: null,
      hubPanic: hubLatest,
    })
    assert.equal(view.source, "hub-latest")
    assert.equal(view.panicData.updatedAt, LATEST_AT)
    assert.equal(resolveMarketUpdateTime(view.panicData).iso, LATEST_AT)
  })

  it("shows no date when latest.updatedAt is absent", () => {
    const view = resolvePanicBuyDisplay({
      historySource: "localStorage",
      historyPanic: seedPanic,
      hubPanic: { vix: 18.1, fearGreed: 40, putCall: 0.8 },
    })
    assert.equal(view.source, "hub-latest")
    assert.equal(view.panicData.updatedAt, null)
    assert.equal(view.panicData.date, null)
    const label = resolveMarketUpdateTime(view.panicData)
    assert.equal(label.iso, null)
    assert.equal(label.kstLabel, null)
  })

  it("does not invent a clock when latest is an emergency payload", () => {
    const view = resolvePanicBuyDisplay({
      historySource: "localStorage",
      historyPanic: seedPanic,
      hubPanic: {
        __emergency: true,
        updatedAt: "2026-05-21T12:00:00.000Z",
        vix: 16.76,
        fearGreed: 50,
        putCall: 1,
      },
    })
    assert.equal(view.source, "none")
    assert.equal(view.panicData, null)
    assert.equal(resolveMarketUpdateTime(null).kstLabel, null)
  })

  it("uses history-latest API row when hub is emergency (never seed)", () => {
    const apiLatest = {
      date: "2026-11-03",
      updatedAt: LATEST_AT,
      vix: 18.4,
      fearGreed: 41,
      putCall: 0.92,
    }
    const view = resolvePanicBuyDisplay({
      historySource: "localStorage",
      historyPanic: seedPanic,
      hubPanic: {
        __emergency: true,
        updatedAt: "2026-05-21T12:00:00.000Z",
        vix: 16.76,
        fearGreed: 50,
        putCall: 1,
      },
      latestHistoryRow: apiLatest,
    })
    assert.equal(view.source, "history-latest")
    assert.equal(view.panicData.date, "2026-11-03")
    assert.equal(view.panicData.updatedAt, LATEST_AT)
    assert.doesNotMatch(resolveMarketUpdateTime(view.panicData).kstLabel, /2026-05-19/)
    assert.doesNotMatch(resolveMarketUpdateTime(view.panicData).kstLabel, /2026-05-21/)
  })

  it("exits syncing UI after boot settles even with empty metrics", () => {
    assert.deepEqual(resolvePanicBuyLoadingState({ bootSettled: false, hasLive: false }), {
      phase: "syncing",
      showSyncing: true,
      showEmpty: false,
    })
    assert.deepEqual(resolvePanicBuyLoadingState({ bootSettled: true, hasLive: false }), {
      phase: "empty",
      showSyncing: false,
      showEmpty: true,
    })
    assert.deepEqual(resolvePanicBuyLoadingState({ bootSettled: true, hasLive: true }), {
      phase: "ready",
      showSyncing: false,
      showEmpty: false,
    })
  })

  it("keeps PRO history when the index-history API succeeded", () => {
    const proRow = {
      date: "2026-11-02",
      updatedAt: "2026-11-02T12:00:00.000Z",
      vix: 19.2,
      fearGreed: 38,
      putCall: 0.87,
    }
    const view = resolvePanicBuyDisplay({
      historySource: "supabase-index-history",
      historyPanic: proRow,
      hubPanic: hubLatest,
    })
    assert.equal(view.source, "pro-history")
    assert.equal(view.panicData.date, "2026-11-02")
    assert.equal(view.panicData.updatedAt, "2026-11-02T12:00:00.000Z")
    assert.match(resolveMarketUpdateTime(view.panicData).kstLabel, /^2026-11-02 /)
  })

  it("does not mix the May seed into API history rows", () => {
    const apiRows = [
      { date: "2026-11-02", vix: 19.2, fearGreed: 38, putCall: 0.87 },
      { date: "2026-11-03", vix: 18.4, fearGreed: 41, putCall: 0.92 },
    ]
    const seedRows = [
      { date: "2026-05-19", vix: 17.82, fearGreed: 66, putCall: 0.5 },
    ]
    const picked = selectPanicHistoryRows({ hubRows: apiRows, localSeedRows: seedRows })
    assert.equal(picked.fallbackUsed, false)
    assert.deepEqual(picked.rows.map((row) => row.date), ["2026-11-02", "2026-11-03"])
    assert.equal(picked.rows.some((row) => row.date === "2026-05-19"), false)
  })
})
