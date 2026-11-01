import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const { describe, it } = process.env.VITEST ? await import("vitest") : await import("node:test")
const assert = process.env.VITEST ? null : (await import("node:assert/strict")).default

import { EQUITY_SELL_RESEARCH_SELECTED_STRATEGY, EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY, existingBuyIndexes } from "./lib/equity-technical-sell-v1.mjs"
import { SELECTED_STRATEGY as WEEKLY_SELECTED_STRATEGY } from "./lib/equity-weekly-trend-sell-v1.mjs"
import {
  FOCUS_TICKERS,
  SELECTED_STRATEGY,
  TICKERS,
  auditLookAhead,
  classifyState,
  dailyTrendStates,
  forwardPath,
  judgeStateValue,
  sampleJudgment,
  stateSpells,
  trailingSma,
} from "./lib/equity-trend-state-research-v37.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const ORDER = ["AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL", "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST", "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD"]

function check(condition, message) {
  if (process.env.VITEST) {
    if (!condition) throw new Error(message)
    return
  }
  assert.equal(condition, true, message)
}

function addDays(date, days) {
  const [year, month, day] = date.split("-").map(Number)
  const stamp = new Date(Date.UTC(year, month - 1, day))
  stamp.setUTCDate(stamp.getUTCDate() + days)
  return stamp.toISOString().slice(0, 10)
}

function bar(date, close) {
  return { date, open: close, high: close, low: close, close, volume: 1 }
}

function fridays(count, closeAt, start = "2022-01-07") {
  return Array.from({ length: count }, (_, index) => bar(addDays(start, index * 7), closeAt(index)))
}

function cell(mean, median, winRate, hit10, n = 40) {
  return { n, mean, median, winRate, hit10 }
}

