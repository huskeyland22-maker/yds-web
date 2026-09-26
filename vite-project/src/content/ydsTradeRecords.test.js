import { beforeEach, describe, expect, it } from "vitest"
import {
  TRADE_RECORDS_STORAGE_KEY,
  averageTradeBuyPrice,
  daysBetweenDayKeys,
  deleteTradeRecord,
  formatReturnPct,
  formatShares,
  formatTradeRecordShares,
  formatUsdAmount,
  formatUsdPrice,
  listTradeRecords,
  readTradeRecordsStore,
  sumTradeWeightPct,
  tradeRecordBucketKey,
  tradeReturnPct,
  upsertTradeRecord,
} from "./ydsTradeRecords.js"
import {
  buildDbbTradeStatusView,
  buildPanicTradeStatusView,
} from "./ydsTradeRecordsStatus.js"

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

describe("ydsTradeRecords storage", () => {
  it("uses dedicated key separate from episodes", () => {
    expect(TRADE_RECORDS_STORAGE_KEY).toBe("yds.tradeRecords.v1")
    expect(TRADE_RECORDS_STORAGE_KEY).not.toContain("episodes")
  })

  it("preserves USD decimals and shares on save/restore", () => {
    upsertTradeRecord({
      system: "dbb",
      symbol: "ITA",
      buyDate: "2026-09-22",
      buyPrice: 216.17,
      buyAmountUsd: 1080,
      shares: 5,
      weightPct: 50,
      memo: "1차",
    })
    const ita = listTradeRecords("dbb", "ITA")
    expect(ita).toHaveLength(1)
    expect(ita[0].buyPrice).toBe(216.17)
    expect(ita[0].buyAmountUsd).toBe(1080)
    expect(ita[0].shares).toBe(5)

    const raw = localStorage.getItem(TRADE_RECORDS_STORAGE_KEY)
    installLocalStorageMock()
    localStorage.setItem(TRADE_RECORDS_STORAGE_KEY, raw)
    const restored = listTradeRecords("dbb", "ITA")[0]
    expect(restored.buyPrice).toBe(216.17)
    expect(restored.shares).toBe(5)
    expect(formatUsdPrice(restored.buyPrice)).toBe("$216.17")
    expect(formatUsdAmount(restored.buyAmountUsd)).toBe("$1,080.00")
    expect(formatShares(restored.shares)).toBe("5주")
  })

  it("reads legacy buyAmountKrw as USD without FX conversion", () => {
    localStorage.setItem(
      TRADE_RECORDS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        records: {
          "dbb:SMH": [
            {
              id: "legacy1",
              system: "dbb",
              symbol: "SMH",
              buyDate: "2026-09-01",
              buyPrice: 200.5,
              buyAmountKrw: 1000,
              weightPct: 50,
              memo: "",
              createdAt: "2026-09-01",
              updatedAt: "2026-09-01",
            },
          ],
        },
      }),
    )
    const rec = listTradeRecords("dbb", "SMH")[0]
    expect(rec.buyAmountUsd).toBe(1000)
    expect(rec.shares).toBeNull()
    expect(formatShares(rec.shares)).toBe("—")
  })

  it("keeps ETF buckets separate and supports edit/delete", () => {
    const a = upsertTradeRecord({
      system: "dbb",
      symbol: "QQQ",
      buyDate: "2026-09-01",
      buyPrice: 400.12,
      buyAmountUsd: 800.24,
      shares: 2,
      weightPct: 50,
    })
    upsertTradeRecord({
      system: "dbb",
      symbol: "ITA",
      buyDate: "2026-09-02",
      buyPrice: 100,
      buyAmountUsd: 100,
      shares: 1,
      weightPct: 50,
    })
    expect(listTradeRecords("dbb", "QQQ")).toHaveLength(1)
    expect(listTradeRecords("dbb", "ITA")).toHaveLength(1)
    upsertTradeRecord({
      id: a.id,
      system: "dbb",
      symbol: "QQQ",
      buyDate: "2026-09-01",
      buyPrice: 401.55,
      buyAmountUsd: 803.1,
      shares: 2,
      weightPct: 50,
    })
    expect(listTradeRecords("dbb", "QQQ")[0].buyPrice).toBe(401.55)
    deleteTradeRecord("dbb", "QQQ", a.id)
    expect(listTradeRecords("dbb", "QQQ")).toHaveLength(0)
    expect(tradeRecordBucketKey("dbb", "ita")).toBe("dbb:ITA")
  })

  it("keeps panic bucket separate from dbb", () => {
    upsertTradeRecord({
      system: "panic",
      symbol: "SPY",
      buyDate: "2026-09-21",
      buyPrice: 500.25,
      buyAmountUsd: 500.25,
      shares: 1,
      weightPct: 40,
    })
    upsertTradeRecord({
      system: "dbb",
      symbol: "SPY",
      buyDate: "2026-09-21",
      buyPrice: 50.1,
      buyAmountUsd: 50.1,
      shares: 1,
      weightPct: 50,
    })
    expect(Object.keys(readTradeRecordsStore().records).sort()).toEqual([
      "dbb:SPY",
      "panic:SPY",
    ])
  })
})

