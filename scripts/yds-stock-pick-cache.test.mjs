import {
  STOCK_PICK_SNAPSHOT_CACHE_TTL_MS,
  loadStockPickSnapshotCache,
  saveStockPickSnapshotCache,
  setStockPickSnapshotMemoryCache,
} from "../vite-project/src/content/ydsStockPickSnapshotCache.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const sample = new Map([
  [
    "005930",
    {
      engineSnapshot: { close: 70000, ma20: 71000, ma60: 68000, ma120: 65000, high52w: 80000, recentHigh: 75000, volumeToday: 1, volumeAvg20: 1 },
      extras: {},
      apiBody: { dataSource: "kis" },
      quote: { price: 70000 },
      fetchedAt: new Date().toISOString(),
    },
  ],
])

saveStockPickSnapshotCache(sample, new Date().toISOString(), [])
const loaded = loadStockPickSnapshotCache()
assert(loaded?.snapshots?.size === 1, "cache load")
assert(loaded.source === "memory" || loaded.source === "localStorage", "source")

setStockPickSnapshotMemoryCache(new Map(), new Date().toISOString(), [])
const expired = loadStockPickSnapshotCache(Date.now() + STOCK_PICK_SNAPSHOT_CACHE_TTL_MS + 1)
assert(expired === null, "ttl expiry")

console.log("OK stock pick cache", { ttlMin: STOCK_PICK_SNAPSHOT_CACHE_TTL_MS / 60000 })
