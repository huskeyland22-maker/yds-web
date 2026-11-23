import { describe, expect, it } from "vitest"
import { americaNyWallTimeToUtcMs } from "../../../api/_lib/usEquitySession.js"
import { PANIC_HISTORY_SEED } from "./panicHistorySeed.js"
import { getPanicScoreV2 } from "./tradingScores.js"
import {
  DATA_STATE,
  classifyMetricState,
  classifyPanicScoreState,
  hasConfirmedCollection,
  isPlaceholderUpdatedAt,
  latestCollectedHistoryRow,
  resolveLivePanicData,
} from "./panicDataFreshness.js"

function atNy(dateKey, hour, minute) {
  return new Date(americaNyWallTimeToUtcMs(dateKey, hour, minute, 0))
}

const seed = PANIC_HISTORY_SEED.find((row) => row.date === "2026-05-19")

describe("panic data freshness", () => {
  it("marks the stored seed row as SEED and BBB as MISSING", () => {
    const NOW = atNy("2026-11-13", 10, 0)
    const data = {
      ...seed,
      updatedAt: "2026-05-19T12:00:00.000Z",
    }
    expect(isPlaceholderUpdatedAt(data)).toBe(true)
    expect(hasConfirmedCollection(data)).toBe(false)
    expect(classifyPanicScoreState(data, NOW)).toBe(DATA_STATE.SEED)
    for (const id of ["vix", "cnn", "bofa", "putCall", "highYield"]) {
      expect(classifyMetricState(data, id, NOW)).toBe(DATA_STATE.SEED)
    }
    expect(classifyMetricState(data, "bbb", NOW)).toBe(DATA_STATE.MISSING)
  })

  it("does not treat a different value on the seed date as seed", () => {
    const NOW = atNy("2026-11-13", 10, 0)
    const data = {
      ...seed,
      vix: 30,
      __fetchSource: "HUB",
      updatedAt: "2026-05-19T20:15:00.000Z",
    }
    expect(classifyMetricState(data, "vix", NOW)).toBe(DATA_STATE.DELAYED)
    expect(classifyMetricState(data, "cnn", NOW)).toBe(DATA_STATE.SEED)
    expect(classifyPanicScoreState(data, NOW)).toBe(DATA_STATE.SEED)
  })

  it("marks Friday data LIVE on Saturday", () => {
    const NOW = atNy("2026-11-21", 12, 0)
    const data = {
      date: "2026-11-20",
      vix: 18.2,
      fearGreed: 40,
      putCall: 0.95,
      bofa: 5.1,
      highYield: 3.4,
      __fetchSource: "HUB",
      updatedAt: "2026-11-20T21:05:00.000Z",
    }
    expect(classifyMetricState(data, "vix", NOW)).toBe(DATA_STATE.LIVE)
    expect(classifyMetricState(data, "cnn", NOW)).toBe(DATA_STATE.LIVE)
    expect(classifyMetricState(data, "putCall", NOW)).toBe(DATA_STATE.LIVE)
    expect(classifyMetricState(data, "bofa", NOW)).toBe(DATA_STATE.LIVE)
    expect(classifyMetricState(data, "highYield", NOW)).toBe(DATA_STATE.LIVE)
    expect(classifyMetricState(data, "bbb", NOW)).toBe(DATA_STATE.MISSING)
    expect(classifyPanicScoreState(data, NOW)).toBe(DATA_STATE.LIVE)
  })

  it("marks Monday session with Friday data as WAITING", () => {
    const NOW = atNy("2026-11-23", 11, 0)
    const data = {
      date: "2026-11-20",
      vix: 19,
      fearGreed: 44,
      putCall: 0.98,
      bofa: 5.4,
      highYield: 3.6,
      __fetchSource: "HUB",
      updatedAt: "2026-11-20T21:30:00.000Z",
    }
    expect(classifyMetricState(data, "vix", NOW)).toBe(DATA_STATE.WAITING)
    expect(classifyPanicScoreState(data, NOW)).toBe(DATA_STATE.WAITING)
  })

  it("marks Monday after grace with Friday data as DELAYED", () => {
    const NOW = atNy("2026-11-23", 22, 30)
    const data = {
      date: "2026-11-20",
      vix: 19,
      fearGreed: 44,
      putCall: 0.98,
      bofa: 5.4,
      highYield: 3.6,
      __fetchSource: "HUB",
      updatedAt: "2026-11-20T21:30:00.000Z",
    }
    expect(classifyMetricState(data, "vix", NOW)).toBe(DATA_STATE.DELAYED)
    expect(classifyPanicScoreState(data, NOW)).toBe(DATA_STATE.DELAYED)
  })

  it("uses a longer window for manual BofA than for daily quotes", () => {
    const NOW = atNy("2026-11-13", 10, 0)
    const data = {
      date: "2026-11-01",
      vix: 19,
      fearGreed: 44,
      putCall: 0.98,
      bofa: 5.4,
      highYield: 3.6,
      __fetchSource: "HUB",
      updatedAt: "2026-11-01T21:30:00.000Z",
    }
    expect(classifyMetricState(data, "vix", NOW)).toBe(DATA_STATE.DELAYED)
    expect(classifyMetricState(data, "bofa", NOW)).toBe(DATA_STATE.LIVE)
    expect(classifyPanicScoreState(data, NOW)).toBe(DATA_STATE.DELAYED)
  })

  it("does not call a placeholder clock a confirmed collection", () => {
    const NOW = atNy("2026-11-13", 10, 0)
    const data = {
      date: "2026-11-12",
      vix: 18,
      fearGreed: 41,
      putCall: 0.96,
      updatedAt: "2026-11-12T12:00:00.000Z",
    }
    expect(hasConfirmedCollection(data)).toBe(false)
    expect(classifyMetricState(data, "vix", NOW)).toBe(DATA_STATE.UNKNOWN)
    expect(classifyPanicScoreState(data, NOW)).toBe(DATA_STATE.UNKNOWN)
  })
})