describe("USD format + return helpers", () => {
  it("formats price/amount/shares/return", () => {
    expect(formatUsdPrice(216.17)).toBe("$216.17")
    expect(formatUsdAmount(1080)).toBe("$1,080.00")
    expect(formatShares(5)).toBe("5주")
    expect(formatShares(null)).toBe("—")
    expect(formatReturnPct(10)).toBe("+10.00%")
    expect(formatReturnPct(-0.98)).toBe("-0.98%")
    expect(formatReturnPct(0)).toBe("0.00%")
  })

  it("saved list line includes shares when present", () => {
    const line = [
      "2026-09-22",
      formatUsdPrice(216),
      formatTradeRecordShares({ shares: 5, buyPrice: 216, buyAmountUsd: 1080 }),
      formatUsdAmount(1080),
      "50%",
    ].join(" | ")
    expect(line).toBe("2026-09-22 | $216.00 | 5주 | $1,080.00 | 50%")
  })

  it("display fallback: missing shares uses amount/price", () => {
    expect(
      formatTradeRecordShares({
        shares: null,
        buyPrice: 216,
        buyAmountUsd: 1080,
      }),
    ).toBe("5주")
    expect(
      formatTradeRecordShares({
        shares: null,
        buyPrice: 216.17,
        buyAmountUsd: 1080.85,
      }),
    ).toMatch(/주$/)
    expect(
      formatTradeRecordShares({
        shares: null,
        buyPrice: 0,
        buyAmountUsd: 1080,
      }),
    ).toBe("—")
    expect(formatTradeRecordShares({ shares: null, buyPrice: 216, buyAmountUsd: null })).toBe(
      "—",
    )
    // stored shares wins over amount/price
    expect(
      formatTradeRecordShares({
        shares: 2,
        buyPrice: 216,
        buyAmountUsd: 1080,
      }),
    ).toBe("2주")
  })

  it("ITA case: buy 216.17 vs close 214.05 → about -0.98%", () => {
    const pct = tradeReturnPct(216.17, 214.05)
    expect(pct).toBeLessThan(0)
    expect(pct).toBeCloseTo(-0.9807, 2)
    expect(formatReturnPct(pct)).toBe("-0.98%")
  })

  it("sign cases for return", () => {
    expect(tradeReturnPct(100, 110)).toBeCloseTo(10, 5)
    expect(tradeReturnPct(100, 90)).toBeCloseTo(-10, 5)
    expect(tradeReturnPct(100, 100)).toBe(0)
  })
})

describe("trade status views", () => {
  it("DBB uses card.close as current price with asOfDate", () => {
    const view = buildDbbTradeStatusView(
      {
        count: 2,
        stage: { label: "관심" },
        close: 214.05,
        asOfDate: "2026-09-22",
      },
      [
        {
          id: "1",
          system: "dbb",
          symbol: "ITA",
          buyDate: "2026-09-22",
          buyPrice: 216.17,
          buyAmountUsd: 1080,
          shares: 5,
          weightPct: 50,
          memo: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
    )
    expect(view.currentPrice).toBe(214.05)
    expect(view.priceAsOfDate).toBe("2026-09-22")
    expect(view.avgBuyPrice).toBe(216.17)
    expect(view.returnPct).toBeCloseTo(-0.9807, 2)
    expect(view.nextStep).toBe("아직 매수 단계 아님")
  })

  it("DBB 4/4 shows add-review next step", () => {
    const view = buildDbbTradeStatusView(
      { count: 4, stage: { label: "강한 저점" }, close: 110, asOfDate: "2026-09-21" },
      [
        {
          id: "1",
          system: "dbb",
          symbol: "ITA",
          buyDate: "2026-09-10",
          buyPrice: 100,
          buyAmountUsd: 200,
          shares: 2,
          weightPct: 50,
          memo: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
    )
    expect(view.nextStep).toBe("추가 50% 매수 검토")
    expect(sumTradeWeightPct([{ weightPct: 50 }, { weightPct: 50 }])).toBe(100)
    expect(averageTradeBuyPrice([{ buyPrice: 100, shares: 2, buyAmountUsd: 200 }])).toBe(100)
    expect(daysBetweenDayKeys("2026-09-01", "2026-09-21")).toBe(20)
  })

  it("panic status uses existing 40/27/33 bands", () => {
    const view = buildPanicTradeStatusView(
      55,
      [
        {
          id: "1",
          system: "panic",
          symbol: "SPY",
          buyDate: "2026-09-01",
          buyPrice: 500,
          buyAmountUsd: 400,
          shares: null,
          weightPct: 40,
          memo: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
      { currentPrice: 520, asOfDate: "2026-09-21" },
    )
    expect(view.stageLabel).toContain("1차")
    expect(view.nextStep).toContain("2차")
  })
})
