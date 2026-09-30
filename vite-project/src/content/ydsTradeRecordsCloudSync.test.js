import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  TRADE_RECORDS_STORAGE_KEY,
  deleteTradeRecord,
  listTradeRecords,
  readTradeRecordsStore,
  upsertTradeRecord,
  writeTradeRecordsStore,
} from "./ydsTradeRecords.js"
import {
  TRADE_RECORDS_SYNC_META_KEY,
  beginTradeRecordsCloudReconcile,
  endTradeRecordsCloudReconcile,
  fetchCloudTradeRecords,
  pushCloudTradeRecords,
  readTradeRecordsSyncRevision,
  reconcileTradeRecords,
  reconcileTradeRecordsWithCloud,
  scheduleTradeRecordsCloudPush,
  setTradeRecordsCloudAuth,
  tradeRecordsStoreHasData,
  writeTradeRecordsSyncRevision,
} from "./ydsTradeRecordsCloudSync.js"

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

const sampleIta = {
  version: 1,
  records: {
    "dbb:ITA": [
      {
        id: "tr_1",
        system: "dbb",
        symbol: "ITA",
        buyDate: "2026-09-22",
        buyPrice: 216.17,
        buyAmountUsd: 1080,
        shares: 5,
        weightPct: 50,
        memo: "",
        createdAt: "2026-09-23T08:06:11.847Z",
        updatedAt: "2026-09-23T08:06:11.847Z",
      },
    ],
  },
}

beforeEach(() => {
  installLocalStorageMock()
  setTradeRecordsCloudAuth(null)
  beginTradeRecordsCloudReconcile()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("reconcileTradeRecords", () => {
  it("empty server + local data → local-upload (never wipe local)", () => {
    const r = reconcileTradeRecords(sampleIta, {
      records: { version: 1, records: {} },
      revision: 0,
      updatedAt: null,
      syncMode: "empty",
    })
    expect(r.mode).toBe("local-upload")
    expect(r.shouldUpload).toBe(true)
    expect(r.store.records["dbb:ITA"][0].weightPct).toBe(50)
  })

  it("server data + empty local → cloud-download", () => {
    const r = reconcileTradeRecords(
      { version: 1, records: {} },
      {
        records: sampleIta,
        revision: 9,
        updatedAt: "2026-09-26T00:00:00.000Z",
        syncMode: "account",
      },
    )
    expect(r.mode).toBe("cloud-download")
    expect(r.shouldUpload).toBe(false)
    expect(r.revision).toBe(9)
    expect(r.store.records["dbb:ITA"]).toHaveLength(1)
  })

  it("both have data → keep cloud rows and local-only buckets, then upload", () => {
    const local = {
      version: 1,
      records: {
        "dbb:QQQ": [
          {
            id: "tr_local",
            system: "dbb",
            symbol: "QQQ",
            buyDate: "2026-01-01",
            buyPrice: 1,
            buyAmountUsd: 1,
            shares: 1,
            weightPct: 10,
            memo: "",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        "dbb:MSFT": [
          {
            id: "tr_msft",
            system: "dbb",
            symbol: "MSFT",
            buyDate: "2026-09-29",
            buyPrice: 100.25,
            buyAmountUsd: 506.25,
            shares: null,
            weightPct: 50,
            memo: "",
            createdAt: "2026-09-29T00:00:00.000Z",
            updatedAt: "2026-09-29T00:00:00.000Z",
          },
        ],
      },
    }
    const r = reconcileTradeRecords(local, {
      records: sampleIta,
      revision: 3,
      updatedAt: null,
      syncMode: "account",
    })
    expect(r.mode).toBe("merged-upload")
    expect(r.shouldUpload).toBe(true)
    expect(r.store.records["dbb:ITA"]).toHaveLength(1)
    expect(r.store.records["dbb:QQQ"]).toHaveLength(1)
    expect(r.store.records["dbb:MSFT"][0].symbol).toBe("MSFT")
  })

  it("both empty → empty", () => {
    const r = reconcileTradeRecords(
      { version: 1, records: {} },
      { records: { version: 1, records: {} }, revision: 0, updatedAt: null, syncMode: "empty" },
    )
    expect(r.mode).toBe("empty")
    expect(r.shouldUpload).toBe(false)
  })
})

describe("cloud fetch/push", () => {
  it("GET sync applies server into localStorage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          records: sampleIta,
          revision: 42,
          updatedAt: "2026-09-26T00:00:00.000Z",
          syncMode: "account",
        }),
      })),
    )
    const snap = await fetchCloudTradeRecords("token")
    expect(snap?.revision).toBe(42)
    expect(tradeRecordsStoreHasData(snap?.records)).toBe(true)

    writeTradeRecordsStore(snap.records)
    writeTradeRecordsSyncRevision(snap.revision)
    expect(listTradeRecords("dbb", "ITA")[0].weightPct).toBe(50)
    expect(readTradeRecordsSyncRevision()).toBe(42)
  })

  it("local → empty server uploads once via reconcile", async () => {
    writeTradeRecordsStore(sampleIta)
    const calls = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, opts = {}) => {
        calls.push({ url, method: opts.method || "GET", body: opts.body })
        if ((opts.method || "GET") === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              records: { version: 1, records: {} },
              revision: 0,
              updatedAt: null,
              syncMode: "empty",
            }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            records: sampleIta,
            revision: 100,
            updatedAt: "2026-09-26T01:00:00.000Z",
            syncMode: "account",
          }),
        }
      }),
    )
    const result = await reconcileTradeRecordsWithCloud("token")
    expect(result.mode).toBe("local-upload")
    expect(calls.some((c) => c.method === "PUT")).toBe(true)
    const put = calls.find((c) => c.method === "PUT")
    const body = JSON.parse(put.body)
    expect(body.records.records["dbb:ITA"][0].symbol).toBe("ITA")
    expect(body.baseRevision).toBe(0)
    expect(listTradeRecords("dbb", "ITA")).toHaveLength(1)
    expect(readTradeRecordsSyncRevision()).toBe(100)
  })

  it("server → empty local restores without wiping server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          records: sampleIta,
          revision: 7,
          updatedAt: null,
          syncMode: "account",
        }),
      })),
    )
    const result = await reconcileTradeRecordsWithCloud("token")
    expect(result.mode).toBe("cloud-download")
    expect(listTradeRecords("dbb", "ITA")[0].id).toBe("tr_1")
    // only GET — no empty PUT
    expect(fetch.mock.calls.every((c) => (c[1]?.method || "GET") === "GET")).toBe(true)
  })

  it("PUT sends baseRevision and updates revision", async () => {
    writeTradeRecordsStore(sampleIta)
    writeTradeRecordsSyncRevision(5)
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, opts = {}) => {
        const body = JSON.parse(opts.body)
        expect(body.baseRevision).toBe(5)
        expect(body.records.records["dbb:ITA"]).toHaveLength(1)
        return {
          ok: true,
          status: 200,
          json: async () => ({
            records: sampleIta,
            revision: 6,
            updatedAt: null,
            syncMode: "account",
          }),
        }
      }),
    )
    const out = await pushCloudTradeRecords("token", readTradeRecordsStore(), 5)
    expect(out.ok).toBe(true)
    expect(readTradeRecordsSyncRevision()).toBe(6)
  })

  it("409 conflict refetches server and keeps local if refetch empty", async () => {
    writeTradeRecordsStore(sampleIta)
    writeTradeRecordsSyncRevision(1)
    let n = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, opts = {}) => {
        n += 1
        if ((opts.method || "GET") === "PUT") {
          return {
            ok: false,
            status: 409,
            json: async () => ({ error: "revision_conflict", revision: 9 }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            records: sampleIta,
            revision: 9,
            updatedAt: null,
            syncMode: "account",
          }),
        }
      }),
    )
    const out = await pushCloudTradeRecords("token", readTradeRecordsStore(), 1)
    expect(out.conflict).toBe(true)
    expect(listTradeRecords("dbb", "ITA")).toHaveLength(1)
    expect(readTradeRecordsSyncRevision()).toBe(9)
    expect(n).toBeGreaterThanOrEqual(2)
  })
})

