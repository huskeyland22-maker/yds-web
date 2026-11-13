import { beforeEach, describe, expect, it } from "vitest"
import { collectClosedDbbProgress, collectDbbBuyProgress } from "./ydsDbbBuyProgress.js"
import { addEquitySell, cancelEquitySell, equityPosition, previewEquitySell } from "./ydsEquitySellLedger.js"
import { listTradeRecords, readTradeRecordsStore, upsertTradeRecord } from "./ydsTradeRecords.js"

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
  return upsertTradeRecord({
    system: "dbb",
    symbol: "NEE",
    buyDate: "2024-03-01",
    buyPrice: 60,
    buyAmountUsd: 600,
    shares: 10,
    weightPct: 50,
    memo: "fixture",
  })
}

describe("equity operating sell ledger", () => {
  it("keeps the buy and reduces the remaining shares on a partial sell", () => {
    const bought = buyNee()
    const saved = addEquitySell("dbb", "NEE", {
      sellDate: "2024-06-01",
      sellPrice: 70,
      shares: 4,
      feeUsd: "",
      taxUsd: "",
    })
    expect(saved.ok).toBe(true)
    expect(saved.sell.feeUsd).toBeNull()
    expect(saved.sell.taxUsd).toBeNull()
    const position = equityPosition("dbb", "NEE")
    expect(position.openShares).toBe(6)
    expect(position.settlements[0].realizedPnl).toBe(40)
    expect(position.settlements[0].returnPct).toBeCloseTo((40 / 240) * 100, 5)
    expect(position.settlements[0].chargesKnown).toBe(false)
    expect(position.settlements[0].links[0].buyId).toBe(bought.id)
    expect(listTradeRecords("dbb", "NEE")).toHaveLength(1)
  })

  it("rejects a sell larger than the remaining shares and does not invent a fee", () => {
    buyNee()
    const tooMany = previewEquitySell("dbb", "NEE", {
      sellDate: "2024-06-01",
      sellPrice: 70,
      shares: 11,
    })
    expect(tooMany.ok).toBe(false)
    expect(readTradeRecordsStore().sells).toHaveLength(0)
  })

  it("removes a fully sold symbol from holdings and keeps both records", () => {
    buyNee()
    addEquitySell("dbb", "NEE", { sellDate: "2024-06-01", sellPrice: 70, shares: 4 })
    const full = addEquitySell("dbb", "NEE", { sellDate: "2024-08-01", sellPrice: 50, shares: 6, feeUsd: 1, taxUsd: 2 })
    expect(full.ok).toBe(true)
    const entry = [{ symbol: "NEE", name: "NextEra Energy" }]
    expect(collectDbbBuyProgress(entry)).toHaveLength(0)
    const closed = collectClosedDbbProgress(entry)
    expect(closed).toHaveLength(1)
    expect(closed[0].openShares).toBe(0)
    expect(closed[0].realizedPnlUsd).toBe(40 + (300 - 360 - 3))
    expect(listTradeRecords("dbb", "NEE")).toHaveLength(1)
    expect(readTradeRecordsStore().sells).toHaveLength(2)
  })

  it("restores the holding when a sell is cancelled and does not delete the buy", () => {
    buyNee()
    const saved = addEquitySell("dbb", "NEE", { sellDate: "2024-06-01", sellPrice: 70, shares: 10 })
    expect(collectDbbBuyProgress([{ symbol: "NEE", name: "NextEra Energy" }])).toHaveLength(0)
    expect(cancelEquitySell(saved.sell.id)).toBe(true)
    expect(equityPosition("dbb", "NEE").openShares).toBe(10)
    expect(listTradeRecords("dbb", "NEE")).toHaveLength(1)
    expect(readTradeRecordsStore().deletedSellIds).toContain(saved.sell.id)
  })
})
