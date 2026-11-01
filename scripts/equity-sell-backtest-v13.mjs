#!/usr/bin/env node
/**
 * Does the correction-day ATR association stay in place when the sample definition changes?
 *
 *   node scripts/equity-sell-backtest-v13.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v12.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  BOOTSTRAP_REPS,
  BOOTSTRAP_SEED,
  PERMUTATION_REPS,
  SELECTED_STRATEGY,
  assertBaseline,
  attachProfile,
  baselineLinks,
  bootstrapSpearman,
  clusterBootstrap,
  edgeEvents,
  extremeLinks,
  intradayStudy,
  judgeRobustness,
  loadOhlcv,
  logCheck,
  lowWindowGroups,
  lowWindowPairs,
  mulberry32,
  periodLinks,
  permutationRank,
  robustnessMatrix,
  selectMildEvents,
  speedModels,
  stockLinks,
  tailContrast,
  volatilityModels,
} from "./lib/equity-sell-backtest-v13.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v13-result.json")

function loadSeries(symbol) {
  const raw = JSON.parse(fs.readFileSync(path.join(BAR_DIR, `${symbol}.json`), "utf8"))
  const bars = Array.isArray(raw) ? raw : raw.bars
  if (!Array.isArray(bars) || !bars.length) throw new Error(`empty cache ${symbol}`)
  return loadOhlcv(bars)
}

function strategyOf(doc) {
  return doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy
}

function round4(value) {
  return Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  if (strategyOf(v6) !== null) throw new Error("v6 selectedStrategy changed")
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachProfile(selected, series)
  const links = baselineLinks(events)
  assertBaseline(events, links)
  const tails = {
    0.25: tailContrast(events, 0.25),
    0.2: tailContrast(events, 0.2),
    0.3: tailContrast(events, 0.3),
  }
  const logged = logCheck(events)
  const periods = periodLinks(events)
  const stock = stockLinks(events)
  const edges = edgeEvents(events)
  const extremes = extremeLinks(events)
  const intraday = intradayStudy(events, series)
  const pairs = lowWindowPairs(events)
  const eventBootstrap = bootstrapSpearman(pairs, BOOTSTRAP_REPS, mulberry32(BOOTSTRAP_SEED))
  const tickerBootstrap = clusterBootstrap(lowWindowGroups(events), BOOTSTRAP_REPS, mulberry32(BOOTSTRAP_SEED + 1))
  const permutation = permutationRank(pairs, PERMUTATION_REPS, mulberry32(BOOTSTRAP_SEED + 2))
  const volatility = volatilityModels(events)
  const speed = speedModels(events)
  const matrix = robustnessMatrix({ links, tails, edges, extremes, periods, stock })
  const judgment = judgeRobustness(matrix)
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Does the correction-day ATR association with the post-low rebound remain when the cut, clock, period, weight, or extreme values change?",
      hitRate: "Hit-rate associations are Spearman correlations between ATR/price and a 1/0 indicator for whether the rebound level was reached. Reached events are not given an imputed day count in the timing correlation.",
      tails: "Bottom and top shares use floor(n times the share), ordered by ATR/price with event id as the tie break. The middle is left out of that comparison. Cuts are not refit after the results.",
      periods: "A is 2016-01-01 through 2020-12-31, B is 2021-01-01 through 2023-12-31, and C is 2024-01-01 through the latest correction date. The cuts are not moved after the results.",
      bootstrap: "Event bootstrap resamples the 102 events with a low. Ticker bootstrap resamples those tickers with replacement and keeps every selected event. Neither interval treats repeated events as independent, and neither is a sell-rule threshold.",
      magnitudeFloor: "A sufficient low-to-window rho below 0.20 is treated as a large drop from the 0.4107 baseline.",
      notASellRule: "This is not evidence for a sell rule.",
    },
    consistency: {
      events: events.length,
      lowEvents: events.filter((event) => event.lowDay != null).length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      atrBands: events.bandCounts,
    },
    links,
    tails,
    log: logged,
    periods,
    stock,
    edges,
    extremes,
    intraday,
    bootstrap: {
      observed: links.lowWindow.rho,
      event: { ...eventBootstrap, p2_5: round4(eventBootstrap.p2_5), p50: round4(eventBootstrap.p50), p97_5: round4(eventBootstrap.p97_5) },
      ticker: { ...tickerBootstrap, p2_5: round4(tickerBootstrap.p2_5), p50: round4(tickerBootstrap.p50), p97_5: round4(tickerBootstrap.p97_5) },
    },
    permutation: { ...permutation, observed: round4(permutation.observed) },
    volatility,
    speed,
    matrix,
    judgment,
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("ATR robustness v13 — research only, selectedStrategy null")
  console.log("baseline", doc.consistency.events, doc.consistency.lowEvents, events.bandCounts, links.lowWindow.rho, links.lowT10.rho, links.lowT20.rho, links.hitTime10.rho)
  console.log("judgment", judgment.detail, judgment.label)
  for (const row of matrix) console.log(row.id, row.lowWindow.rho, row.lowWindow.n, row.lowT20.rho, row.lowT20.n, row.hit10.rho, row.hit10.n, row.sign)
  console.log("bootstrap event", doc.bootstrap.event.p2_5, doc.bootstrap.event.p50, doc.bootstrap.event.p97_5)
  console.log("bootstrap ticker", doc.bootstrap.ticker.p2_5, doc.bootstrap.ticker.p50, doc.bootstrap.ticker.p97_5, "tickers", doc.bootstrap.ticker.tickers)
  console.log("permutation", permutation.observed, permutation.percentile, permutation.shareAtLeastObserved)
  console.log("intraday", intraday.status, intraday.n, intraday.intraday?.rebound?.rho, intraday.close?.rebound?.rho)
  console.log("log r2", logged.raw.r2, logged.log.r2, "sameRank", logged.sameRank)
  for (const name of ["atr", "vol", "both"]) console.log("volmodel", name, volatility[name].n, volatility[name].r2, volatility[name].adjustedR2, JSON.stringify(volatility[name].standardizedBeta))
  console.log("vif", JSON.stringify(volatility.vif))
  for (const key of ["t20", "window", "lowWindow"]) console.log("speed", key, speed[key].atr.adjustedR2, speed[key].withSpeed.adjustedR2, speed[key].withSpeed.standardizedBeta.atrPct, speed[key].withSpeed.standardizedBeta.correctionSpeed)
}

main()