describe("logged-out behavior", () => {
  it("schedule push is no-op without auth; localStorage still works", async () => {
    setTradeRecordsCloudAuth(null)
    endTradeRecordsCloudReconcile()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    scheduleTradeRecordsCloudPush()
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).not.toHaveBeenCalled()

    const saved = upsertTradeRecord({
      system: "dbb",
      symbol: "ITA",
      buyDate: "2026-09-22",
      buyPrice: 216,
      buyAmountUsd: 100,
      weightPct: 50,
    })
    expect(saved).toBeTruthy()
    expect(listTradeRecords("dbb", "ITA")).toHaveLength(1)
    // dynamic import may schedule but still no auth → no fetch
    await new Promise((r) => setTimeout(r, 1000))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("equity buy intent survives cloud sync", () => {
  const neeStrategy = {
    id: "tr_nee_1",
    system: "dbb",
    symbol: "NEE",
    buyDate: "2026-10-01",
    buyPrice: 500,
    buyAmountUsd: 2500,
    shares: 5,
    weightPct: 50,
    memo: "",
    buyType: "strategy",
    buyStage: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  }
  const neeDiscretionary = {
    id: "tr_nee_2",
    system: "dbb",
    symbol: "NEE",
    buyDate: "2026-10-05",
    buyPrice: 490,
    buyAmountUsd: 1470,
    shares: 3,
    weightPct: 30,
    memo: "",
    buyType: "discretionary",
    buyStage: null,
    createdAt: "2026-10-05T00:00:00.000Z",
    updatedAt: "2026-10-05T00:00:00.000Z",
  }

  it("keeps buyType and buyStage on both upload and download, and leaves ETF rows untouched", async () => {
    writeTradeRecordsStore({
      version: 1,
      records: {
        "dbb:NEE": [neeStrategy, neeDiscretionary],
        "dbb:ITA": sampleIta.records["dbb:ITA"],
      },
    })

    const calls = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, opts = {}) => {
        calls.push({ method: opts.method || "GET", body: opts.body })
        if ((opts.method || "GET") === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              records: {
                version: 1,
                records: {
                  "dbb:NEE": [
                    {
                      ...neeStrategy,
                      buyStage: 2,
                      updatedAt: "2026-10-02T00:00:00.000Z",
                    },
                  ],
                  "dbb:QQQ": [
                    {
                      id: "tr_qqq",
                      system: "dbb",
                      symbol: "QQQ",
                      buyDate: "2026-09-01",
                      buyPrice: 480.55,
                      buyAmountUsd: 2402.75,
                      shares: 5,
                      weightPct: 50,
                      memo: "",
                      createdAt: "2026-09-01T00:00:00.000Z",
                      updatedAt: "2026-09-01T00:00:00.000Z",
                    },
                  ],
                },
              },
              revision: 4,
              updatedAt: null,
              syncMode: "account",
            }),
          }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            records: JSON.parse(opts.body).records,
            revision: 5,
            updatedAt: null,
            syncMode: "account",
          }),
        }
      }),
    )

    const result = await reconcileTradeRecordsWithCloud("token")
    expect(result.mode).toBe("merged-upload")
    const put = calls.find((c) => c.method === "PUT")
    const uploaded = JSON.parse(put.body).records.records
    expect(uploaded["dbb:NEE"].find((r) => r.id === "tr_nee_1")).toMatchObject({
      buyType: "strategy",
      buyStage: 2,
    })
    expect(uploaded["dbb:NEE"].find((r) => r.id === "tr_nee_2")).toMatchObject({
      buyType: "discretionary",
      buyStage: null,
    })
    expect(uploaded["dbb:ITA"][0].buyType).toBeUndefined()
    expect(uploaded["dbb:QQQ"][0].buyType).toBeUndefined()
    expect(uploaded["dbb:QQQ"][0].buyPrice).toBe(480.55)

    const nee = listTradeRecords("dbb", "NEE")
    expect(nee.map((r) => [r.id, r.buyType, r.buyStage])).toEqual([
      ["tr_nee_1", "strategy", 2],
      ["tr_nee_2", "discretionary", null],
    ])
    const qqq = listTradeRecords("dbb", "QQQ")[0]
    expect(qqq.buyType).toBeUndefined()
    expect(qqq.buyStage).toBeUndefined()
    expect(qqq.buyPrice).toBe(480.55)
    const ita = listTradeRecords("dbb", "ITA")[0]
    expect(ita.buyType).toBeUndefined()
    expect(ita.buyPrice).toBe(216.17)
  })
})