describe("v37 weekly trend states", () => {
  it("keeps the frozen 31-name universe", () => {
    check(TICKERS.length === 31, "ticker count")
    check(TICKERS.join() === ORDER.join(), "ticker order")
    check(EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol).join() === ORDER.join(), "universe import")
    check(FOCUS_TICKERS.join() === ["NVDA", "AMD", "AVGO", "CRWD", "PLTR", "TSLA"].join(), "focus names")
  })

  it("computes 20-week and 60-week averages without a state before 60 weeks", () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1)
    check(trailingSma(values, 20) === 10.5, "20-week SMA")
    check(trailingSma(values, 60) == null, "60-week SMA needs 60 points")
    const early = dailyTrendStates(fridays(20, (index) => index + 1))
    check(early.at(-1).ma20 === 10.5, "last 20-week SMA")
    check(early.at(-1).ma60 == null, "ma60 missing")
    check(early.at(-1).state == null, "no imputed state")
    const ready = dailyTrendStates(fridays(60, () => 10))
    check(ready.at(-1).ma20 === 10, "flat ma20")
    check(ready.at(-1).ma60 === 10, "flat ma60")
    check(ready.at(-1).state === "HOLD", "flat series is HOLD")
  })

  it("classifies HOLD, CAUTION, and RISK from the locked rules", () => {
    check(classifyState(10, 10, 10) === "HOLD", "equal averages are HOLD")
    check(classifyState(9, 10, 10) === "CAUTION", "close below a rising average is CAUTION")
    check(classifyState(80, 70, 90) === "RISK", "fast average below slow average is RISK")
    check(classifyState(10, 10, null) == null, "missing slow average")
    const caution = fridays(61, (index) => (index < 40 ? 100 : index === 60 ? 120 : 130))
    const cautionState = dailyTrendStates(caution).at(-1)
    check(cautionState.state === "CAUTION", "price path CAUTION")
    check(cautionState.weekClose < cautionState.ma20 && cautionState.ma20 >= cautionState.ma60, "CAUTION inequalities")
    const risk = dailyTrendStates(fridays(60, (index) => (index < 40 ? 100 : 70))).at(-1)
    check(risk.state === "RISK", "price path RISK")
    check(risk.ma20 < risk.ma60, "RISK is the average cross")
  })

  it("emits one transition when a state persists", () => {
    const details = [
      { date: "2024-01-02", state: "HOLD", close: 10, weekClose: 10, ma20: 10, ma60: 9 },
      { date: "2024-01-03", state: "HOLD", close: 10, weekClose: 10, ma20: 10, ma60: 9 },
      { date: "2024-01-04", state: "CAUTION", close: 9, weekClose: 9, ma20: 10, ma60: 9 },
      { date: "2024-01-05", state: "CAUTION", close: 9, weekClose: 9, ma20: 10, ma60: 9 },
      { date: "2024-01-08", state: "RISK", close: 8, weekClose: 8, ma20: 8, ma60: 9 },
      { date: "2024-01-09", state: "RISK", close: 8, weekClose: 8, ma20: 8, ma60: 9 },
      { date: "2024-01-10", state: "RISK", close: 8, weekClose: 8, ma20: 8, ma60: 9 },
    ]
    const { spells, transitions } = stateSpells(details)
    const named = transitions.filter((row) => row.kind !== "START")
    check(named.map((row) => row.kind).join() === "HOLD->CAUTION,CAUTION->RISK", "named transitions")
    check(spells.filter((spell) => spell.state === "RISK").length === 1, "one RISK spell")
    check(spells.find((spell) => spell.state === "RISK").days === 3, "RISK duration")
    check(named.filter((row) => row.to === "RISK").length === 1, "no repeated RISK event")
  })

  it("leaves an unfinished forward window missing", () => {
    const closes = Array.from({ length: 30 }, () => 10)
    closes[25] = 12
    closes[29] = 99
    const path = forwardPath(closes, 5, 20)
    check(Math.abs(path.ret - 0.2) < 1e-12, "T+20 uses the horizon close")
    check(forwardPath(closes, 5, 60) == null, "T+60 outside the window is missing")
    check(path.ret !== closes[29] / closes[5] - 1, "window end is not a substitute")
  })

  it("does not use a later close from the same week", () => {
    const bars = fridays(59, () => 10)
    const monday = addDays(bars.at(-1).date, 3)
    bars.push(bar(monday, 10))
    bars.push(bar(addDays(monday, 1), 1))
    const states = dailyTrendStates(bars)
    check(states.at(-2).date === monday, "monday position")
    check(states.at(-2).state === "HOLD", "monday uses its own close")
    check(states.at(-2).weekClose === 10, "monday week close")
    const withoutTuesday = dailyTrendStates(bars.slice(0, -1))
    check(withoutTuesday.at(-1).state === states.at(-2).state, "tuesday does not rewrite monday")
    check(auditLookAhead(bars).length === 0, "synthetic lookahead")
  })

  it("applies the sample-size labels and the locked display judgment", () => {
    check(sampleJudgment(4) === "결론 금지", "n below 5")
    check(sampleJudgment(7) === "결론 보류", "n from 5 to 9")
    check(sampleJudgment(10) === "제한적 해석", "n at least 10")
    const broad = { qualified: 12, worse: 10 }
    const adopt = judgeStateValue({
      HOLD: { 60: cell(0.08, 0.07, 0.7, 0.1), 120: cell(0.16, 0.14, 0.72, 0.12) },
      CAUTION: { 60: cell(0.05, 0.04, 0.6, 0.2), 120: cell(0.1, 0.08, 0.62, 0.22) },
      RISK: { 60: cell(0.01, 0, 0.5, 0.4), 120: cell(0.04, 0.02, 0.52, 0.45) },
    }, broad)
    check(adopt.label === "1. 채택 가능", "display gate")
    check(adopt.sellRule === "채택하지 않음", "display is not a sell")
    const reference = judgeStateValue({
      HOLD: { 60: cell(0.05, 0.04, 0.57, 0.2), 120: cell(0.08, 0.06, 0.58, 0.25) },
      CAUTION: { 60: cell(0.04, 0.03, 0.55, 0.22), 120: cell(0.07, 0.05, 0.56, 0.28) },
      RISK: { 60: cell(0.03, 0.02, 0.54, 0.3), 120: cell(0.06, 0.04, 0.55, 0.35) },
    }, broad)
    check(reference.label === "2. 참고용으로만 가치 있음", "small consistent gap")
    const flipped = judgeStateValue({
      HOLD: { 60: cell(0.02, 0.01, 0.5, 0.2), 120: cell(0.1, 0.08, 0.6, 0.2) },
      CAUTION: { 60: cell(0.04, 0.03, 0.55, 0.2), 120: cell(0.08, 0.06, 0.58, 0.25) },
      RISK: { 60: cell(0.06, 0.05, 0.6, 0.15), 120: cell(0.04, 0.02, 0.5, 0.4) },
    }, broad)
    check(flipped.label === "3. 의미 부족 → 폐기", "horizon sign flip")
    const thin = judgeStateValue({
      HOLD: { 60: cell(0.08, 0.07, 0.7, 0.1, 4), 120: cell(0.16, 0.14, 0.72, 0.12, 4) },
      CAUTION: { 60: cell(0.05, 0.04, 0.6, 0.2, 4), 120: cell(0.1, 0.08, 0.62, 0.22, 4) },
      RISK: { 60: cell(0.01, 0, 0.5, 0.4, 4), 120: cell(0.04, 0.02, 0.52, 0.45, 4) },
    }, { qualified: 0, worse: 0 })
    check(thin.label === "3. 의미 부족 → 폐기", "n below 10 cannot be adopted")
  })

  it("keeps selectedStrategy null and the frozen BUY counts", () => {
    check(SELECTED_STRATEGY === null, "v37 strategy")
    check(TECHNICAL_SELECTED_STRATEGY === null, "v35 strategy")
    check(WEEKLY_SELECTED_STRATEGY === null, "v36 strategy")
    check(EQUITY_SELL_RESEARCH_SELECTED_STRATEGY === null, "universe strategy")
    const prior = JSON.parse(readFileSync(join(root, "data", "equity-weekly-trend-sell-v1.json"), "utf8"))
    check(prior.selectedStrategy === null, "stored strategy")
    for (const symbol of ORDER) {
      const raw = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"))
      const count = existingBuyIndexes(raw.bars).length
      check(count === prior.buy.counts[symbol], `${symbol} BUY count`)
    }
  })
})
