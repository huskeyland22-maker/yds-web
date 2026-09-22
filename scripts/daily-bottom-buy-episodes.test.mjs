/**
 * Daily Bottom Buy V1 — episode state operational observation tests.
 * Records current client behavior; does not change product logic.
 *
 * node --test scripts/daily-bottom-buy-episodes.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, it, beforeEach } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const EPISODES_SRC = join(root, "vite-project/src/content/ydsDailyBottomBuyEpisodes.js")
const STORAGE_KEY = "yds.dailyBottomBuy.episodes.v1"

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

async function loadEpisodesModule() {
  installLocalStorageMock()
  // Bust cache so each suite gets a clean module + fresh storage binding
  const href = `${pathToFileURL(EPISODES_SRC).href}?t=${Date.now()}-${Math.random()}`
  return import(href)
}

function card(symbol, count, asOfDate = "2026-09-21") {
  return { symbol, count, asOfDate }
}

function stored(symbol) {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const map = JSON.parse(raw)
  return map[symbol] ?? null
}

describe("DBB V1 episode ops — [1] 3→2→3→4 same episode", () => {
  it("keeps episode + notedPrimary across 3→2→3; offers add at 4", async () => {
    const { syncDailyBottomEpisodes, acknowledgeEpisodeTranche } = await loadEpisodesModule()
    const sym = "ITA"

    let out = syncDailyBottomEpisodes([card(sym, 3, "2026-09-18")])
    assert.equal(out[sym].lastCount, 3)
    assert.equal(out[sym].notedPrimary, false)
    assert.match(out[sym].uiNote, /새 조정 에피소드|1차/)

    acknowledgeEpisodeTranche(sym, "primary")
    out = syncDailyBottomEpisodes([card(sym, 3, "2026-09-18")])
    assert.equal(stored(sym).notedPrimary, true)
    assert.equal(out[sym].notedPrimary, true)
    const openDate = stored(sym).openDate

    out = syncDailyBottomEpisodes([card(sym, 2, "2026-09-19")])
    assert.ok(stored(sym), "episode must survive count=2")
    assert.equal(stored(sym).notedPrimary, true)
    assert.equal(stored(sym).openDate, openDate)
    assert.equal(out[sym].lastCount, 2)

    out = syncDailyBottomEpisodes([card(sym, 3, "2026-09-20")])
    assert.equal(stored(sym).openDate, openDate, "same episode after 3→2→3")
    assert.equal(stored(sym).notedPrimary, true, "1차 상태 초기화 없음")
    assert.equal(out[sym].notedPrimary, true)
    assert.match(out[sym].uiNote, /1차\(50%\) 후 4개 대기/)
    assert.doesNotMatch(out[sym].uiNote, /새 조정 에피소드/)

    out = syncDailyBottomEpisodes([card(sym, 4, "2026-09-21")])
    assert.equal(stored(sym).openDate, openDate)
    assert.equal(stored(sym).notedPrimary, true)
    assert.equal(stored(sym).reached4, true)
    assert.equal(out[sym].notedAdd, false)
    assert.match(out[sym].uiNote, /추가 매수 후보/)
  })
})

describe("DBB V1 episode ops — [2] 3→1→3 current rule (record only)", () => {
  it("clears episode at count<2 then opens a new episode at 3", async () => {
    const { syncDailyBottomEpisodes, acknowledgeEpisodeTranche } = await loadEpisodesModule()
    const sym = "ITA"

    syncDailyBottomEpisodes([card(sym, 3, "2026-09-18")])
    acknowledgeEpisodeTranche(sym, "primary")
    assert.equal(stored(sym).notedPrimary, true)
    const firstOpen = stored(sym).openDate

    const mid = syncDailyBottomEpisodes([card(sym, 1, "2026-09-19")])
    assert.equal(stored(sym), null, "count 1/4 ends/clears episode in storage")
    assert.equal(mid[sym].notedPrimary, false)
    assert.equal(mid[sym].uiNote, "")

    const again = syncDailyBottomEpisodes([card(sym, 3, "2026-09-25")])
    assert.ok(stored(sym), "new episode created")
    assert.equal(stored(sym).notedPrimary, false, "new episode resets 1차 상태")
    assert.equal(stored(sym).notedAdd, false)
    assert.equal(stored(sym).openDate, "2026-09-25")
    assert.notEqual(stored(sym).openDate, firstOpen)
    assert.match(again[sym].uiNote, /새 조정 에피소드/)
  })
})

describe("DBB V1 episode ops — [3] localStorage restore", () => {
  it("keeps notedPrimary after readAll/sync", async () => {
    const { syncDailyBottomEpisodes, acknowledgeEpisodeTranche } = await loadEpisodesModule()
    const sym = "ITA"

    syncDailyBottomEpisodes([card(sym, 3, "2026-09-18")])
    acknowledgeEpisodeTranche(sym, "primary")
    assert.equal(stored(sym).notedPrimary, true)

    const raw = localStorage.getItem(STORAGE_KEY)
    assert.ok(raw)
    const parsed = JSON.parse(raw)
    assert.equal(parsed[sym].notedPrimary, true)

    const out = syncDailyBottomEpisodes([card(sym, 3, "2026-09-18")])
    assert.equal(out[sym].notedPrimary, true)
    assert.equal(stored(sym).notedPrimary, true)
    assert.equal(stored(sym).openDate, "2026-09-18")
  })
})

describe("DBB V1 episode ops — [4] asOfDate change alone", () => {
  it("does not open a new episode when asOfDate rolls 9/18→9/21 at count≥2", async () => {
    const { syncDailyBottomEpisodes, acknowledgeEpisodeTranche } = await loadEpisodesModule()
    const sym = "ITA"

    syncDailyBottomEpisodes([card(sym, 3, "2026-09-18")])
    acknowledgeEpisodeTranche(sym, "primary")
    const before = stored(sym)

    syncDailyBottomEpisodes([card(sym, 3, "2026-09-21")])
    const after = stored(sym)

    assert.equal(after.openDate, before.openDate)
    assert.equal(after.openDate, "2026-09-18")
    assert.equal(after.notedPrimary, true)
    assert.equal(after.lastCount, 3)
  })
})

describe("DBB V1 episode ops — [5] ticker independence", () => {
  it("ITA episode does not affect SMH/QQQ", async () => {
    const { syncDailyBottomEpisodes, acknowledgeEpisodeTranche } = await loadEpisodesModule()

    syncDailyBottomEpisodes([
      card("ITA", 3, "2026-09-18"),
      card("SMH", 0, "2026-09-18"),
      card("QQQ", 1, "2026-09-18"),
    ])
    acknowledgeEpisodeTranche("ITA", "primary")

    syncDailyBottomEpisodes([
      card("ITA", 3, "2026-09-18"),
      card("SMH", 0, "2026-09-18"),
      card("QQQ", 2, "2026-09-18"),
    ])

    assert.equal(stored("ITA").notedPrimary, true)
    assert.equal(stored("SMH"), null)
    assert.equal(stored("QQQ"), null, "watch-only QQQ without prior ≥3 does not open episode")

    syncDailyBottomEpisodes([
      card("ITA", 3, "2026-09-18"),
      card("SMH", 3, "2026-09-21"),
      card("QQQ", 1, "2026-09-21"),
    ])
    assert.equal(stored("ITA").notedPrimary, true)
    assert.equal(stored("ITA").openDate, "2026-09-18")
    assert.ok(stored("SMH"))
    assert.equal(stored("SMH").notedPrimary, false)
    assert.equal(stored("SMH").openDate, "2026-09-21")
    assert.equal(stored("QQQ"), null)
  })
})

describe("DBB V1 episode ops — [6] no order API calls", () => {
  it("episode module has no order/broker fetch calls", async () => {
    const src = readFileSync(EPISODES_SRC, "utf8")
    assert.match(src, /localStorage/)
    assert.match(src, /notedPrimary/)
    assert.match(src, /acknowledgeEpisodeTranche/)
    assert.doesNotMatch(src, /\bfetch\s*\(/)
    assert.ok(!src.includes("/api/"), "must not call any /api/ endpoint")
    assert.doesNotMatch(src, /placeOrder|submitOrder|broker|kisClient/i)

    // Runtime: sync/ack must not invoke fetch
    const { syncDailyBottomEpisodes, acknowledgeEpisodeTranche } = await loadEpisodesModule()
    let fetchCalls = 0
    const prevFetch = globalThis.fetch
    globalThis.fetch = async (...args) => {
      fetchCalls += 1
      throw new Error(`unexpected fetch: ${args[0]}`)
    }
    try {
      syncDailyBottomEpisodes([card("ITA", 3, "2026-09-18")])
      acknowledgeEpisodeTranche("ITA", "primary")
      syncDailyBottomEpisodes([card("ITA", 4, "2026-09-21")])
      acknowledgeEpisodeTranche("ITA", "add")
    } finally {
      globalThis.fetch = prevFetch
    }
    assert.equal(fetchCalls, 0)
  })
})
