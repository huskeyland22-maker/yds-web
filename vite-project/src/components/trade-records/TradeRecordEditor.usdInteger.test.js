import { beforeEach, describe, expect, it } from "vitest"
import {
  formatUsdAmount,
  formatUsdPrice,
  listTradeRecords,
  readTradeRecordsStore,
  TRADE_RECORDS_STORAGE_KEY,
  upsertTradeRecord,
  writeTradeRecordsStore,
} from "../../content/ydsTradeRecords.js"
import { reconcileTradeRecords } from "../../content/ydsTradeRecordsCloudSync.js"
import { coerceUsdInputText, coerceUsdSaveNumber } from "./TradeRecordEditor.jsx"

/** @type {Map<string, string>} */
let store

function installLocalStorageMock() {
  store = new Map()
  globalThis.localStorage = {
    getItem(k) {
      return store.has(k) ? store.get(k) : null
    },
    setItem(k, v) {
      store.set(k, String(v))
    },
    removeItem(k) {
      store.delete(k)
    },
    clear() {
      store.clear()
    },
  }
}

beforeEach(() => {
  installLocalStorageMock()
})

/**
 * Same numbers TradeRecordEditor passes into upsertTradeRecord.
 * @param {string} priceText
 * @param {string} amountText
 * @param {string} symbol
 * @param {Record<string, unknown>} [extra]
 */
function saveUsd(priceText, amountText, symbol, extra = {}) {
  const priceInput = coerceUsdInputText(priceText)
  const amountInput = coerceUsdInputText(amountText)
  return upsertTradeRecord({
    system: "dbb",
    symbol,
    buyDate: "2026-09-29",
    buyPrice: coerceUsdSaveNumber(priceInput),
    buyAmountUsd: coerceUsdSaveNumber(amountInput),
    ...extra,
  })
}

