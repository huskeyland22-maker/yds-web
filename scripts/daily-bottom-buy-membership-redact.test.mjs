/**
 * FREE/PRO redaction for ETF daily-bottom-buy (no live Yahoo).
 * node --test scripts/daily-bottom-buy-membership-redact.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import {
  cardHasProDetails,
  payloadHasProDetails,
  redactDailyBottomBuyCard,
  redactDailyBottomBuyPayload,
} from "../api/_lib/dailyBottomBuyRedact.js"
import { handleDailyBottomBuy } from "../api/_lib/dailyBottomBuyHandler.js"
import {
  DAILY_BOTTOM_THRESHOLDS,
  evaluateBars,
  buildEtfCard,
} from "../api/_lib/dailyBottomBuyEngine.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Run one exported function from a client module without loading Firebase.
 * @param {string} file
 * @param {string} name
 * @param {string} nextExport
 * @param {Record<string, unknown>} deps
 */
function loadExportedFunction(file, name, nextExport, deps) {
  const src = readFileSync(file, "utf8")
  const start = src.indexOf(`export function ${name}`)
  const end = src.indexOf(`export async function ${nextExport}`)
  assert.ok(start >= 0 && end > start, `${name} source range missing`)
  const body = src.slice(start, end).replace("export function", "function")
  const keys = Object.keys(deps)
  return new Function(...keys, `${body}\nreturn ${name}`)(...keys.map((key) => deps[key]))
}

function mockRes() {
  const state = { statusCode: 0, body: null, headers: {} }
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
      return this
    },
    end() {
      return this
    },
  }
}

function sampleFullCard() {
  const bars = []
  let close = 100
  for (let i = 0; i < 40; i++) {
    close = close * (0.99 + (i % 5) * 0.001)
    bars.push({
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1e6,
    })
  }
  const evaluation = evaluateBars(bars, DAILY_BOTTOM_THRESHOLDS)
  return buildEtfCard(
    { symbol: "SMH", theme: "반도체·AI 컴퓨팅", themeShort: "반도체·AI", role: "AI의 두뇌" },
    evaluation.ok
      ? evaluation
      : {
          ok: true,
          asOfDate: "2026-01-28",
          close: 80,
          rsi14: 30,
          stochK: 10,
          bbPctB: 0.005,
          ma20DevPct: -5,
          flags: { rsi: true, stoch: true, bb: true, ma20: true },
          count: 4,
          stage: {
            id: "strong",
            count: 4,
            label: "강한 저점",
            priority: 0,
            splitHint: "추가 매수 후보 (50%)",
          },
          thresholds: DAILY_BOTTOM_THRESHOLDS,
        },
  )
}