describe("latest snapshot selection", () => {
  const real = {
    date: "2026-11-20",
    vix: 18.4,
    fearGreed: 41,
    putCall: 0.82,
    highYield: 3.1,
    bofa: 4.2,
    __fetchSource: "HUB",
    updatedAt: "2026-11-20T21:00:00.000Z",
  }

  it("does not use the seed row when static history has no collected snapshot", () => {
    expect(latestCollectedHistoryRow(PANIC_HISTORY_SEED)).toBeNull()
    expect(resolveLivePanicData(seed, null, null)).toBeNull()
    expect(PANIC_HISTORY_SEED).toHaveLength(5)
    expect(PANIC_HISTORY_SEED.at(-1)?.date).toBe("2026-05-19")
    expect(PANIC_HISTORY_SEED.at(-1)?.vix).toBe(17.82)
  })

  it("keeps the collected snapshot date and does not label it SEED on weekend", () => {
    const NOW = atNy("2026-11-21", 12, 0)
    const selected = resolveLivePanicData(null, real, null)
    expect(selected?.date).toBe("2026-11-20")
    expect(selected?.vix).toBe(18.4)
    expect(selected?.fearGreed).toBe(41)
    expect(selected?.putCall).toBe(0.82)
    expect(selected?.updatedAt).toBe("2026-11-20T21:00:00.000Z")
    expect(classifyPanicScoreState(selected, NOW)).toBe(DATA_STATE.LIVE)
    expect(classifyPanicScoreState(selected, NOW)).not.toBe(DATA_STATE.SEED)
    expect(getPanicScoreV2(selected)).toBe(getPanicScoreV2(real))
  })

  it("prefers a collected row over a later seed row and keeps the seed rows", () => {
    const older = {
      date: "2026-04-02",
      vix: 22,
      fearGreed: 40,
      putCall: 0.9,
      highYield: 3.4,
      bofa: null,
    }
    const rows = [older, ...PANIC_HISTORY_SEED]
    expect(latestCollectedHistoryRow(rows)?.date).toBe("2026-04-02")
    expect(rows).toHaveLength(PANIC_HISTORY_SEED.length + 1)
    const selected = resolveLivePanicData(seed, older, null)
    expect(selected?.date).toBe("2026-04-02")
    expect(selected?.vix).toBe(22)
    expect(selected?.bofa).toBeNull()
    expect(classifyMetricState(selected, "bofa", atNy("2026-11-13", 10, 0))).toBe(DATA_STATE.MISSING)
    expect(classifyMetricState(selected, "bbb", atNy("2026-11-13", 10, 0))).toBe(DATA_STATE.MISSING)
  })

  it("drops seed values carried onto a collected date and does not invent BBB", () => {
    const mixed = { ...seed, vix: 30, bbb: null, bbbSpread: null }
    const selected = resolveLivePanicData(mixed, null, null)
    expect(selected?.date).toBe("2026-05-19")
    expect(selected?.vix).toBe(30)
    expect(selected?.fearGreed).toBeNull()
    expect(selected?.putCall).toBeNull()
    expect(selected?.bofa).toBeNull()
    expect(selected?.highYield).toBeNull()
    expect(selected?.bbb ?? null).toBeNull()
    expect(classifyPanicScoreState(selected, atNy("2026-11-13", 10, 0))).toBe(DATA_STATE.MISSING)
  })
})
