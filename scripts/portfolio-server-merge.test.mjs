/**
 * Server portfolio save merges by id. No database calls in the pure cases.
 * node --test scripts/portfolio-server-merge.test.mjs
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mergePortfolioServerPut } from "../vite-project/src/content/ydsPortfolioCloudSync.js"
import { replayPortfolioFifoFromTrades } from "../vite-project/src/content/ydsPortfolioFifoEngine.js"
import handler from "../api/portfolio-sync.js"

const trade = (id, at, extra = {}) => ({
  id,
  date: "2026-01-01",
  action: "buy",
  name: "Test",
  ticker: "AAPL",
  quantity: 1,
  unitPrice: 100,
  amount: 100,
  memo: "",
  createdAt: at,
  updatedAt: at,
  ...extra,
})

const ids = (result) => result.visibleTrades.map((row) => row.id).sort()

describe("mergePortfolioServerPut", () => {
  it("keeps 3 PC records and 2 mobile records", () => {
    const result = mergePortfolioServerPut({
      existingTrades: [trade("pc1", 1), trade("pc2", 2), trade("pc3", 3)],
      existingCash: 0,
      requestTrades: [trade("ph1", 4), trade("ph2", 5)],
      requestCash: 0,
    })
    assert.deepEqual(ids(result), ["pc1", "pc2", "pc3", "ph1", "ph2"])
  })

  it("collapses the same id to the newer edit", () => {
    const result = mergePortfolioServerPut({
      existingTrades: [trade("same", 10, { memo: "old" })],
      requestTrades: [trade("same", 20, { memo: "new" })],
    })
    assert.equal(result.visibleTrades.length, 1)
    assert.equal(result.visibleTrades[0].memo, "new")
    const flipped = mergePortfolioServerPut({
      existingTrades: [trade("same", 20, { memo: "new" })],
      requestTrades: [trade("same", 10, { memo: "old" })],
    })
    assert.equal(flipped.visibleTrades[0].memo, "new")
  })

  it("does not delete other-device records when an old client omits them", () => {
    const result = mergePortfolioServerPut({
      existingTrades: [trade("phone-only", 50), trade("shared", 40)],
      requestTrades: [trade("shared", 40), trade("pc-only", 60)],
    })
    assert.deepEqual(ids(result), ["pc-only", "phone-only", "shared"])
    assert.deepEqual(result.deletedIds, [])
  })

  it("applies an explicit delete without removing unrelated records or duplicating the tombstone", () => {
    const marker = {
      id: "yds-portfolio-deleted-v1",
      action: "watch",
      name: "",
      deletedIds: ["gone"],
    }
    const once = mergePortfolioServerPut({
      existingTrades: [trade("gone", 10), trade("keep", 11)],
      requestTrades: [trade("keep", 11), marker],
    })
    assert.deepEqual(ids(once), ["keep"])
    assert.deepEqual(once.deletedIds, ["gone"])
    const storedMarkers = once.storedTrades.filter((row) => row.id === "yds-portfolio-deleted-v1")
    assert.equal(storedMarkers.length, 1)
    const again = mergePortfolioServerPut({
      existingTrades: once.storedTrades,
      requestTrades: [trade("gone", 99), trade("keep", 11)],
    })
    assert.deepEqual(ids(again), ["keep"])
    assert.deepEqual(again.deletedIds, ["gone"])
  })

  it("stays the same when the merged result is saved again", () => {
    const once = mergePortfolioServerPut({
      existingTrades: [trade("a", 1), trade("b", 2)],
      requestTrades: [trade("c", 3)],
      requestCash: 1000,
      requestCashUpdatedAt: 80,
    })
    const twice = mergePortfolioServerPut({
      existingTrades: once.storedTrades,
      existingCash: once.cashBalance,
      requestTrades: once.storedTrades,
      requestCash: once.cashBalance,
      requestCashUpdatedAt: once.cashUpdatedAt,
    })
    assert.deepEqual(ids(twice), ids(once))
    assert.equal(twice.cashBalance, once.cashBalance)
    assert.deepEqual(twice.deletedIds, once.deletedIds)
  })

  it("keeps a newer cash stamp even when the other side has a newer trade", () => {
    const result = mergePortfolioServerPut({
      existingTrades: [trade("old-trade", 100)],
      existingCash: 5000,
      requestTrades: [trade("new-trade", 900)],
      requestCash: 8000,
      requestCashUpdatedAt: 200,
    })
    assert.equal(result.cashBalance, 8000)
    assert.equal(result.cashUpdatedAt, 200)
    assert.deepEqual(ids(result), ["new-trade", "old-trade"])
    const olderCash = mergePortfolioServerPut({
      existingTrades: result.storedTrades,
      existingCash: 8000,
      requestTrades: [trade("newer-trade", 5000)],
      requestCash: 1,
      requestCashUpdatedAt: 50,
    })
    assert.equal(olderCash.cashBalance, 8000)
    const unstamped = mergePortfolioServerPut({
      existingTrades: olderCash.storedTrades,
      existingCash: 8000,
      requestTrades: [trade("another", 9000)],
      requestCash: 1,
    })
    assert.equal(unstamped.cashBalance, 8000)
    assert.deepEqual(ids(olderCash), ["new-trade", "newer-trade", "old-trade"])
  })

  it("counts records without an id and does not store them", () => {
    const result = mergePortfolioServerPut({
      existingTrades: [trade("kept", 1)],
      requestTrades: [{ action: "buy", name: "무번호", quantity: 1, unitPrice: 5 }],
    })
    assert.equal(result.omittedWithoutId, 1)
    assert.deepEqual(ids(result), ["kept"])
    assert.equal(result.storedTrades.some((row) => row.name === "무번호"), false)
  })

  it("still replays buy and sell quantity after a merge", () => {
    const buy = trade("buy", 10, {
      date: "2026-01-01",
      action: "buy",
      name: "삼성",
      ticker: "005930",
      country: "kr",
      quantity: 10,
      unitPrice: 100,
    })
    const sell = trade("sell", 20, {
      date: "2026-01-02",
      action: "sell",
      name: "삼성",
      ticker: "005930",
      country: "kr",
      quantity: 4,
      unitPrice: 130,
    })
    const merged = mergePortfolioServerPut({
      existingTrades: [buy],
      requestTrades: [sell],
    })
    const fifo = replayPortfolioFifoFromTrades(merged.visibleTrades)
    assert.equal(fifo.lots.length, 1)
    assert.equal(fifo.lots[0].quantity, 6)
    assert.equal(fifo.lots[0].avgUnitPrice, 100)
    assert.equal(fifo.lots[0].realizedPnl, 120)
  })
})

describe("portfolio sync handler", () => {
  function mockRes() {
    const state = { statusCode: 200, body: null }
    return {
      state,
      setHeader() {},
      status(code) {
        state.statusCode = code
        return { json(body) { state.body = body } }
      },
    }
  }

  it("does not write when the existing row cannot be read", async () => {
    let writes = 0
    const res = mockRes()
    await handler(
      { method: "PUT", headers: { authorization: "Bearer tok" }, body: { trades: [trade("a", 1)], cash_balance: 0 } },
      res,
      {
        verifyFirebaseIdToken: async () => "uid",
        isSupabaseConfigured: () => true,
        supabaseRest: async (path, opts) => {
          if (opts?.method === "POST") writes += 1
          if (String(path).includes("user_portfolio?firebase_uid")) throw new Error("read_failed")
          return []
        },
      },
    )
    assert.equal(res.state.statusCode, 500)
    assert.equal(writes, 0)
  })

  it("stores the merged list instead of the request list", async () => {
    let saved = null
    const res = mockRes()
    await handler(
      {
        method: "PUT",
        headers: { authorization: "Bearer tok" },
        body: { trades: [trade("pc", 2)], cash_balance: 0, revision: 2 },
      },
      res,
      {
        verifyFirebaseIdToken: async () => "uid",
        isSupabaseConfigured: () => true,
        supabaseRest: async (path, opts) => {
          if (opts?.method === "POST") {
            saved = opts.body
            return [opts.body]
          }
          return [{ firebase_uid: "uid", trades: [trade("phone", 1)], cash_balance: 0, revision: 1 }]
        },
      },
    )
    assert.equal(res.state.statusCode, 200)
    const savedIds = saved.trades.map((row) => row.id).filter((id) => id !== "yds-portfolio-deleted-v1" && id !== "yds-portfolio-cash-meta-v1").sort()
    assert.deepEqual(savedIds, ["pc", "phone"])
  })
})