describe("dailyBottomBuyRedact", () => {
  it("strips indicator fields and splitHint from cards", () => {
    const full = {
      symbol: "SMH",
      theme: "반도체·AI 컴퓨팅",
      themeShort: "반도체·AI",
      role: "AI의 두뇌",
      ok: true,
      asOfDate: "2026-01-28",
      close: 80,
      rsi14: 30,
      stochK: 10,
      bbPctB: 0.005,
      ma20DevPct: -5,
      flags: { rsi: true, stoch: true, bb: true, ma20: true },
      count: 4,
      stage: {
        id: "strong",
        count: 4,
        label: "강한 저점",
        priority: 0,
        splitHint: "추가 매수 후보 (50%)",
      },
    }
    assert.equal(cardHasProDetails(full), true)
    const summary = redactDailyBottomBuyCard(full)
    assert.equal(summary.symbol, "SMH")
    assert.equal(summary.count, 4)
    assert.equal(summary.stage.label, "강한 저점")
    assert.equal(summary.rsi14, undefined)
    assert.equal(summary.flags, undefined)
    assert.equal(summary.close, undefined)
    assert.equal(summary.stage.splitHint, undefined)
    assert.equal(cardHasProDetails(summary), false)
  })

  it("redacts list fields on payload and keeps thresholds", () => {
    const full = sampleFullCard()
    const payload = {
      ok: true,
      thresholds: DAILY_BOTTOM_THRESHOLDS,
      opportunities: [full],
      watch: [],
      waiting: [],
      all: [full],
    }
    assert.equal(payloadHasProDetails(payload), true)
    const redacted = redactDailyBottomBuyPayload(payload)
    assert.equal(redacted.access, "summary")
    assert.deepEqual(redacted.thresholds, DAILY_BOTTOM_THRESHOLDS)
    assert.equal(payloadHasProDetails(redacted), false)
    assert.equal(redacted.all[0].rsi14, undefined)
  })

  it("keeps count and stage from the same full payload and drops detail fields", () => {
    const stages = [
      { id: "strong", count: 4, label: "강한 저점", priority: 0, splitHint: "추가 매수 후보 (50%)" },
      { id: "primary", count: 3, label: "1차 매수", priority: 1, splitHint: "1차 매수 후보 (50%)" },
      { id: "watch", count: 2, label: "관심", priority: 2, splitHint: "관심 · 아직 매수 단계 아님" },
      { id: "wait", count: 1, label: "대기", priority: 3, splitHint: "대기" },
    ]
    const symbols = ["SMH", "IGV", "CIBR", "VOO"]
    const cards = stages.map((stage, i) => ({
      symbol: symbols[i],
      theme: "반도체·AI 컴퓨팅",
      themeShort: "반도체·AI",
      role: "AI의 두뇌",
      ok: true,
      asOfDate: "2026-11-09",
      close: 470 + i,
      rsi14: 33.6,
      stochK: 12.1,
      bbPctB: 0.08,
      ma20DevPct: -11.4,
      // Intentionally disagrees with count. Redaction must not recompute the score.
      flags: { rsi: true, stoch: true, bb: true, ma20: true },
      count: stage.count,
      stage,
    }))
    const full = {
      ok: true,
      access: "full",
      thresholds: DAILY_BOTTOM_THRESHOLDS,
      opportunities: [cards[0], cards[1]],
      watch: [cards[2]],
      waiting: [cards[3]],
      all: cards,
    }
    const free = redactDailyBottomBuyPayload(full)
    const detailKeys = ["rsi14", "stochK", "bbPctB", "ma20DevPct", "flags", "close", "asOfDate"]
    for (const listName of ["opportunities", "watch", "waiting", "all"]) {
      assert.equal(free[listName].length, full[listName].length, listName)
      full[listName].forEach((card, i) => {
        const summary = free[listName][i]
        assert.equal(summary.symbol, card.symbol)
        assert.equal(summary.count, card.count, card.symbol)
        assert.equal(summary.stage.id, card.stage.id, card.symbol)
        assert.equal(summary.stage.count, card.stage.count, card.symbol)
        assert.equal(summary.stage.label, card.stage.label, card.symbol)
        assert.equal(summary.stage.priority, card.stage.priority, card.symbol)
        assert.equal(summary.stage.splitHint, undefined, card.symbol)
        for (const key of detailKeys) {
          assert.equal(summary[key], undefined, `${card.symbol}.${key}`)
        }
        assert.equal(cardHasProDetails(summary), false, card.symbol)
      })
    }
    assert.equal(free.access, "summary")
    assert.equal(payloadHasProDetails(free), false)
    assert.equal(full.access, "full")
    assert.equal(full.all[0].count, 4)
    assert.equal(full.all[0].rsi14, 33.6)
  })
})