describe("discretionary buy without weight survives sync", () => {
  it("keeps buyType and a missing weightPct through reconcile and read", () => {
    const local = {
      version: 1,
      records: {
        "dbb:NEE": [
          {
            id: "tr_nee_d",
            system: "dbb",
            symbol: "NEE",
            buyDate: "2026-10-05",
            buyPrice: 76,
            buyAmountUsd: 228,
            shares: 3,
            memo: "",
            buyType: "discretionary",
            buyStage: null,
            createdAt: "2026-10-05T00:00:00.000Z",
            updatedAt: "2026-10-05T00:00:00.000Z",
          },
        ],
        "dbb:ITA": sampleIta.records["dbb:ITA"],
      },
    }
    const merged = reconcileTradeRecords(local, {
      records: { version: 1, records: {} },
      revision: 0,
      updatedAt: null,
      syncMode: "empty",
    })
    expect(merged.store.records["dbb:NEE"][0].weightPct).toBeUndefined()
    expect(merged.store.records["dbb:ITA"][0].weightPct).toBe(50)
    expect(merged.store.records["dbb:ITA"][0].buyType).toBeUndefined()
    writeTradeRecordsStore(merged.store)
    const nee = listTradeRecords("dbb", "NEE")[0]
    expect(nee.buyType).toBe("discretionary")
    expect(nee.buyStage).toBeNull()
    expect(nee.weightPct).toBeUndefined()
    const ita = listTradeRecords("dbb", "ITA")[0]
    expect(ita.weightPct).toBe(50)
    expect(ita.buyPrice).toBe(216.17)
    expect(ita.buyType).toBeUndefined()
  })
})

describe("storage key unchanged", () => {
  it("still uses yds.tradeRecords.v1 and sync meta is separate", () => {
    expect(TRADE_RECORDS_STORAGE_KEY).toBe("yds.tradeRecords.v1")
    expect(TRADE_RECORDS_SYNC_META_KEY).toBe("yds.tradeRecords.syncMeta.v1")
    writeTradeRecordsStore(sampleIta)
    writeTradeRecordsSyncRevision(3)
    expect(store.has(TRADE_RECORDS_STORAGE_KEY)).toBe(true)
    expect(store.has(TRADE_RECORDS_SYNC_META_KEY)).toBe(true)
    deleteTradeRecord("dbb", "ITA", "tr_1")
    expect(listTradeRecords("dbb", "ITA")).toHaveLength(0)
  })
})
