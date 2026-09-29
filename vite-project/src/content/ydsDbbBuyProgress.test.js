import { beforeEach, describe, expect, it } from "vitest"
import {
  equityBuyProgressMark,
  formatEquityBuyProgressLine,
} from "../components/trade-records/DbbBuyProgressSection.jsx"
import { listTradeRecords, upsertTradeRecord } from "./ydsTradeRecords.js"
import {
  collectDbbBuyProgress,
  equityViewProgressEntry,
  etfCardProgressEntry,
} from "./ydsDbbBuyProgress.js"

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

function save(symbol, price, amount, weight) {
  return upsertTradeRecord({
    system: "dbb",
    symbol,
    buyDate: "2026-09-20",
    buyPrice: price,
    buyAmountUsd: amount,
    weightPct: weight,
  })
}

describe("collectDbbBuyProgress", () => {
  it("lists only symbols that have a buy record", () => {
    save("QQQ", 216.17, 1080.5, 50)
    const items = collectDbbBuyProgress([
      etfCardProgressEntry({
        ok: true,
        symbol: "QQQ",
        themeShort: "나스닥",
        count: 3,
        stage: { label: "1차 매수" },
        close: 220.4,
        asOfDate: "2026-09-26",
      }),
      etfCardProgressEntry({
        ok: true,
        symbol: "SMH",
        themeShort: "반도체",
        count: 4,
        stage: { label: "강한 저점" },
        close: 300,
        asOfDate: "2026-09-26",
      }),
    ])
    expect(items.map((item) => item.symbol)).toEqual(["QQQ"])
    expect(items[0].name).toBe("나스닥")
    expect(items[0].statusView.signalLabel).toBe("3/4")
    expect(items[0].statusView.stageLabel).toBe("1차 매수")
    expect(items[0].statusView.recordedWeightPct).toBe(50)
    expect(items[0].statusView.avgBuyPrice).toBe(216.17)
    expect(items[0].statusView.currentPrice).toBe(220.4)
    expect(items[0].statusView.nextStep).toBe("4/4 추가 매수 후보 대기")
  })

  it("averages price by amount and sums weight across records", () => {
    save("MSFT", 100, 200, 50)
    upsertTradeRecord({
      system: "dbb",
      symbol: "MSFT",
      buyDate: "2026-09-22",
      buyPrice: 120,
      buyAmountUsd: 100,
      weightPct: 25,
    })
    const entry = equityViewProgressEntry(
      { symbol: "MSFT", name: "마이크로소프트" },
      {
        ok: true,
        symbol: "MSFT",
        score: 4,
        price: 110,
        asOf: "2026-09-26",
        state: { label: "STRONG LOW CANDIDATE" },
      },
    )
    const [item] = collectDbbBuyProgress([entry])
    expect(item.name).toBe("마이크로소프트")
    expect(item.statusView.signalLabel).toBe("4/4")
    expect(item.statusView.stageLabel).toBe("STRONG LOW CANDIDATE")
    expect(item.recordedWeightPct).toBe(75)
    expect(item.avgBuyPrice).toBeCloseTo((100 * 200 + 120 * 100) / 300, 5)
    expect(item.statusView.currentPrice).toBe(110)
    expect(item.statusView.returnPct).toBeCloseTo(((110 - item.avgBuyPrice) / item.avgBuyPrice) * 100, 5)
    expect(item.statusView.nextStep).toBe("추가 50% 매수 검토")
  })

  it("keeps a recorded symbol without a live score and drops symbols with no records", () => {
    save("NVDA", 180, 900, 50)
    const items = collectDbbBuyProgress([
      equityViewProgressEntry({ symbol: "NVDA", name: "엔비디아" }, { ok: false, symbol: "NVDA" }),
      equityViewProgressEntry({ symbol: "AAPL", name: "애플" }, { ok: true, symbol: "AAPL", score: 2 }),
    ])
    expect(items).toHaveLength(1)
    expect(items[0].symbol).toBe("NVDA")
    expect(items[0].statusView).toBeNull()
    expect(items[0].recordedWeightPct).toBe(50)
    expect(items[0].avgBuyPrice).toBe(180)
  })
})

describe("equity buy progress lines", () => {
  it("labels stored strategy and discretionary buys, and reads missing fields as strategy stage 1", () => {
    expect(equityBuyProgressMark(0)).toBe("①")
    expect(equityBuyProgressMark(2)).toBe("③")
    expect(
      formatEquityBuyProgressLine({
        buyDate: "2026-10-01",
        buyPrice: 216,
        shares: 5,
        buyType: "strategy",
        buyStage: 1,
      }),
    ).toBe("2026-10-01 · 전략 1차 · 5주 · $216.00")
    expect(
      formatEquityBuyProgressLine({
        buyDate: "2026-10-05",
        buyPrice: 76,
        shares: 3,
        buyType: "discretionary",
        buyStage: null,
      }),
    ).toBe("2026-10-05 · 직관 매수 · 3주 · $76.00")
    expect(
      formatEquityBuyProgressLine({
        buyDate: "2026-10-13",
        buyPrice: 70,
        shares: 5,
        buyType: "strategy",
        buyStage: 2,
      }),
    ).toBe("2026-10-13 · 전략 2차 · 5주 · $70.00")
    expect(
      formatEquityBuyProgressLine({
        buyDate: "2026-09-01",
        buyPrice: 100,
        shares: 2,
      }),
    ).toBe("2026-09-01 · 전략 1차 · 2주 · $100.00")
  })

  it("keeps mixed buys in stored buy-date order", () => {
    upsertTradeRecord({
      system: "dbb",
      symbol: "NEE",
      buyDate: "2026-10-13",
      buyPrice: 70,
      buyAmountUsd: 350,
      shares: 5,
      weightPct: 50,
      buyType: "strategy",
      buyStage: 2,
    })
    upsertTradeRecord({
      system: "dbb",
      symbol: "NEE",
      buyDate: "2026-10-01",
      buyPrice: 216,
      buyAmountUsd: 1080,
      shares: 5,
      weightPct: 50,
      buyType: "strategy",
      buyStage: 1,
    })
    upsertTradeRecord({
      system: "dbb",
      symbol: "NEE",
      buyDate: "2026-10-05",
      buyPrice: 76,
      buyAmountUsd: 228,
      shares: 3,
      weightPct: 30,
      buyType: "discretionary",
      buyStage: null,
    })
    const lines = listTradeRecords("dbb", "NEE").map((record, index) =>
      `${equityBuyProgressMark(index)} ${formatEquityBuyProgressLine(record)}`,
    )
    expect(lines).toEqual([
      "① 2026-10-01 · 전략 1차 · 5주 · $216.00",
      "② 2026-10-05 · 직관 매수 · 3주 · $76.00",
      "③ 2026-10-13 · 전략 2차 · 5주 · $70.00",
    ])
  })
})
