#!/usr/bin/env node
/**
 * US single-stock leadership study v2 (research only).
 *
 *   node scripts/equity-sell-backtest-v2.mjs
 *
 * Does not select a sell rule and does not modify the v1 event list.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  LOCKED_DEEP_EVENTS,
  SELECTED_STRATEGY,
  analyzeGroups,
  attachLeadership,
  correlateLeadership,
  eventIdentity,
  prepareSeries,
  sensitivityWithout,
  summarizeBySymbol,
  summarizeEvents,
  variableStats,
} from "./lib/equity-sell-backtest-v2.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V1_JSON = path.join(CACHE, "equity-sell-backtest-v1-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v2-result.json")

function loadSeries(symbol) {
  const cp = path.join(BAR_DIR, `${symbol.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) throw new Error(`missing price cache ${symbol}`)
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty price cache ${symbol}`)
  return prepareSeries(bars)
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.includes("FNTN")) throw new Error("FNTN is not a research ticker")
  if (EQUITY_SELL_RESEARCH_UNIVERSE.find((row) => row.symbol === "FTNT")?.name !== "Fortinet") {
    throw new Error("FTNT must be Fortinet")
  }
  const v1 = JSON.parse(fs.readFileSync(V1_JSON, "utf8"))
  if (v1.selectedStrategy !== null) throw new Error("v1 selectedStrategy changed")
  const v1Deep = v1.events.filter((event) => event.correctionDepth === 0.1)
  const series = new Map(symbols.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachLeadership(v1.events, series)
  const v1Keys = v1Deep.map((event) => eventIdentity(event).join("|"))
  const v2Keys = events.map((event) => eventIdentity(event).join("|"))
  if (v1Keys.length !== LOCKED_DEEP_EVENTS || v1Keys.join("\n") !== v2Keys.join("\n")) {
    throw new Error("v2 +10/-10 events do not match v1")
  }
  const all = summarizeEvents(events)
  if (all.n !== 494 || all.windowEnd.avg !== 16.73 || all.windowEnd.median !== 12.53) {
    throw new Error(`v1 path check failed n=${all.n} end=${all.windowEnd.avg}/${all.windowEnd.median}`)
  }
  const groups = analyzeGroups(events)
  if (groups.counts.HIGH + groups.counts.MID + groups.counts.LOW !== groups.scored) {
    throw new Error("group counts do not add up to scored events")
  }
  for (const event of events) {
    if (event.leadershipScore != null && (event.leadershipScore < 0 || event.leadershipScore > 100)) {
      throw new Error(`leadership score out of range ${event.ticker} ${event.t0Date}`)
    }
  }
  const doc = {
    researchOnly: true,
    selectedStrategy: SELECTED_STRATEGY,
    productionApplied: false,
    hypothesis:
      "A name with higher cross-sectional leadership on the day before a +10/-10 correction has a stronger later path than a name with lower leadership.",
    groupRule: "HIGH score>=70, MID 30<=score<70, LOW score<30. The score is the average of same-day percentiles and does not use prices after the correction date.",
    lookaheadRule: "Returns, up-day ratio, and 60-day position use closes strictly before the correction date.",
    v1EventCount: LOCKED_DEEP_EVENTS,
    v1Match: true,
    allEvents: all,
    variables: variableStats(events),
    groups,
    correlations: correlateLeadership(events),
    bySymbol: summarizeBySymbol(events),
    sensitivity: {
      dropTop5: sensitivityWithout(events, 5),
      dropTop10: sensitivityWithout(events, 10),
    },
    events,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("Equity leadership study v2 — research only, selectedStrategy null")
  console.log(
    `events ${events.length} scored ${groups.scored} unscored ${groups.unscored} HIGH ${groups.counts.HIGH} MID ${groups.counts.MID} LOW ${groups.counts.LOW}`,
  )
  console.log(JSON.stringify(groups.highMinusLow, null, 2))
  console.log(JSON.stringify(doc.correlations, null, 2))
  console.log(JSON.stringify(doc.sensitivity.dropTop5.dropped, null, 2))
  console.log(JSON.stringify(doc.sensitivity.dropTop5.highMinusLow.event, null, 2))
  console.log(JSON.stringify(doc.sensitivity.dropTop10.dropped, null, 2))
  console.log(JSON.stringify(doc.sensitivity.dropTop10.highMinusLow.event, null, 2))
}

main()
