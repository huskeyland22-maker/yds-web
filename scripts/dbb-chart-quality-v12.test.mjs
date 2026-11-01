/**
 * DBB prospective tracking v12.
 * node --test scripts/dbb-chart-quality-v12.test.mjs
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { DAILY_BOTTOM_THRESHOLDS } from "../api/_lib/dailyBottomBuyEngine.js"
import {
  PROSPECTIVE_RULE,
  PROSPECTIVE_STORAGE_KEY,
  applyBarsToEvent,
  buildProspectiveEventFromCard,
  emptyProspectiveState,
  eventDedupeKey,
  exportProspectiveCsv,
  exportProspectiveJson,
  ingestProspectiveCards,
  isRisingEdgeSignal,
  mergeWithoutOverwrite,
  summarizeProspective,
} from "../vite-project/src/content/dbbProspectiveV12.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")

function read(rel) {
  return readFileSync(join(root, rel), "utf8")
}

function hash(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function card(overrides = {}) {
  return {
    ok: true,
    symbol: "SMH",
    theme: "반도체",
    themeShort: "반도체",
    asOfDate: "2026-10-15",
    close: 100,
    rsi14: 30,
    stochK: 10,
    bbPctB: -0.05,
    ma20DevPct: -5,
    flags: { rsi: true, stoch: true, bb: true, ma20: true },
    count: 4,
    ...overrides,
  }
}

function barsAroundSignal(signalDate = "2026-10-15") {
  const start = Date.parse(`${signalDate}T00:00:00Z`)
  const out = []
  for (let i = -5; i <= 130; i++) {
    const d = new Date(start + i * 86400000).toISOString().slice(0, 10)
    const close = 100 + i * 0.1
    out.push({
      date: d,
      open: close - 0.2,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1e6,
    })
  }
  return out
}

describe("dbb prospective v12", () => {
  it("freezes rules and storage key separate from trades", () => {
    assert.equal(PROSPECTIVE_STORAGE_KEY, "yds.dbbProspective.v12")
    assert.match(PROSPECTIVE_RULE.noBackfill, /소급/)
    assert.match(PROSPECTIVE_RULE.noAutoTrade, /자동/)
    assert.equal(PROSPECTIVE_RULE.primaryMetrics.includes("t60MedianReturn"), true)
    assert.equal(DAILY_BOTTOM_THRESHOLDS.rsiMax, 36)
  })

  it("establishes baseline without backfilling active signals", () => {
    const first = ingestProspectiveCards(emptyProspectiveState(), [card({ count: 4 })], {
      observedAt: "2026-10-16T01:00:00.000Z",
      dataAsOf: "2026-10-15",
    })
    assert.equal(first.baselineJustSet, true)
    assert.equal(first.created.length, 0)
    assert.equal(first.state.events.length, 0)
    assert.equal(first.state.meta.baselineEstablished, true)

    const second = ingestProspectiveCards(first.state, [card({ count: 4, asOfDate: "2026-10-15" })], {
      observedAt: "2026-10-16T02:00:00.000Z",
    })
    assert.equal(second.created.length, 0)

    const third = ingestProspectiveCards(
      second.state,
      [card({ count: 1, asOfDate: "2026-10-16" })],
      { observedAt: "2026-10-17T01:00:00.000Z" },
    )
    const fourth = ingestProspectiveCards(
      third.state,
      [card({ count: 3, asOfDate: "2026-10-17" })],
      { observedAt: "2026-10-18T01:00:00.000Z" },
    )
    assert.equal(fourth.created.length, 1)
    assert.equal(fourth.state.events[0].signalCount, 3)
    assert.equal(fourth.state.events[0].signalDate, "2026-10-17")
  })

  it("rejects signals before prospective start and prevents duplicates", () => {
    let state = emptyProspectiveState()
    state = ingestProspectiveCards(state, [card({ count: 1, asOfDate: "2026-10-10" })], {
      observedAt: "2026-10-11T00:00:00.000Z",
      dataAsOf: "2026-10-10",
    }).state
    state = ingestProspectiveCards(state, [card({ count: 1, asOfDate: "2026-10-11" })], {
      observedAt: "2026-10-12T00:00:00.000Z",
    }).state
    const early = ingestProspectiveCards(state, [card({ count: 3, asOfDate: "2026-10-09" })], {
      observedAt: "2026-10-12T01:00:00.000Z",
    })
    assert.equal(early.created.length, 0)
    assert.ok(early.skipped.some((s) => s.reason === "before_prospective_start" || s.reason === "not_rising_edge_or_already_active"))

    state = ingestProspectiveCards(state, [card({ count: 3, asOfDate: "2026-10-12" })], {
      observedAt: "2026-10-13T00:00:00.000Z",
    }).state
    assert.equal(state.events.length, 1)
    const again = ingestProspectiveCards(state, [card({ count: 1, asOfDate: "2026-10-13" })], {
      observedAt: "2026-10-14T00:00:00.000Z",
    }).state
    const dup = ingestProspectiveCards(again, [card({ count: 4, asOfDate: "2026-10-12" })], {
      observedAt: "2026-10-15T00:00:00.000Z",
    })
    assert.equal(dup.created.length, 0)
    assert.equal(dup.state.events.length, 1)
  })

  it("does not overwrite firstObservedAt or indicators on merge", () => {
    const a = buildProspectiveEventFromCard(card(), { observedAt: "2026-10-16T01:00:00.000Z" })
    const b = buildProspectiveEventFromCard(card({ rsi14: 99, count: 3 }), {
      observedAt: "2026-10-17T01:00:00.000Z",
    })
    const merged = mergeWithoutOverwrite(a, b)
    assert.equal(merged.firstObservedAt, "2026-10-16T01:00:00.000Z")
    assert.equal(merged.indicators.rsi14, 30)
    assert.equal(merged.signalCount, 4)
  })

  it("keeps entry pending without inventing next open and leaves incomplete non-zero", () => {
    const event = buildProspectiveEventFromCard(card({ asOfDate: "2026-10-15", count: 3 }))
    assert.equal(event.entryStatus, "pending")
    const onlySignal = applyBarsToEvent(event, [
      { date: "2026-10-15", open: 100, high: 101, low: 99, close: 100, volume: 1 },
    ])
    assert.equal(onlySignal.entryStatus, "pending")
    assert.equal(onlySignal.horizons["60"].priceReturnPct, null)

    const priced = applyBarsToEvent(event, barsAroundSignal("2026-10-15"))
    assert.equal(priced.entryStatus, "confirmed")
    assert.ok(Number.isFinite(priced.entryPrice))
    assert.equal(priced.horizons["60"].priceReturnStatus, "complete")
    assert.notEqual(priced.horizons["60"].priceReturnPct, 0)

    const summary = summarizeProspective({ events: [priced] }, 60)
    assert.equal(summary.complete, 1)
    assert.equal(summary.pendingEntry, 0)
  })

  it("detects rising edge only after below-threshold observation", () => {
    assert.equal(isRisingEdgeSignal(card({ count: 3 }), null), false)
    assert.equal(isRisingEdgeSignal(card({ count: 3 }), { count: 4, asOfDate: "2026-10-14" }), false)
    assert.equal(isRisingEdgeSignal(card({ count: 3 }), { count: 2, asOfDate: "2026-10-14" }), true)
  })

  it("exports match event counts and leaves prior research JSON untouched", () => {
    const paths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => join(dataDir, `dbb-chart-quality-v${n}.json`))
    const before = paths.map(hash)
    const state = {
      meta: emptyProspectiveState().meta,
      events: [buildProspectiveEventFromCard(card())],
    }
    const json = JSON.parse(exportProspectiveJson(state))
    assert.equal(json.prospectiveOnly, true)
    assert.equal(json.events.length, 1)
    const csv = exportProspectiveCsv(state)
    assert.equal(csv.trim().split("\n").length, 2)
    assert.equal(eventDedupeKey("etf", "smh", "2026-10-15"), "etf|SMH|2026-10-15")
    assert.deepEqual(paths.map(hash), before)

    assert.match(read("vite-project/src/App.jsx"), /path="\/dbb-prospective-v12"/)
    assert.match(read("vite-project/src/utils/ydsUiLabels.js"), /DBB 전향적 검증/)
    for (const page of [
      "vite-project/src/pages/DailyBottomBuyPage.jsx",
      "vite-project/src/content/ydsTradeRecords.js",
      "api/_lib/dailyBottomBuyEngine.js",
      "vite-project/src/content/ydsDailyBottomBuyEpisodes.js",
    ]) {
      assert.equal(read(page).includes("dbbProspectiveV12"), false)
      assert.equal(read(page).includes("yds.dbbProspective.v12"), false)
    }
    assert.equal(DAILY_BOTTOM_THRESHOLDS.ma20DevMax, -4.2)
  })
})
