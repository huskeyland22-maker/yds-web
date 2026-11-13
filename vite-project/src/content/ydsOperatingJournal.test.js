import { beforeEach, describe, expect, it } from "vitest"
import { addEquitySell, previewEquitySell } from "./ydsEquitySellLedger.js"
import { buildOperatingJournal, filterJournalRows } from "./ydsOperatingJournal.js"
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

function buy(symbol, shares, price, date) {
  upsertTradeRecord({
    system: "dbb",
    symbol,
    buyDate: date,
    buyPrice: price,
    buyAmountUsd: Math.round(price * shares * 100) / 100,
    shares,
    weightPct: 50,
    buyType: "strategy",
    buyStage: 1,
    memo: "",
  })
}

describe("realized operating journal", () => {
  it("hides a symbol that has only a buy", () => {
    buy("AAPL", 3, 100, "2024-01-02")
    const report = buildOperatingJournal(readTradeRecordsStore())
    expect(report.rows).toEqual([])
    expect(report.sellCount).toBe(0)
    expect(report.realizedPnl).toBe(0)
    expect(report.cumulativeReturnPct).toBe(null)
    expect(listTradeRecords("dbb", "AAPL")).toHaveLength(1)
  })

  it("records only the sold quantity for a partial close", () => {
    buy("NEE", 10, 60, "2024-03-01")
    const saved = addEquitySell("dbb", "NEE", {
      sellDate: "2024-06-01",
      sellPrice: 70,
      shares: 4,
      feeUsd: "",
      taxUsd: "",
    })
    expect(saved.ok).toBe(true)
    expect(addEquitySell("dbb", "NEE", { sellDate: "2024-06-01", sellPrice: 70, shares: 4 }).ok).toBe(false)
    const report = buildOperatingJournal(readTradeRecordsStore())
    expect(report.rows).toHaveLength(1)
    expect(report.rows[0].shares).toBe(4)
    expect(report.rows[0].cost).toBe(240)
    expect(report.rows[0].proceeds).toBe(280)
    expect(report.rows[0].realizedPnl).toBe(40)
    expect(report.rows[0].returnPct).toBeCloseTo((40 / 240) * 100, 5)
    expect(report.rows[0].buyDateLabel).toBe("2024-03-01")
    expect(report.sellTargets[0].openShares).toBe(6)
    expect(listTradeRecords("dbb", "NEE")).toHaveLength(1)
  })

  it("shows the NEE full close as one realized row", () => {
    buy("NEE", 16, 76.11, "2025-04-15")
    buy("AAPL", 2, 180, "2025-05-01")
    const saved = addEquitySell("dbb", "NEE", {
      sellDate: "2026-11-10",
      sellPrice: 86.13,
      shares: 16,
      feeUsd: "",
      taxUsd: "",
      memo: "전량",
    })
    expect(saved.ok).toBe(true)
    const before = listTradeRecords("dbb", "NEE")
    const report = buildOperatingJournal(readTradeRecordsStore())
    expect(report.rows.map((row) => row.symbol)).toEqual(["NEE"])
    const row = report.rows[0]
    expect(row.date).toBe("2026-11-10")
    expect(row.cost).toBeCloseTo(1217.76, 2)
    expect(row.proceeds).toBeCloseTo(1378.08, 2)
    expect(row.realizedPnl).toBeCloseTo(160.32, 2)
    expect(Math.round(row.returnPct * 10) / 10).toBe(13.2)
    expect(row.feeUsd).toBe(null)
    expect(row.taxUsd).toBe(null)
    expect(report.realizedPnl).toBeCloseTo(160.32, 2)
    expect(report.sellCount).toBe(1)
    expect(report.winCount).toBe(1)
    expect(report.lossCount).toBe(0)
    expect(listTradeRecords("dbb", "NEE")).toEqual(before)
    expect(previewEquitySell("dbb", "NEE", { sellDate: "2026-11-11", sellPrice: 86, shares: 1 }).ok).toBe(false)
    expect(filterJournalRows(report.rows, { year: "2026", query: "nee" })).toHaveLength(1)
    expect(filterJournalRows(report.rows, { month: "2026-10" })).toHaveLength(0)
  })

  it("lists a stored sell once when the same id is repeated", () => {
    const store = {
      records: {
        "dbb:NEE": [
          {
            id: "tr_nee",
            system: "dbb",
            symbol: "NEE",
            buyDate: "2025-04-15",
            buyPrice: 76.11,
            buyAmountUsd: 1217.76,
            shares: 16,
          },
        ],
      },
      sells: [
        {
          id: "ts_nee",
          system: "dbb",
          symbol: "NEE",
          sellDate: "2026-11-10",
          sellPrice: 86.13,
          shares: 16,
          feeUsd: null,
          taxUsd: null,
          memo: "",
          createdAt: "2026-11-10T00:00:00.000Z",
        },
        {
          id: "ts_nee",
          system: "dbb",
          symbol: "NEE",
          sellDate: "2026-11-10",
          sellPrice: 86.13,
          shares: 16,
          feeUsd: null,
          taxUsd: null,
          memo: "",
          createdAt: "2026-11-10T00:00:00.000Z",
        },
      ],
    }
    expect(buildOperatingJournal(store).rows).toHaveLength(1)
  })
})
