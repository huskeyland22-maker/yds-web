import { beforeEach, describe, expect, it } from "vitest"
import { addEquitySell, previewEquitySell } from "./ydsEquitySellLedger.js"
import { buildOperatingJournal, filterJournalRows } from "./ydsOperatingJournal.js"
import { readTradeRecordsStore, upsertTradeRecord } from "./ydsTradeRecords.js"

/** @type {Map<string, string>} */
let memory

function installLocalStorageMock() {
  memory = new Map()
  globalThis.localStorage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null
    },
    setItem(key, value) {
      memory.set(key, String(value))
    },
    removeItem(key) {
      memory.delete(key)
    },
    clear() {
      memory.clear()
    },
  }
}

beforeEach(() => {
  installLocalStorageMock()
})

function buyNee() {
  upsertTradeRecord({
    system: "dbb",
    symbol: "NEE",
    buyDate: "2024-03-01",
    buyPrice: 60,
    buyAmountUsd: 600,
    shares: 10,
    weightPct: 50,
    buyType: "strategy",
    buyStage: 1,
    memo: "",
  })
}

describe("operating journal", () => {
  it("keeps a buy with no invented sell", () => {
    buyNee()
    const report = buildOperatingJournal(readTradeRecordsStore(), { NEE: 85.29 })
    expect(report.sellCount).toBe(0)
    expect(report.holdingCount).toBe(1)
    expect(report.holdings[0].openShares).toBe(10)
    expect(report.realizedPnl).toBe(0)
    expect(report.unrealizedPnl).toBeCloseTo(252.9, 5)
    expect(report.nee).toHaveLength(1)
    expect(report.nee[0].sellCount).toBe(0)
    expect(readTradeRecordsStore().sells).toEqual([])
  })

  it("separates partial and full sells from unrealized", () => {
    buyNee()
    const partial = addEquitySell("dbb", "NEE", {
      sellDate: "2024-06-01",
      sellPrice: 70,
      shares: 4,
      feeUsd: "",
      taxUsd: "",
    })
    expect(partial.ok).toBe(true)
    const again = addEquitySell("dbb", "NEE", {
      sellDate: "2024-06-01",
      sellPrice: 70,
      shares: 4,
      feeUsd: "",
      taxUsd: "",
    })
    expect(again.ok).toBe(false)
    const open = buildOperatingJournal(readTradeRecordsStore(), { NEE: 80 })
    expect(open.holdingCount).toBe(1)
    expect(open.holdings[0].openShares).toBe(6)
    expect(open.realizedPnl).toBe(40)
    expect(open.unrealizedPnl).toBeCloseTo(120, 5)
    expect(open.sellCount).toBe(1)
    expect(open.winRatePct).toBe(100)
    expect(open.cumulativeReturnPct).toBeCloseTo((40 / 240) * 100, 5)

    const full = addEquitySell("dbb", "NEE", {
      sellDate: "2024-08-01",
      sellPrice: 50,
      shares: 6,
      feeUsd: 1,
      taxUsd: 2,
    })
    expect(full.ok).toBe(true)
    const closed = buildOperatingJournal(readTradeRecordsStore(), { NEE: 90 })
    expect(closed.holdingCount).toBe(0)
    expect(closed.closed).toHaveLength(1)
    expect(closed.unrealizedPnl).toBe(null)
    expect(closed.realizedPnl).toBeCloseTo(40 + (300 - 360 - 3), 5)
    expect(closed.rows.filter((row) => row.kind === "buy")).toHaveLength(1)
    expect(closed.rows.filter((row) => row.typeLabel === "전량 매도")).toHaveLength(1)
    expect(previewEquitySell("dbb", "NEE", { sellDate: "2024-09-01", sellPrice: 50, shares: 1 }).ok).toBe(false)
  })

  it("filters the same stored rows", () => {
    buyNee()
    addEquitySell("dbb", "NEE", { sellDate: "2024-08-01", sellPrice: 70, shares: 10 })
    const report = buildOperatingJournal(readTradeRecordsStore())
    expect(filterJournalRows(report.rows, { kind: "buy" })).toHaveLength(1)
    expect(filterJournalRows(report.rows, { kind: "sell" })).toHaveLength(1)
    expect(filterJournalRows(report.rows, { kind: "closed" })).toHaveLength(2)
    expect(filterJournalRows(report.rows, { kind: "open" })).toHaveLength(0)
    expect(filterJournalRows(report.rows, { query: "nextera" })).toHaveLength(2)
    expect(filterJournalRows(report.rows, { from: "2024-07-01" })).toHaveLength(1)
  })
})
