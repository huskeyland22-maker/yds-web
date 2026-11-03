/**
 * FREE/PRO redaction for equity daily-bottom-buy (no live Yahoo).
 * node --test scripts/equity-daily-bottom-buy-membership-redact.test.mjs
 */
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import {
  equityPayloadHasProDetails,
  equityViewHasProDetails,
  redactEquityDailyBottomBuyPayload,
  redactEquityDailyBottomBuyView,
} from "../api/_lib/equityDailyBottomBuyRedact.js"
import { handleEquityDailyBottomBuy } from "../api/_lib/equityDailyBottomBuyHandler.js"

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

function sampleFullView() {
  return {
    ok: true,
    symbol: "AMZN",
    name: "Amazon",
    group: "AI / Big Tech",
    priority: 1,
    message: null,
    price: 180.5,
    asOf: "2026-11-03",
    source: "yahoo",
    score: 4,
    state: {
      id: "strongLow",
      label: "STRONG LOW CANDIDATE",
      detail: "강한 과매도 후보",
      reading: "4개 단기 조정 조건이 모두 충족된 강한 과매도 후보.",
    },
    note: "보조 신호",
    conditions: [
      { id: "rsi", label: "RSI", value: 30, thresholdText: "≤ 36", pass: true },
      { id: "stoch", label: "Stoch %K", value: 10, thresholdText: "≤ 15.4", pass: true },
      { id: "bb", label: "BB %B", value: 0.01, thresholdText: "≤ 0.01", pass: true },
      { id: "ma20", label: "MA20 Gap", value: -5, thresholdText: "≤ -4.2%", pass: true, unit: "%" },
    ],
    atrPct: 3.2,
    atrRisk: { band: "b3_4", label: "중간 변동성" },
    dd120: -12.5,
    atrNote: "note",
    atrMeaning: "meaning",
    readOnly: true,
  }
}

describe("equityDailyBottomBuyRedact", () => {
  it("keeps summary fields and strips PRO details from view", () => {
    const full = sampleFullView()
    assert.equal(equityViewHasProDetails(full), true)
    const summary = redactEquityDailyBottomBuyView(full)
    assert.equal(summary.symbol, "AMZN")
    assert.equal(summary.name, "Amazon")
    assert.equal(summary.group, "AI / Big Tech")
    assert.equal(summary.score, 4)
    assert.equal(summary.state.label, "STRONG LOW CANDIDATE")
    assert.equal(summary.state.detail, undefined)
    assert.equal(summary.state.reading, undefined)
    assert.equal(summary.price, undefined)
    assert.equal(summary.conditions, undefined)
    assert.equal(summary.atrPct, undefined)
    assert.equal(summary.atrRisk, undefined)
    assert.equal(summary.dd120, undefined)
    assert.equal(equityViewHasProDetails(summary), false)
  })

  it("redacts payload view and sets access summary", () => {
    const payload = {
      ok: true,
      system: "equityDailyBottomBuy",
      universe: [{ symbol: "AMZN" }],
      view: sampleFullView(),
    }
    assert.equal(equityPayloadHasProDetails(payload), true)
    const redacted = redactEquityDailyBottomBuyPayload(payload)
    assert.equal(redacted.access, "summary")
    assert.equal(equityPayloadHasProDetails(redacted), false)
    assert.ok(Array.isArray(redacted.universe))
  })
})

