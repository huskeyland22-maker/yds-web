import assert from "node:assert/strict"
import {
  buildPrioritizedStockEvents,
  buildStockWeekEventStrip,
  classifyStockEventPriority,
  stockEventDisplayTitle,
} from "../vite-project/src/content/ydsInvestmentCalendarEngine.js"

const refDate = new Date("2026-06-22T12:00:00")
const pickTickers = new Set(["MU", "TSM", "NVDA", "MSFT", "AMZN", "META"])
const activeSectors = new Set(["semi", "ai", "power"])

const muEvent = {
  id: "mu-test",
  date: "2026-06-25",
  ticker: "MU",
  name: "마이크롼",
  country: "US",
  category: "earnings",
  importance: 3,
  kind: "stock",
  impact: "positive",
  impactLabel: "긍정",
  impactNote: "",
  importanceStars: "★★★",
  categoryLabel: "실적발표",
}

const nkeEvent = {
  ...muEvent,
  id: "nke-test",
  ticker: "NKE",
  name: "나이키",
  date: "2026-06-26",
  importance: 2,
  importanceStars: "★★",
}

const asmlEvent = {
  ...muEvent,
  id: "asml-test",
  ticker: "ASML",
  name: "ASML",
  date: "2026-07-16",
}

assert.equal(stockEventDisplayTitle(muEvent), "마이크롼 실적 발표")

const muClass = classifyStockEventPriority(muEvent, pickTickers, activeSectors)
assert.equal(muClass?.priorityTier, "pick")
assert.ok(muClass?.impactLine.includes("추천종목"))

const nkeClass = classifyStockEventPriority(nkeEvent, pickTickers, activeSectors)
assert.equal(nkeClass?.priorityTier, "mega")
assert.ok(nkeClass?.impactLine.includes("소비주"))

const asmlClass = classifyStockEventPriority(asmlEvent, pickTickers, activeSectors)
assert.equal(asmlClass?.priorityTier, "sector")
assert.ok(asmlClass?.impactLine.includes("반도체"))

const list = buildPrioritizedStockEvents(null, refDate, 10, 35)
assert.ok(list.length > 0)
assert.ok(list[0].priorityRank <= list[list.length - 1].priorityRank || list[0].date <= list[1].date)
assert.ok(list.every((row) => row.eventTitle && row.impactLine))

const strip = buildStockWeekEventStrip(null, 5, refDate)
assert.ok(strip.stockItems.length > 0)
assert.ok(strip.stockItems.length <= 5)
assert.ok(strip.stockItems.some((row) => /실적 발표/.test(row.eventTitle)))

console.log("yds-stock-event-priority.test.mjs OK")
