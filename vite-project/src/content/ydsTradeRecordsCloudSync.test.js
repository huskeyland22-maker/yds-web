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

  it("both have data → server authoritative", () => {
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
      },
    }
    const r = reconcileTradeRecords(local, {
      records: sampleIta,
      revision: 3,
      updatedAt: null,
      syncMode: "account",
    })
    expect(r.mode).toBe("cloud-authoritative")
    expect(r.store.records["dbb:ITA"]).toHaveLength(1)
    expect(r.store.records["dbb:QQQ"]).toBeUndefined()
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
