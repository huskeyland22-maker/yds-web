/**
 * node --test scripts/equity-daily-bottom-buy.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { describe, it } from "node:test"
import { EQUITY_CANDIDATES } from "./lib/daily-bottom-buy-cross-asset-validation.mjs"
import {
  COMMON_NOTE,
  FROZEN_THRESHOLDS,
  atrRisk,
  buildEquityDailyBottomBuyView,
  conditionFlags,
  equityUniverse,
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
  it("reuses the 48 study names and groups", () => {
    const list = equityUniverse()
    assert.equal(list.length, 48)
    assert.deepEqual(
      list.map((row) => row.symbol),
      EQUITY_CANDIDATES.map((row) => row.symbol),
    )
    assert.deepEqual(
      list.map((row) => row.group),
      EQUITY_CANDIDATES.map((row) => row.group),
    )
    assert.equal(list.find((row) => row.symbol === "MSFT").name, "Microsoft")
    assert.equal(list.find((row) => row.symbol === "BRK.B").yahoo, "BRK-B")
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
    const result = await loadEquityDailyBottomBuy("MSFT", {
      fetchBars: async () => {
        throw new Error("offline")
      },
      readCache: () => null,
    })
    assert.equal(result.body.system, "equityDailyBottomBuy")
    assert.equal(result.body.universe.length, 48)
    assert.equal(result.body.view.ok, false)
    assert.equal(result.body.view.price, null)
    assert.equal(result.body.view.score, null)
  })
})
