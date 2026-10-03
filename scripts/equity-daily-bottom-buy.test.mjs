/**
 * node --test scripts/equity-daily-bottom-buy.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, it } from "node:test"
import { EQUITY_CANDIDATES } from "./lib/daily-bottom-buy-cross-asset-validation.mjs"
import { drawdownFromRollingHigh } from "./lib/daily-bottom-buy-correction-stage-validation.mjs"
import { rollingDrawdownPct } from "./lib/daily-bottom-buy-cross-asset-validation.mjs"
import {
  COMMON_NOTE,
  FROZEN_THRESHOLDS,
  atrRisk,
  buildEquityDailyBottomBuyView,
  conditionFlags,
  equityUniverse,
  researchEquityUniverse,
  scoreState,
} from "./lib/equity-daily-bottom-buy.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function row(partial) {
  return { rsi14: 50, stochK: 50, bbPctB: 0.5, ma20DevPct: 0, ...partial }
}

describe("frozen condition flags", () => {
  it("keeps the four ceilings", () => {
    assert.equal(FROZEN_THRESHOLDS.rsiMax, 36)
    assert.equal(FROZEN_THRESHOLDS.stochKMax, 15.4)
    assert.equal(FROZEN_THRESHOLDS.bbPctBMax, 0.01)
    assert.equal(FROZEN_THRESHOLDS.ma20DevMax, -4.2)
    const hit = conditionFlags(row({ rsi14: 36, stochK: 15.4, bbPctB: 0.01, ma20DevPct: -4.2 }), FROZEN_THRESHOLDS)
    assert.deepEqual(hit, { rsi: true, stoch: true, bb: true, ma: true, count: 4 })
    const miss = conditionFlags(row({ rsi14: 36.01, stochK: 15.41, bbPctB: 0.011, ma20DevPct: -4.19 }), FROZEN_THRESHOLDS)
    assert.equal(miss.count, 0)
  })

  it("counts 0 through 4", () => {
    assert.equal(conditionFlags(row({}), FROZEN_THRESHOLDS).count, 0)
    assert.equal(conditionFlags(row({ rsi14: 30 }), FROZEN_THRESHOLDS).count, 1)
    assert.equal(conditionFlags(row({ rsi14: 30, stochK: 10 }), FROZEN_THRESHOLDS).count, 2)
    assert.equal(conditionFlags(row({ rsi14: 30, stochK: 10, bbPctB: 0 }), FROZEN_THRESHOLDS).count, 3)
    assert.equal(conditionFlags(row({ rsi14: 30, stochK: 10, bbPctB: 0, ma20DevPct: -5 }), FROZEN_THRESHOLDS).count, 4)
  })
})

describe("score and ATR labels", () => {
  it("maps score to the read-only states", () => {
    assert.equal(scoreState(0).label, "WAIT")
    assert.equal(scoreState(1).label, "WAIT")
    assert.equal(scoreState(2).label, "INTEREST")
    assert.equal(scoreState(3).label, "FIRST BUY CANDIDATE")
    assert.equal(scoreState(3).detail, "1차 매수 검토 후보")
    assert.equal(scoreState(4).label, "STRONG LOW CANDIDATE")
    assert.equal(scoreState(4).detail, "강한 과매도 후보")
    assert.match(scoreState(3).reading + scoreState(4).reading, /후보/)
    assert.equal(COMMON_NOTE, "저점 확정 신호는 아닙니다.")
  })

  it("maps ATR bands without a buy ban", () => {
    assert.equal(atrRisk(2.99).label, "낮은 변동성")
    assert.equal(atrRisk(3).label, "중간 변동성")
    assert.equal(atrRisk(3.99).label, "중간 변동성")
    assert.equal(atrRisk(4).label, "높은 변동성")
    assert.equal(atrRisk(null).label, null)
  })
})

describe("missing data", () => {
  it("does not invent a price or a score", () => {
    const empty = buildEquityDailyBottomBuyView({ symbol: "MSFT", group: "AI / Big Tech", name: "Microsoft" }, [])
    assert.equal(empty.ok, false)
    assert.equal(empty.price, null)
    assert.equal(empty.score, null)
    assert.equal(empty.conditions, null)
    assert.equal(empty.atrPct, null)
    assert.equal(empty.dd120, null)
    const short = buildEquityDailyBottomBuyView(
      { symbol: "MSFT", group: "AI / Big Tech", name: "Microsoft" },
      [{ date: "2024-01-02", open: 10, high: 11, low: 9, close: 10, volume: 1 }],
    )
    assert.equal(short.ok, false)
    assert.equal(short.price, null)
    assert.equal(short.message, "지표 계산에 필요한 데이터가 부족합니다.")
  })
})

describe("universe", () => {
  it("scans the 20 active names and keeps the 48-name research list", () => {
    const list = equityUniverse()
    const research = researchEquityUniverse()
    assert.equal(list.length, 20)
    assert.equal(research.length, 48)
    assert.deepEqual(
      research.map((row) => row.symbol),
      EQUITY_CANDIDATES.map((row) => row.symbol),
    )
    assert.equal(research.find((row) => row.symbol === "MSFT").name, "Microsoft")
    assert.equal(research.find((row) => row.symbol === "BRK.B").yahoo, "BRK-B")
    assert.equal(list.find((row) => row.symbol === "ETN").name, "Eaton")
    assert.equal(list.some((row) => row.symbol === "MSFT"), false)
    assert.equal(list.some((row) => row.symbol === "CRWD"), false)
  })
})

describe("etf production stays separate", () => {
  it("does not rewrite the ETF route or add a serverless function", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"))
    const etf = vercel.rewrites.find((row) => row.source === "/api/daily-bottom-buy")
    assert.equal(etf.destination, "/api/market-data?ydsMode=daily-bottom-buy")
    const equity = vercel.rewrites.find((row) => row.source === "/api/equity-daily-bottom-buy")
    assert.equal(equity.destination, "/api/market-data?ydsMode=equity-daily-bottom-buy")
    const page = readFileSync(join(root, "vite-project/src/pages/DailyBottomBuyPage.jsx"), "utf8")
    assert.doesNotMatch(page, /equityDailyBottomBuy|equity-daily-bottom-buy/)
    const engine = readFileSync(join(root, "api/_lib/dailyBottomBuyEngine.js"), "utf8")
    assert.doesNotMatch(engine, /equityDailyBottomBuy/)
  })
})

describe("handler", () => {
  it("returns an empty view when both live data and cache are missing", async () => {
    const { loadEquityDailyBottomBuy } = await import(
      pathToFileURL(join(root, "api/_lib/equityDailyBottomBuyHandler.js")).href
    )
    const result = await loadEquityDailyBottomBuy("AMZN", {
      fetchBars: async () => {
        throw new Error("offline")
      },
      readCache: () => null,
    })
    assert.equal(result.body.system, "equityDailyBottomBuy")
    assert.equal(result.body.universe.length, 20)
    assert.equal(result.body.view.symbol, "AMZN")
    assert.equal(result.body.view.ok, false)
    assert.equal(result.body.view.price, null)
    assert.equal(result.body.view.score, null)
    assert.equal(result.body.universe.some((row) => row.symbol === "MSFT"), false)
    assert.equal(EQUITY_CANDIDATES.some((row) => row.symbol === "MSFT"), true)
  })
})

describe("candidate display order", () => {
  it("shows 4/4 before 3/4 and keeps universe order within a score", async () => {
    const { selectEquityBuyCandidates } = await import(
      pathToFileURL(join(root, "vite-project/src/utils/equityDailyBottomBuyCandidates.js")).href
    )
    const universe = ["MSFT", "AAPL", "HD", "NEE"]
    const views = [
      { ok: true, symbol: "MSFT", score: 0 },
      { ok: true, symbol: "AAPL", score: 4 },
      { ok: true, symbol: "HD", score: 3 },
      { ok: true, symbol: "NEE", score: 4 },
    ]
    const picked = selectEquityBuyCandidates(views, universe)
    assert.deepEqual(picked.map((row) => row.symbol), ["AAPL", "NEE", "HD"])
  })
})

describe("candidate condition type", () => {
  it("labels A, B, and 4/4 from the existing condition flags", async () => {
    const { equityCandidateConditionType } = await import(
      pathToFileURL(join(root, "vite-project/src/utils/equityDailyBottomBuyCandidates.js")).href
    )
    const asView = (partial) => {
      const flags = conditionFlags(row(partial), FROZEN_THRESHOLDS)
      return {
        score: flags.count,
        conditions: [
          { id: "rsi", pass: flags.rsi },
          { id: "stoch", pass: flags.stoch },
          { id: "bb", pass: flags.bb },
          { id: "ma20", pass: flags.ma },
        ],
      }
    }
    const typeA = equityCandidateConditionType(asView({ rsi14: 30, stochK: 10, bbPctB: 0, ma20DevPct: -3 }))
    const typeB = equityCandidateConditionType(asView({ rsi14: 30, stochK: 10, bbPctB: 0.2, ma20DevPct: -5 }))
    const typeB2 = equityCandidateConditionType(asView({ rsi14: 50, stochK: 10, bbPctB: 0, ma20DevPct: -5 }))
    const typeB3 = equityCandidateConditionType(asView({ rsi14: 30, stochK: 40, bbPctB: 0, ma20DevPct: -5 }))
    const typeC = equityCandidateConditionType(asView({ rsi14: 30, stochK: 10, bbPctB: 0, ma20DevPct: -5 }))
    assert.equal(typeA.title, "A · 저위험 3/4")
    assert.equal(typeA.detail, "RSI + Stoch + BB")
    assert.equal(typeA.scoreText, "3/4")
    assert.equal(typeB.title, "B · 고변동 3/4")
    assert.equal(typeB.detail, "MA20 포함")
    assert.equal(typeB2.id, "B")
    assert.equal(typeB3.id, "B")
    assert.equal(typeC.title, "4/4 · 전체 조건")
    assert.equal(typeC.detail, "RSI + Stoch + BB + MA20")
    assert.equal(typeC.scoreText, "4/4")
    assert.equal(equityCandidateConditionType(conditionFlags(row({ rsi14: 30, stochK: 10, bbPctB: 0, ma20DevPct: -3 }), FROZEN_THRESHOLDS)).id, "A")
    assert.equal(equityCandidateConditionType(asView({ rsi14: 30, stochK: 10, bbPctB: 0.5, ma20DevPct: 0 })), null)
  })
})

describe("120-session high drawdown", () => {
  function sessionBars(spikeHigh) {
    const bars = []
    for (let i = 0; i < 140; i++) {
      const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10)
      const close = i === 139 ? 182.18 : 150
      bars.push({
        date,
        open: close,
        high: i === 40 ? spikeHigh : 110,
        low: 100,
        close,
        volume: 1,
      })
    }
    return bars
  }

  it("passes the session-high drawdown through the view without changing the score", () => {
    const meta = { symbol: "JNJ", group: "Healthcare", name: "Johnson & Johnson" }
    const withSpike = sessionBars(200)
    const flat = sessionBars(110)
    const spiked = buildEquityDailyBottomBuyView(meta, withSpike)
    const unspiked = buildEquityDailyBottomBuyView(meta, flat)
    const last = withSpike.length - 1
    const closes = withSpike.map((bar) => bar.close)
    assert.equal(spiked.ok, true)
    assert.equal(spiked.dd120, -8.91)
    assert.equal(spiked.dd120, Number(drawdownFromRollingHigh(withSpike, last, 120).toFixed(2)))
    assert.notEqual(spiked.dd120, Number(rollingDrawdownPct(closes, last, 120).toFixed(2)))
    assert.equal(spiked.score, unspiked.score)
    assert.notEqual(spiked.dd120, unspiked.dd120)
    assert.deepEqual(spiked.conditions.map((row) => row.pass), unspiked.conditions.map((row) => row.pass))
  })

  it("keeps drawdown out of candidate selection", async () => {
    const { selectEquityBuyCandidates, equityCandidateConditionType } = await import(
      pathToFileURL(join(root, "vite-project/src/utils/equityDailyBottomBuyCandidates.js")).href
    )
    const universe = ["JNJ", "HD"]
    const views = [
      { ok: true, symbol: "JNJ", score: 3, dd120: -8.91, conditions: [
        { id: "rsi", pass: true }, { id: "stoch", pass: true }, { id: "bb", pass: true }, { id: "ma20", pass: false },
      ] },
      { ok: true, symbol: "HD", score: 3, dd120: -21.18, conditions: [
        { id: "rsi", pass: true }, { id: "stoch", pass: true }, { id: "bb", pass: false }, { id: "ma20", pass: true },
      ] },
    ]
    assert.deepEqual(selectEquityBuyCandidates(views, universe).map((row) => row.symbol), ["JNJ", "HD"])
    assert.equal(equityCandidateConditionType(views[0]).title, "A · 저위험 3/4")
    assert.equal(equityCandidateConditionType(views[1]).title, "B · 고변동 3/4")
    const page = readFileSync(join(root, "vite-project/src/pages/EquityDailyBottomBuyPage.jsx"), "utf8")
    assert.match(page, /equityCandidateConditionType\(view\)/)
    assert.match(page, /120일 고점 대비/)
    const engine = readFileSync(join(root, "scripts/lib/equity-daily-bottom-buy.mjs"), "utf8")
    assert.match(engine, /drawdownFromRollingHigh\(bars, bars\.length - 1, 120\)/)
    assert.doesNotMatch(engine, /rollingDrawdownPct/)
  })
})
