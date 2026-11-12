import assert from "node:assert/strict"
import { reconcilePortfolio } from "../vite-project/src/content/ydsPortfolioCloudSync.js"
import { replayPortfolioFifoFromTrades } from "../vite-project/src/content/ydsPortfolioFifoEngine.js"

const quiet = { deletedIds: [], persist: false }

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

const cloudOf = (trades, extra = {}) => ({
  trades,
  cashBalance: 0,
  revision: 1,
  updatedAtMs: 1,
  deletedIds: [],
  ...extra,
})

const ids = (result) => result.trades.map((row) => row.id)

const local = [trade("t1", 100)]
const cloudNewer = cloudOf([trade("t2", 200)], { cashBalance: 5000, revision: 200, updatedAtMs: 200 })

const r1 = reconcilePortfolio([], 0, cloudNewer, quiet)
assert.equal(r1.source, "cloud")
assert.equal(r1.mode, "cloud-download")
assert.deepEqual(ids(r1), ["t2"])
assert.equal(r1.cashBalance, 5000)
assert.equal(r1.shouldUpload, false)

const r2 = reconcilePortfolio(local, 0, null, quiet)
assert.equal(r2.mode, "local-only-upload-pending")
assert.deepEqual(ids(r2), ["t1"])
assert.equal(r2.shouldUpload, true)

const r3 = reconcilePortfolio(local, 0, cloudOf([]), quiet)
assert.equal(r3.mode, "local-only-upload-pending")
assert.deepEqual(ids(r3), ["t1"])

const r4 = reconcilePortfolio(local, 0, cloudOf([trade("old", 50)], { updatedAtMs: 50 }), quiet)
assert.equal(r4.source, "merged")
assert.equal(r4.mode, "merged")
assert.equal(r4.shouldUpload, true)
assert.deepEqual(ids(r4).sort(), ["old", "t1"])

const pcToPhone = reconcilePortfolio(
  [trade("pc", 100)],
  0,
  cloudOf([trade("phone", 200)], { updatedAtMs: 200 }),
  quiet,
)
const phoneToPc = reconcilePortfolio(
  [trade("phone", 200)],
  0,
  cloudOf([trade("pc", 100)], { updatedAtMs: 100 }),
  quiet,
)
assert.deepEqual(pcToPhone.trades, phoneToPc.trades)
assert.deepEqual(ids(pcToPhone), ["phone", "pc"])

const same = trade("same", 100, { memo: "once" })
const duplicated = reconcilePortfolio(
  [same, { ...same }],
  0,
  cloudOf([{ ...same }]),
  quiet,
)
assert.equal(duplicated.trades.length, 1)
assert.equal(duplicated.trades[0].memo, "once")

const older = trade("edit", 100, { memo: "old" })
const newer = trade("edit", 300, { memo: "new" })
const editFromLocal = reconcilePortfolio([older], 0, cloudOf([newer], { updatedAtMs: 300 }), quiet)
const editFromCloud = reconcilePortfolio([newer], 0, cloudOf([older], { updatedAtMs: 100 }), quiet)
assert.equal(editFromLocal.trades[0].memo, "new")
assert.deepEqual(editFromLocal.trades, editFromCloud.trades)

const once = reconcilePortfolio(
  [trade("a", 100)],
  0,
  cloudOf([trade("b", 200)], { updatedAtMs: 200 }),
  quiet,
)
const twice = reconcilePortfolio(
  once.trades,
  once.cashBalance,
  cloudOf(once.trades, { cashBalance: once.cashBalance, updatedAtMs: 200, deletedIds: once.deletedIds }),
  { deletedIds: once.deletedIds, persist: false },
)
assert.deepEqual(twice.trades, once.trades)
assert.equal(twice.mode, "merged-in-sync")
assert.equal(twice.shouldUpload, false)

const kept = reconcilePortfolio(
  [trade("keep", 100)],
  0,
  cloudOf([trade("gone", 150), trade("phone", 180)], { updatedAtMs: 180 }),
  { deletedIds: ["gone"], persist: false },
)
assert.deepEqual(ids(kept).sort(), ["keep", "phone"])
assert.deepEqual(kept.deletedIds, ["gone"])

const looseA = {
  action: "buy",
  name: "무번호",
  date: "2026-02-01",
  quantity: 1,
  unitPrice: 5,
  createdAt: 1,
  updatedAt: 1,
}
const looseB = { ...looseA, name: "다른무번호", createdAt: 2, updatedAt: 2 }
const loose = reconcilePortfolio([looseA], 0, cloudOf([looseB], { updatedAtMs: 2 }), quiet)
assert.equal(loose.trades.length, 2)
assert.deepEqual(
  loose.trades.map((row) => row.name).sort(),
  ["다른무번호", "무번호"],
)

const identicalLoose = reconcilePortfolio(
  [looseA],
  0,
  cloudOf([{ ...looseA }], { updatedAtMs: 1 }),
  { deletedIds: ["gone"], persist: false },
)
assert.equal(identicalLoose.trades.length, 2)
assert.equal(identicalLoose.trades.every((row) => row.name === "무번호"), true)

const cashKept = reconcilePortfolio(
  [trade("local", 100)],
  0,
  cloudOf([trade("remote", 200)], { cashBalance: 9000, updatedAtMs: 500 }),
  quiet,
)
assert.deepEqual(ids(cashKept).sort(), ["local", "remote"])
assert.equal(cashKept.cashBalance, 9000)

const buy = trade("buy", 10, {
  date: "2026-01-01",
  action: "buy",
  name: "삼성",
  ticker: "005930",
  country: "kr",
  quantity: 10,
  unitPrice: 100,
  amount: 1000,
})
const sell = trade("sell", 20, {
  date: "2026-01-02",
  action: "sell",
  name: "삼성",
  ticker: "005930",
  country: "kr",
  quantity: 4,
  unitPrice: 130,
  amount: 520,
})
const mixed = reconcilePortfolio([buy], 0, cloudOf([sell], { updatedAtMs: 20 }), quiet)
const fifo = replayPortfolioFifoFromTrades(mixed.trades)
assert.equal(fifo.lots.length, 1)
assert.equal(fifo.lots[0].quantity, 6)
assert.equal(fifo.lots[0].avgUnitPrice, 100)

console.log("yds-portfolio-cloud-sync.test.mjs OK")