describe("handleDailyBottomBuy membership access", () => {
  const fakeBars = Array.from({ length: 40 }, (_, i) => {
    const close = 90 - i * 0.2
    return {
      date: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1e6,
    }
  })

  it("returns summary without details when not PRO", async () => {
    const res = mockRes()
    await handleDailyBottomBuy(
      { method: "GET", headers: {} },
      res,
      {
        requireProMembership: async () => ({
          ok: false,
          status: 401,
          body: { error: "missing_token" },
        }),
        fetchYahooOhlcv: async () => fakeBars,
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.ok, true)
    assert.equal(res.state.body.access, "summary")
    assert.equal(payloadHasProDetails(res.state.body), false)
    assert.ok(Array.isArray(res.state.body.all))
    assert.ok(res.state.body.all.length >= 1)
  })

  it("returns full payload for PRO", async () => {
    const res = mockRes()
    await handleDailyBottomBuy(
      { method: "GET", headers: { authorization: "Bearer tok" } },
      res,
      {
        requireProMembership: async () => ({
          ok: true,
          uid: "u1",
          membership: { plan: "pro", status: "active", source: null, updatedAt: null, reason: "plan_pro" },
        }),
        fetchYahooOhlcv: async () => fakeBars,
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.access, "full")
    assert.equal(payloadHasProDetails(res.state.body), true)
  })

  it("membership lookup failure still returns summary not details", async () => {
    const res = mockRes()
    await handleDailyBottomBuy(
      { method: "GET", headers: { authorization: "Bearer tok" } },
      res,
      {
        requireProMembership: async () => ({
          ok: false,
          status: 500,
          body: { error: "membership_lookup_failed" },
        }),
        fetchYahooOhlcv: async () => fakeBars,
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.access, "summary")
    assert.equal(payloadHasProDetails(res.state.body), false)
  })

  it("logged-in FREE member gets the same summary as anonymous (no analysis gap)", async () => {
    const anon = mockRes()
    const free = mockRes()
    const depsAnon = {
      requireProMembership: async () => ({
        ok: false,
        status: 401,
        body: { error: "missing_token" },
      }),
      fetchYahooOhlcv: async () => fakeBars,
    }
    const depsFree = {
      requireProMembership: async () => ({
        ok: false,
        status: 403,
        body: { error: "pro_required", plan: "free", reason: "missing_row" },
      }),
      fetchYahooOhlcv: async () => fakeBars,
    }
    await handleDailyBottomBuy({ method: "GET", headers: {} }, anon, depsAnon)
    await handleDailyBottomBuy(
      { method: "GET", headers: { authorization: "Bearer tok" } },
      free,
      depsFree,
    )
    assert.equal(anon.state.body.access, "summary")
    assert.equal(free.state.body.access, "summary")
    assert.equal(payloadHasProDetails(anon.state.body), false)
    assert.equal(payloadHasProDetails(free.state.body), false)
    assert.equal(anon.state.body.all?.[0]?.count, free.state.body.all?.[0]?.count)
    assert.equal(anon.state.body.all?.[0]?.rsi14, undefined)
    assert.equal(free.state.body.all?.[0]?.rsi14, undefined)
  })

  it("PRO full and FREE summary share count and stage for the same injected bars", async () => {
    const pro = mockRes()
    const free = mockRes()
    const fetchYahooOhlcv = async () => fakeBars
    await handleDailyBottomBuy(
      { method: "GET", headers: { authorization: "Bearer tok" } },
      pro,
      {
        requireProMembership: async () => ({
          ok: true,
          uid: "u1",
          membership: { plan: "pro", status: "active", source: null, updatedAt: null, reason: "plan_pro" },
        }),
        fetchYahooOhlcv,
      },
    )
    await handleDailyBottomBuy(
      { method: "GET", headers: {} },
      free,
      {
        requireProMembership: async () => ({
          ok: false,
          status: 401,
          body: { error: "missing_token" },
        }),
        fetchYahooOhlcv,
      },
    )
    assert.equal(pro.state.body.access, "full")
    assert.equal(free.state.body.access, "summary")
    assert.equal(payloadHasProDetails(pro.state.body), true)
    assert.equal(payloadHasProDetails(free.state.body), false)
    const proBySymbol = Object.fromEntries(pro.state.body.all.map((card) => [card.symbol, card]))
    assert.equal(free.state.body.all.length, pro.state.body.all.length)
    for (const summary of free.state.body.all) {
      const full = proBySymbol[summary.symbol]
      assert.ok(full, summary.symbol)
      assert.equal(summary.count, full.count, summary.symbol)
      assert.equal(summary.stage.id, full.stage.id, summary.symbol)
      assert.equal(summary.stage.count, full.stage.count, summary.symbol)
      assert.equal(summary.stage.label, full.stage.label, summary.symbol)
      assert.equal(summary.rsi14, undefined, summary.symbol)
      assert.equal(summary.stochK, undefined, summary.symbol)
      assert.equal(summary.bbPctB, undefined, summary.symbol)
      assert.equal(summary.ma20DevPct, undefined, summary.symbol)
      assert.equal(summary.flags, undefined, summary.symbol)
      assert.equal(summary.close, undefined, summary.symbol)
      assert.equal(summary.asOfDate, undefined, summary.symbol)
      assert.equal(summary.stage.splitHint, undefined, summary.symbol)
    }
  })
})

describe("daily-bottom-buy gate wiring", () => {
  it("client API uses Bearer and applyDailyBottomBuyAccess", () => {
    const src = readFileSync(join(root, "vite-project/src/utils/dailyBottomBuyApi.js"), "utf8")
    assert.match(src, /withOptionalBearerAuth/)
    assert.match(src, /applyDailyBottomBuyAccess/)
    assert.match(src, /redactDailyBottomBuyPayload/)
  })

  it("applyDailyBottomBuyAccess does not recompute count and does not force PRO access", () => {
    const apply = loadExportedFunction(
      join(root, "vite-project/src/utils/dailyBottomBuyApi.js"),
      "applyDailyBottomBuyAccess",
      "fetchDailyBottomBuySnapshot",
      { payloadHasProDetails, redactDailyBottomBuyPayload },
    )
    const full = {
      ok: true,
      access: "full",
      all: [
        {
          symbol: "SMH",
          theme: "반도체·AI 컴퓨팅",
          themeShort: "반도체·AI",
          role: "AI의 두뇌",
          ok: true,
          asOfDate: "2026-11-09",
          close: 470.61,
          rsi14: 33.6,
          stochK: 12.1,
          bbPctB: 0.08,
          ma20DevPct: -11.4,
          flags: { rsi: true, stoch: true, bb: true, ma20: true },
          count: 1,
          stage: { id: "wait", count: 1, label: "대기", priority: 3, splitHint: "대기" },
        },
      ],
      opportunities: [],
      watch: [],
      waiting: [],
    }
    full.waiting = [full.all[0]]

    const asPro = apply(full, true)
    assert.equal(asPro, full)
    assert.equal(asPro.access, "full")
    assert.equal(asPro.all[0].count, 1)
    assert.equal(asPro.all[0].rsi14, 33.6)

    const serverSummary = { ok: true, access: "summary", all: [{ symbol: "SMH", ok: true, count: 2, stage: { id: "watch", count: 2, label: "관심", priority: 2 } }], opportunities: [], watch: [], waiting: [] }
    const untouched = apply(serverSummary, true)
    assert.equal(untouched, serverSummary)
    assert.equal(untouched.access, "summary")
    assert.equal(untouched.all[0].count, 2)

    const asFree = apply(full, false)
    assert.notEqual(asFree, full)
    assert.equal(asFree.access, "summary")
    assert.equal(asFree.all[0].count, 1)
    assert.equal(asFree.all[0].stage.id, "wait")
    assert.equal(asFree.all[0].stage.label, "대기")
    assert.equal(asFree.all[0].rsi14, undefined)
    assert.equal(asFree.all[0].flags, undefined)
    assert.equal(asFree.all[0].close, undefined)
    assert.equal(payloadHasProDetails(asFree), false)
    assert.equal(full.all[0].count, 1)
    assert.equal(full.all[0].flags.rsi, true)

    const already = apply(asFree, false)
    assert.equal(already, asFree)
  })

  it("vite daily-bottom-buy middleware forwards Authorization like equity/me-membership", () => {
    const vite = readFileSync(join(root, "vite-project/vite.config.js"), "utf8")
    const start = vite.indexOf("function attachDailyBottomBuyDevApi")
    const end = vite.indexOf("function equityDailyBottomBuyDevApi")
    const dbbBlock = start >= 0 && end > start ? vite.slice(start, end) : ""
    assert.ok(dbbBlock.length > 0, "attachDailyBottomBuyDevApi block missing")
    assert.match(dbbBlock, /req\.headers\.authorization \|\| req\.headers\.Authorization/)
    assert.match(dbbBlock, /headers:\s*\{\s*authorization:\s*authHeader\s*\}/)
    assert.match(dbbBlock, /handleDailyBottomBuy/)
    // equity/me-membership already established the same auth-forward pattern.
    assert.match(vite, /function equityDailyBottomBuyDevApi/)
    assert.match(vite, /function attachMeMembershipDevApi/)
  })
})

describe("snapshot + hobby cap", () => {
  it("public static snapshot must be summary-only (no PRO detail leak via CDN)", () => {
    const snapPath = join(root, "vite-project/public/data/daily-bottom-buy-snapshot.json")
    assert.ok(existsSync(snapPath))
    const snap = JSON.parse(readFileSync(snapPath, "utf8"))
    assert.equal(snap.access, "summary")
    assert.equal(payloadHasProDetails(snap), false)
    for (const card of snap.all || []) {
      assert.equal(card.rsi14, undefined, card.symbol)
      assert.equal(card.stochK, undefined, card.symbol)
      assert.equal(card.bbPctB, undefined, card.symbol)
      assert.equal(card.ma20DevPct, undefined, card.symbol)
      assert.equal(card.flags, undefined, card.symbol)
      assert.equal(card.close, undefined, card.symbol)
      assert.equal(card.stage?.splitHint, undefined, card.symbol)
    }
  })

  it("snapshot generator writes redactDailyBottomBuyPayload output", () => {
    const gen = readFileSync(join(root, "scripts/generate-daily-bottom-buy-snapshot.mjs"), "utf8")
    assert.match(gen, /redactDailyBottomBuyPayload/)
    assert.match(gen, /summary-only/)
  })

  it("serverless entry count stays 12 (no new api/*.js entry)", () => {
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
        if (name.endsWith(".js")) out.push(name)
      }
    }
    walk(apiRoot)
    assert.equal(out.length, 12)
    assert.ok(!existsSync(join(root, "api/daily-bottom-buy.js")))
  })
})
