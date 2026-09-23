import { beforeEach, describe, expect, it } from "vitest"
import {
  TRADE_RECORDS_STORAGE_KEY,
  averageTradeBuyPrice,
  daysBetweenDayKeys,
  deleteTradeRecord,
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

  it("saves and restores records per ETF without mixing", () => {
    upsertTradeRecord({
      system: "dbb",
      symbol: "ITA",
      buyDate: "2026-09-21",
      buyPrice: 100,
      buyAmountKrw: 200,
      weightPct: 50,
      memo: "1차",
    })
    upsertTradeRecord({
      system: "dbb",
      symbol: "SMH",
      buyDate: "2026-09-20",
      buyPrice: 200,
      buyAmountKrw: 100,
      weightPct: 50,
      memo: "",
    })

    const ita = listTradeRecords("dbb", "ITA")
    const smh = listTradeRecords("dbb", "SMH")
    expect(ita).toHaveLength(1)
    expect(smh).toHaveLength(1)
    expect(ita[0].symbol).toBe("ITA")
    expect(smh[0].symbol).toBe("SMH")
    expect(tradeRecordBucketKey("dbb", "ita")).toBe("dbb:ITA")

    const raw = localStorage.getItem(TRADE_RECORDS_STORAGE_KEY)
    expect(raw).toBeTruthy()
    installLocalStorageMock()
    localStorage.setItem(TRADE_RECORDS_STORAGE_KEY, raw)
    expect(listTradeRecords("dbb", "ITA")[0].memo).toBe("1차")
    expect(listTradeRecords("dbb", "SMH")[0].buyPrice).toBe(200)
  })

  it("allows multiple records on one symbol and edit/delete", () => {
    const a = upsertTradeRecord({
      system: "dbb",
      symbol: "QQQ",
      buyDate: "2026-09-01",
      buyPrice: 400,
      buyAmountKrw: 100,
      weightPct: 50,
    })
    upsertTradeRecord({
      system: "dbb",
      symbol: "QQQ",
      buyDate: "2026-09-10",
      buyPrice: 380,
      buyAmountKrw: 100,
      weightPct: 50,
    })
    expect(listTradeRecords("dbb", "QQQ")).toHaveLength(2)
    upsertTradeRecord({
      id: a.id,
      system: "dbb",
      symbol: "QQQ",
      buyDate: "2026-09-01",
      buyPrice: 410,
      buyAmountKrw: 100,
      weightPct: 50,
      memo: "corrected",
    })
    const list = listTradeRecords("dbb", "QQQ")
    expect(list).toHaveLength(2)
    expect(list.find((r) => r.id === a.id)?.buyPrice).toBe(410)
    deleteTradeRecord("dbb", "QQQ", a.id)
    expect(listTradeRecords("dbb", "QQQ")).toHaveLength(1)
  })

  it("keeps panic bucket separate from dbb", () => {
    upsertTradeRecord({
      system: "panic",
      symbol: "SPY",
      buyDate: "2026-09-21",
      buyPrice: 500,
      buyAmountKrw: 300,
      weightPct: 40,
    })
    upsertTradeRecord({
      system: "dbb",
      symbol: "SPY",
      buyDate: "2026-09-21",
      buyPrice: 50,
      buyAmountKrw: 50,
      weightPct: 50,
    })
    expect(listTradeRecords("panic", "SPY")[0].weightPct).toBe(40)
    expect(listTradeRecords("dbb", "SPY")[0].buyPrice).toBe(50)
    expect(Object.keys(readTradeRecordsStore().records).sort()).toEqual([
      "dbb:SPY",
      "panic:SPY",
    ])
  })
})

describe("ydsTradeRecords helpers", () => {
  it("computes weight, avg price, return, days", () => {
    const records = [
      {
        id: "1",
        system: "dbb",
        symbol: "ITA",
        buyDate: "2026-09-01",
        buyPrice: 100,
        buyAmountKrw: 100,
        weightPct: 50,
        memo: "",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        system: "dbb",
        symbol: "ITA",
        buyDate: "2026-09-10",
        buyPrice: 120,
        buyAmountKrw: 100,
        weightPct: 50,
        memo: "",
        createdAt: "",
        updatedAt: "",
      },
    ]
    expect(sumTradeWeightPct(records)).toBe(100)
    expect(averageTradeBuyPrice(records)).toBe(110)
    expect(tradeReturnPct(110, 121)).toBeCloseTo(10, 5)
    expect(daysBetweenDayKeys("2026-09-01", "2026-09-21")).toBe(20)
  })
})

describe("trade status views", () => {
  it("DBB 4/4 shows add-review next step without auto buy", () => {
    const view = buildDbbTradeStatusView(
      { count: 4, stage: { label: "강한 저점" }, close: 110, asOfDate: "2026-09-21" },
      [
        {
          id: "1",
          system: "dbb",
          symbol: "ITA",
          buyDate: "2026-09-10",
          buyPrice: 100,
          buyAmountKrw: 200,
          weightPct: 50,
          memo: "",
          createdAt: "",
          updatedAt: "",
        },
      ],
    )
    expect(view.signalLabel).toBe("4/4")
    expect(view.nextStep).toBe("추가 50% 매수 검토")
    expect(view.userStageNote).toBe("1차 매수 완료")
    expect(view.returnPct).toBeCloseTo(10, 5)
    expect(view.daysSinceBuy).toBe(11)
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
          buyAmountKrw: 400,
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
    expect(view.recordedWeightPct).toBe(40)
  })
})