describe("USD inputs round to cents for ETF and equity", () => {
  it("saves an ETF price of 100.25 and amount of 506.25", () => {
    expect(coerceUsdInputText("100.25")).toBe("100.25")
    expect(coerceUsdInputText("506.25")).toBe("506.25")
    const saved = saveUsd("100.25", "506.25", "QQQ", { weightPct: 50 })
    expect(saved.buyPrice).toBe(100.25)
    expect(saved.buyAmountUsd).toBe(506.25)
    expect(saved.buyType).toBeUndefined()
    expect(saved.buyStage).toBeUndefined()
    expect(formatUsdPrice(saved.buyPrice)).toBe("$100.25")
    expect(formatUsdAmount(saved.buyAmountUsd)).toBe("$506.25")
  })

  it("saves an equity price of 100.25 and amount of 506.25", () => {
    const saved = saveUsd("100.25", "506.25", "MSFT", {
      weightPct: 50,
      buyType: "strategy",
      buyStage: 1,
    })
    expect(saved.buyPrice).toBe(100.25)
    expect(saved.buyAmountUsd).toBe(506.25)
    expect(formatUsdPrice(saved.buyPrice)).toBe("$100.25")
    expect(formatUsdAmount(saved.buyAmountUsd)).toBe("$506.25")
  })

  it("rounds a third decimal half-up", () => {
    expect(coerceUsdInputText("100.256")).toBe("100.26")
    expect(coerceUsdInputText("506.254")).toBe("506.25")
    expect(coerceUsdSaveNumber("100.256")).toBe(100.26)
    expect(coerceUsdSaveNumber("506.254")).toBe(506.25)
    const saved = saveUsd("100.256", "506.254", "NVDA", { weightPct: 50 })
    expect(saved.buyPrice).toBe(100.26)
    expect(saved.buyAmountUsd).toBe(506.25)
    expect(formatUsdPrice(saved.buyPrice)).toBe("$100.26")
    expect(formatUsdAmount(saved.buyAmountUsd)).toBe("$506.25")
  })

  it("saves a discretionary buy at cents without a weight", () => {
    const saved = saveUsd("100.256", "506.25", "NEE", {
      shares: 3,
      buyType: "discretionary",
      buyStage: null,
    })
    expect(saved.buyType).toBe("discretionary")
    expect(saved.buyStage).toBeNull()
    expect(saved.weightPct).toBeUndefined()
    expect(saved.buyPrice).toBe(100.26)
    expect(saved.buyAmountUsd).toBe(506.25)
  })

  it("saves a strategy buy at cents and keeps the weight", () => {
    const saved = saveUsd("100.25", "506.254", "NEE", {
      weightPct: 50,
      buyType: "strategy",
      buyStage: 2,
    })
    expect(saved.buyType).toBe("strategy")
    expect(saved.buyStage).toBe(2)
    expect(saved.weightPct).toBe(50)
    expect(saved.buyPrice).toBe(100.25)
    expect(saved.buyAmountUsd).toBe(506.25)
  })

  it("reads existing ETF and equity rows without rewriting them", () => {
    const raw = {
      version: 1,
      records: {
        "dbb:QQQ": [
          {
            id: "tr_qqq",
            system: "dbb",
            symbol: "QQQ",
            buyDate: "2026-09-22",
            buyPrice: 216.17,
            buyAmountUsd: 1080.5,
            shares: 5,
            weightPct: 50,
            memo: "",
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          },
        ],
        "dbb:MSFT": [
          {
            id: "tr_msft",
            system: "dbb",
            symbol: "MSFT",
            buyDate: "2026-09-22",
            buyPrice: 100,
            buyAmountUsd: 506,
            shares: 5,
            weightPct: 50,
            memo: "",
            buyType: "strategy",
            buyStage: 1,
            createdAt: "2026-09-22T00:00:00.000Z",
            updatedAt: "2026-09-22T00:00:00.000Z",
          },
        ],
      },
    }
    localStorage.setItem(TRADE_RECORDS_STORAGE_KEY, JSON.stringify(raw))
    const before = localStorage.getItem(TRADE_RECORDS_STORAGE_KEY)
    const etf = listTradeRecords("dbb", "QQQ")[0]
    const equity = listTradeRecords("dbb", "MSFT")[0]
    expect(etf.buyPrice).toBe(216.17)
    expect(etf.buyAmountUsd).toBe(1080.5)
    expect(etf.buyType).toBeUndefined()
    expect(formatUsdPrice(etf.buyPrice)).toBe("$216.17")
    expect(formatUsdAmount(etf.buyAmountUsd)).toBe("$1,080.50")
    expect(equity.buyPrice).toBe(100)
    expect(equity.buyAmountUsd).toBe(506)
    expect(equity.buyType).toBe("strategy")
    expect(formatUsdPrice(equity.buyPrice)).toBe("$100.00")
    expect(formatUsdAmount(equity.buyAmountUsd)).toBe("$506.00")
    expect(localStorage.getItem(TRADE_RECORDS_STORAGE_KEY)).toBe(before)
    expect(readTradeRecordsStore().records["dbb:QQQ"][0].buyPrice).toBe(216.17)
  })

  it("keeps cent prices through cloud reconcile", () => {
    const local = {
      version: 1,
      records: {
        "dbb:QQQ": [
          {
            id: "tr_qqq",
            system: "dbb",
            symbol: "QQQ",
            buyDate: "2026-09-29",
            buyPrice: 100.25,
            buyAmountUsd: 506.25,
            shares: 5,
            weightPct: 50,
            memo: "",
            createdAt: "2026-09-29T00:00:00.000Z",
            updatedAt: "2026-09-29T00:00:00.000Z",
          },
        ],
        "dbb:NEE": [
          {
            id: "tr_nee",
            system: "dbb",
            symbol: "NEE",
            buyDate: "2026-09-29",
            buyPrice: 100.25,
            buyAmountUsd: 506.25,
            shares: 3,
            memo: "",
            buyType: "discretionary",
            buyStage: null,
            createdAt: "2026-09-29T00:00:00.000Z",
            updatedAt: "2026-09-29T00:00:00.000Z",
          },
        ],
      },
    }
    const merged = reconcileTradeRecords(local, {
      records: { version: 1, records: {} },
      revision: 0,
      updatedAt: null,
      syncMode: "empty",
    })
    writeTradeRecordsStore(merged.store)
    const qqq = listTradeRecords("dbb", "QQQ")[0]
    const nee = listTradeRecords("dbb", "NEE")[0]
    expect(qqq.buyPrice).toBe(100.25)
    expect(qqq.buyAmountUsd).toBe(506.25)
    expect(qqq.weightPct).toBe(50)
    expect(qqq.buyType).toBeUndefined()
    expect(nee.buyPrice).toBe(100.25)
    expect(nee.buyAmountUsd).toBe(506.25)
    expect(nee.buyType).toBe("discretionary")
    expect(nee.weightPct).toBeUndefined()
  })
})
