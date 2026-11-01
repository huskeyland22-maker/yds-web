#!/usr/bin/env node
/**
 * Does a higher correction-day ATR line up with a larger post-low rebound, a faster one, or both?
 *
 *   node scripts/equity-sell-backtest-v11.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v10.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  attachSpeed,
  atrHitTable,
  fixedClockRates,
  judgeReboundShape,
  leadershipAtrSpeed,
  leadershipHitTable,
  leaveOneCorrelation,
  loadOhlcv,
  selectMildEvents,
  sizeSpeedTable,
  speedCorrelations,
  speedPartials,
  withinRates,
} from "./lib/equity-sell-backtest-v11.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const V10_JSON = path.join(CACHE, "equity-sell-backtest-v10-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v11-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function closeEnough(left, right) {
  if (left == null && right == null) return true
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-10
}

function summarizeLeave(held) {
  return { baseline: held.baseline.rho, n: held.baseline.n, min: held.min, max: held.max, median: held.median, signFlips: held.signFlips }
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  const v10 = JSON.parse(fs.readFileSync(V10_JSON, "utf8"))
  if (strategyOf(v6) !== null || strategyOf(v10) !== null) throw new Error("prior selectedStrategy changed")
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachSpeed(selected, series)
  if (events.length !== v10.events.length) throw new Error("v10 event count differs")
  for (let index = 0; index < events.length; index++) {
    const prior = v10.events[index]
    const event = events[index]
    if (event.eventId !== prior.eventId || event.leadershipGroup !== prior.leadershipGroup) throw new Error(`v10 identity differs ${event.eventId}`)
    if (event.atrBand !== prior.atrBand) throw new Error(`ATR band differs ${event.eventId}`)
    if (!closeEnough(event.lowToWindow, prior.lowToWindow)) throw new Error(`window rebound differs ${event.eventId}`)
    if (!closeEnough(event.atrPct, prior.atrPct)) throw new Error(`ATR differs ${event.eventId}`)
  }
  const correlations = speedCorrelations(events)
  if (correlations.fromLow.window.rho !== v10.correlations.lowToWindow.rho) throw new Error("v10 rebound rho changed")
  const partials = speedPartials(events)
  const speed = sizeSpeedTable(events)
  const hypotheses = judgeReboundShape({
    windowRho: correlations.fromLow.window.rho,
    time5: correlations.times["5"],
    time10: correlations.times["10"],
    time20: correlations.times["20"],
  })
  const leave = {
    lowToWindow: summarizeLeave(leaveOneCorrelation(events, (event) => event.atrPct, (event) => event.lowToWindow)),
    lowToT10: summarizeLeave(leaveOneCorrelation(events, (event) => event.atrPct, (event) => event.fromLow.t10)),
    lowToT20: summarizeLeave(leaveOneCorrelation(events, (event) => event.atrPct, (event) => event.fromLow.t20)),
    hit10: summarizeLeave(leaveOneCorrelation(events, (event) => event.atrPct, (event) => event.hits["10"].days)),
  }
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "After the low, does a higher correction-day ATR(14)/price line up with a larger rebound, a faster rebound, or both?",
      hitTime: "Day 0 is the low session. The search starts on the next session. The low session is not treated as a hit. Events that never reach the level stay empty and are not assigned a large day count.",
      fromLow: "T+5, T+10, and T+20 are sessions after the low, not after the correction close. A missing bar stays empty. Segment returns are the close change over that span divided by the low close.",
      predictors: "ATR uses only prices through the correction close. Hit times, hit rates, and post-low returns are outcomes.",
      atrBands: "The same absolute ATR tertiles as v9 and v10: 34, 34, and 35.",
      dependence: "The same ticker can contribute more than one event. A rank correlation is not a sell rule.",
    },
    consistency: {
      events: events.length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      atrBands: events.bandCounts,
      withLow: events.filter((event) => event.lowDay != null).length,
    },
    atrHits: atrHitTable(events),
    leadershipHits: leadershipHitTable(events),
    sizeSpeed: speed,
    fixedClock: fixedClockRates(events),
    within10: withinRates(events),
    correlations,
    partials,
    leadershipAtr: leadershipAtrSpeed(events),
    leaveOneTickerOut: leave,
    hypotheses,
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      leadershipGroup: event.leadershipGroup,
      atrBand: event.atrBand,
      atrPct: event.atrPct,
      lowDay: event.lowDay,
      lowToWindow: event.lowToWindow,
      fromLow: event.fromLow,
      segments: event.segments,
      hits: event.hits,
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ATR rebound speed v11 — research only, selectedStrategy null")
  console.log("events", doc.consistency.events, doc.consistency.groups, "bands", events.bandCounts, "withLow", doc.consistency.withLow)
  for (const row of doc.atrHits) {
    console.log(
      `hit +${row.target}`,
      `L ${row.LOW.reached}/${row.LOW.eligible} ${row.LOW.rate}% med ${row.LOW.medianDays}`,
      `M ${row.MID.rate}% med ${row.MID.medianDays}`,
      `H ${row.HIGH.reached}/${row.HIGH.eligible} ${row.HIGH.rate}% med ${row.HIGH.medianDays}`,
      `rate ${row.highMinusLowRate} days ${row.medianDaysHighMinusLow} ${row.dayJudgment}`,
    )
  }
  console.log("size", JSON.stringify(speed.highMinusLow))
  for (const key of ["t5", "t10", "t20", "window"]) console.log("size rho", key, correlations.fromLow[key].rho, correlations.fromLow[key].n)
  for (const key of ["early", "mid", "late"]) console.log("segment", key, correlations.segments[key].rho, correlations.segments[key].n)
  for (const key of ["3", "5", "10", "15", "20"]) console.log("time rho", key, correlations.times[key].rho, correlations.times[key].n)
  for (const key of ["5", "10", "20"]) {
    const row = partials[key].find((item) => item.id === "P3")
    const all = partials[key].find((item) => item.id === "P5")
    console.log("partial", key, "raw", row.rawRho, "depth", row.partialRho, "all", all.partialRho, "n", row.n)
  }
  for (const row of doc.within10) console.log("within +10", row.band, JSON.stringify(row.rates))
  for (const row of doc.fixedClock) {
    const t10 = row.clocks[10]
    console.log("snapshot T+10", row.band, "5", t10["5"].rate, "10", t10["10"].rate, "20", t10["20"].rate, "n", t10["10"].n)
  }
  for (const cell of doc.leadershipAtr) console.log("cell", cell.leadership, cell.atr, cell.status, cell.n, "h10", cell.hit10.rate, cell.hit10.medianDays, "window", cell.lowToWindow.avg)
  for (const key of Object.keys(leave)) {
    const held = leave[key]
    console.log("loo", key, held.baseline, held.min, held.max, held.median, held.signFlips.join(",") || "none")
  }
  console.log("hypotheses", hypotheses.A, hypotheses.B, hypotheses.C)
}

main()