describe("handleEquityDailyBottomBuy membership access", () => {
  const fullBody = {
    ok: true,
    system: "equityDailyBottomBuy",
    universe: [{ symbol: "AMZN", name: "Amazon", group: "AI / Big Tech" }],
    view: sampleFullView(),
  }

  it("returns summary without details when not PRO", async () => {
    const res = mockRes()
    await handleEquityDailyBottomBuy(
      { method: "GET", query: { symbol: "AMZN" }, headers: {} },
      res,
      {
        requireProMembership: async () => ({
          ok: false,
          status: 401,
          body: { error: "missing_token" },
        }),
        load: async () => ({ status: 200, body: structuredClone(fullBody) }),
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.ok, true)
    assert.equal(res.state.body.access, "summary")
    assert.equal(equityPayloadHasProDetails(res.state.body), false)
    assert.equal(res.state.body.view.score, 4)
    assert.equal(res.state.body.view.conditions, undefined)
  })

  it("returns full payload for PRO", async () => {
    const res = mockRes()
    await handleEquityDailyBottomBuy(
      { method: "GET", query: { symbol: "AMZN" }, headers: { authorization: "Bearer tok" } },
      res,
      {
        requireProMembership: async () => ({
          ok: true,
          uid: "u1",
          membership: { plan: "pro", status: "active", source: null, updatedAt: null, reason: "plan_pro" },
        }),
        load: async () => ({ status: 200, body: structuredClone(fullBody) }),
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.access, "full")
    assert.equal(equityPayloadHasProDetails(res.state.body), true)
    assert.equal(res.state.body.view.conditions.length, 4)
    assert.equal(res.state.body.view.atrPct, 3.2)
  })

  it("membership lookup failure still returns summary not details", async () => {
    const res = mockRes()
    await handleEquityDailyBottomBuy(
      { method: "GET", query: { symbol: "AMZN" }, headers: { authorization: "Bearer tok" } },
      res,
      {
        requireProMembership: async () => ({
          ok: false,
          status: 500,
          body: { error: "membership_lookup_failed" },
        }),
        load: async () => ({ status: 200, body: structuredClone(fullBody) }),
      },
    )
    assert.equal(res.state.statusCode, 200)
    assert.equal(res.state.body.access, "summary")
    assert.equal(equityPayloadHasProDetails(res.state.body), false)
  })

  it("logged-in FREE member gets the same summary as anonymous (no analysis gap)", async () => {
    const anon = mockRes()
    const free = mockRes()
    const load = async () => ({ status: 200, body: structuredClone(fullBody) })
    await handleEquityDailyBottomBuy(
      { method: "GET", query: { symbol: "AMZN" }, headers: {} },
      anon,
      {
        requireProMembership: async () => ({
          ok: false,
          status: 401,
          body: { error: "missing_token" },
        }),
        load,
      },
    )
    await handleEquityDailyBottomBuy(
      { method: "GET", query: { symbol: "AMZN" }, headers: { authorization: "Bearer tok" } },
      free,
      {
        requireProMembership: async () => ({
          ok: false,
          status: 403,
          body: { error: "pro_required", plan: "free", reason: "missing_row" },
        }),
        load,
      },
    )
    assert.equal(anon.state.body.access, "summary")
    assert.equal(free.state.body.access, "summary")
    assert.equal(equityPayloadHasProDetails(anon.state.body), false)
    assert.equal(equityPayloadHasProDetails(free.state.body), false)
    assert.equal(anon.state.body.view.score, free.state.body.view.score)
    assert.equal(anon.state.body.view.conditions, undefined)
    assert.equal(free.state.body.view.conditions, undefined)
    assert.equal(anon.state.body.view.atrPct, undefined)
    assert.equal(free.state.body.view.atrPct, undefined)
  })
})

describe("equity gate wiring + hobby cap + no public equity snapshot", () => {
  it("client API uses Bearer and applyEquityDailyBottomBuyAccess", () => {
    const src = readFileSync(join(root, "vite-project/src/utils/equityDailyBottomBuyApi.js"), "utf8")
    assert.match(src, /withOptionalBearerAuth/)
    assert.match(src, /applyEquityDailyBottomBuyAccess/)
    assert.match(src, /redactEquityDailyBottomBuyPayload/)
  })

  it("page gates PRO blocks with membership visibility", () => {
    const page = readFileSync(join(root, "vite-project/src/pages/EquityDailyBottomBuyPage.jsx"), "utf8")
    assert.match(page, /useMembership/)
    assert.match(page, /buildEquityDailyBottomBuyVisibility/)
    assert.match(page, /YdsProFeatureGate/)
    assert.match(page, /applyEquityDailyBottomBuyAccess/)
  })

  it("no public equity daily-bottom-buy snapshot JSON under public/data", () => {
    const dataDir = join(root, "vite-project/public/data")
    assert.ok(existsSync(dataDir))
    const names = readdirSync(dataDir)
    assert.ok(!names.some((n) => /equity.*daily.*bottom|equity-daily-bottom/i.test(n)))
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
    assert.ok(!existsSync(join(root, "api/equity-daily-bottom-buy.js")))
  })
})
