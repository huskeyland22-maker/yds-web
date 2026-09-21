/**
 * Hobby function-cap fix: DBB hosted by market-data + vercel rewrite.
 * node --test scripts/daily-bottom-buy-dispatch.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, it } from "node:test"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function listServerlessEntries() {
  const apiRoot = join(root, "api")
  /** @type {string[]} */
  const out = []
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const st = statSync(p)
      if (st.isDirectory()) {
        if (name === "_lib") continue
        walk(p)
        continue
      }
      if (name.endsWith(".js")) {
        out.push(p.slice(apiRoot.length + 1).replace(/\\/g, "/"))
      }
    }
  }
  walk(apiRoot)
  return out.sort()
}

function mockRes() {
  /** @type {{ statusCode: number, body: any, headers: Record<string, string>, ended: boolean }} */
  const state = { statusCode: 0, body: null, headers: {}, ended: false }
  return {
    state,
    setHeader(k, v) {
      state.headers[k] = v
    },
    status(code) {
      state.statusCode = code
      return this
    },
    json(body) {
      state.body = body
      state.ended = true
      return this
    },
    end() {
      state.ended = true
      return this
    },
  }
}

describe("daily-bottom-buy hobby dispatch", () => {
  it("serverless entries are exactly 12 and exclude daily-bottom-buy.js", () => {
    const entries = listServerlessEntries()
    assert.equal(entries.length, 12, `expected 12, got ${entries.length}: ${entries.join(", ")}`)
    assert.ok(!entries.includes("daily-bottom-buy.js"))
    assert.ok(entries.includes("market-data.js"))
    assert.ok(entries.includes("panic.js"))
    assert.ok(!existsSync(join(root, "api", "daily-bottom-buy.js")))
  })

  it("vercel rewrite maps /api/daily-bottom-buy → market-data?ydsMode=daily-bottom-buy", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"))
    const hit = vercel.rewrites?.find((r) => r.source === "/api/daily-bottom-buy")
    assert.ok(hit, "missing daily-bottom-buy rewrite")
    assert.equal(hit.destination, "/api/market-data?ydsMode=daily-bottom-buy")
    const panicSources = (vercel.rewrites || [])
      .map((r) => r.source)
      .filter((s) => String(s).startsWith("/api/panic"))
    assert.deepEqual(panicSources, [
      "/api/panic/latest",
      "/api/panic/history/latest",
      "/api/panic/history",
      "/api/panic/history-v2/backfill",
      "/api/panic/history-v2",
      "/api/panic/update",
    ])
  })

  it("frontend API_PATH and snapshot path unchanged", () => {
    const src = readFileSync(join(root, "vite-project/src/utils/dailyBottomBuyApi.js"), "utf8")
    assert.match(src, /API_PATH\s*=\s*"\/api\/daily-bottom-buy"/)
    assert.match(src, /SNAPSHOT_PATH\s*=\s*"\/data\/daily-bottom-buy-snapshot\.json"/)
    assert.ok(existsSync(join(root, "vite-project/public/data/daily-bottom-buy-snapshot.json")))
  })

  it("snapshot JSON is usable as fallback payload", () => {
    const snap = JSON.parse(
      readFileSync(join(root, "vite-project/public/data/daily-bottom-buy-snapshot.json"), "utf8"),
    )
    assert.equal(snap.ok, true)
    assert.ok(Array.isArray(snap.all))
    assert.ok(snap.all.length >= 1)
  })

  it("market-data early-dispatches DBB without running market-data body", async () => {
    const mod = await import(pathToFileURL(join(root, "api/market-data.js")).href)
    const res = mockRes()
    let dbbCalled = false
    const origFetch = globalThis.fetch
    globalThis.fetch = async () => {
      dbbCalled = true
      // Force Yahoo failure → handler still returns 200 with per-ETF error cards
      return { ok: false, status: 503 }
    }
    try {
      await mod.default(
        { method: "GET", query: { ydsMode: "daily-bottom-buy" } },
        res,
      )
    } finally {
      globalThis.fetch = origFetch
    }
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body?.ok, true)
    assert.equal(res.state.body?.system, "daily_bottom_buy_v1")
    assert.equal(res.state.body?.separateFromPanic, true)
    assert.ok(Array.isArray(res.state.body?.all))
    assert.equal(res.state.body.all.length, 10)
    assert.ok(dbbCalled, "DBB path should fetch Yahoo OHLCV")
    assert.equal(res.state.body?.parsedData, undefined, "must not return market-data shape")
  })

  it("market-data without ydsMode keeps market-data response shape", async () => {
    const mod = await import(pathToFileURL(join(root, "api/market-data.js")).href)
    const res = mockRes()
    const origFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
      const u = String(url)
      if (u.includes("fred") || u.includes("stlouisfed")) {
        return {
          ok: false,
          status: 401,
          json: async () => ({}),
          text: async () => "",
        }
      }
      // Yahoo chart quote stub
      return {
        ok: true,
        json: async () => ({
          chart: {
            result: [
              {
                meta: { regularMarketPrice: 100, previousClose: 99 },
                indicators: { quote: [{ close: [98, 99, 100] }] },
              },
            ],
          },
        }),
      }
    }
    try {
      await mod.default({ method: "GET", query: {} }, res)
    } finally {
      globalThis.fetch = origFetch
    }
    assert.equal(res.state.statusCode, 200)
    assert.ok(res.state.body?.parsedData)
    assert.ok(res.state.body?.changeData)
    assert.ok(String(res.state.body?.source || "").includes("yahoo"))
    assert.equal(res.state.body?.system, undefined)
  })

  it("OPTIONS on DBB dispatch returns 204", async () => {
    const { handleDailyBottomBuy } = await import(
      pathToFileURL(join(root, "api/_lib/dailyBottomBuyHandler.js")).href
    )
    const res = mockRes()
    await handleDailyBottomBuy({ method: "OPTIONS", query: {} }, res)
    assert.equal(res.state.statusCode, 204)
    assert.equal(res.state.ended, true)
  })
})
