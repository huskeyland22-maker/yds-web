import { beforeEach, describe, expect, it } from "vitest"
import { listTradeRecords, upsertTradeRecord } from "../../content/ydsTradeRecords.js"
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
 * @param {boolean} integerUsdInputs
 * @param {string} priceText
 * @param {string} amountText
 */
function saveUsd(integerUsdInputs, priceText, amountText, symbol) {
  const priceInput = coerceUsdInputText(priceText, integerUsdInputs)
  const amountInput = coerceUsdInputText(amountText, integerUsdInputs)
  return upsertTradeRecord({
    system: "dbb",
    symbol,
    buyDate: "2026-09-29",
    buyPrice: coerceUsdSaveNumber(priceInput, integerUsdInputs),
    buyAmountUsd: coerceUsdSaveNumber(amountInput, integerUsdInputs),
    weightPct: 50,
  })
}

describe("equity integer USD inputs", () => {
  it("100.25 / 506.25 → 100 / 506", () => {
    expect(coerceUsdInputText("100.25", true)).toBe("100")
    expect(coerceUsdInputText("506.25", true)).toBe("506")
    saveUsd(true, "100.25", "506.25", "MSFT")
    const row = listTradeRecords("dbb", "MSFT")[0]
    expect(row.buyPrice).toBe(100)
    expect(row.buyAmountUsd).toBe(506)
    expect(Number.isInteger(row.buyPrice)).toBe(true)
    expect(Number.isInteger(row.buyAmountUsd)).toBe(true)
  })

  it("516.17 / 1200.99 → 516 / 1200", () => {
    expect(coerceUsdInputText("516.17", true)).toBe("516")
    expect(coerceUsdInputText("1200.99", true)).toBe("1200")
    saveUsd(true, "516.17", "1200.99", "NVDA")
    const row = listTradeRecords("dbb", "NVDA")[0]
    expect(row.buyPrice).toBe(516)
    expect(row.buyAmountUsd).toBe(1200)
  })
})

describe("ETF decimal USD inputs stay unchanged", () => {
  it("keeps 216.17 / 1080.5 in the input and in storage", () => {
    expect(coerceUsdInputText("216.17", false)).toBe("216.17")
    expect(coerceUsdInputText("1080.5", false)).toBe("1080.5")
    expect(coerceUsdSaveNumber("216.17", false)).toBe(216.17)
    expect(coerceUsdSaveNumber("1080.5", false)).toBe(1080.5)
    saveUsd(false, "216.17", "1080.5", "QQQ")
    const row = listTradeRecords("dbb", "QQQ")[0]
    expect(row.buyPrice).toBe(216.17)
    expect(row.buyAmountUsd).toBe(1080.5)
    expect(row.buyType).toBeUndefined()
    expect(row.buyStage).toBeUndefined()
  })
})
