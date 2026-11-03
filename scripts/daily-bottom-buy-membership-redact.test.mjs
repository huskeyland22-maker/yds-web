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
