#!/usr/bin/env node
/**
 * Do correction-day entry states separate later rebound size and speed?
 *
 *   node scripts/equity-sell-backtest-v12.mjs
 *
 * Research only. Does not select a sell rule and does not modify v1–v11.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  attachProfile,
  conditionalContrasts,
  continuousModels,
  judgeAssociation,
  judgeContrasts,
  leadershipAtrGrid,
  leaveOneCorrelation,
  loadOhlcv,
  predictorCorrelations,
  selectMildEvents,
  speedGrid,
  t0Links,
} from "./lib/equity-sell-backtest-v12.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const BAR_DIR = path.join(CACHE, "eq-ohlcv")
const V6_JSON = path.join(CACHE, "equity-sell-backtest-v6-result.json")
const V11_JSON = path.join(CACHE, "equity-sell-backtest-v11-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v12-result.json")

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

function beta(model, name) {
  return model.coefficients?.find((row) => row.name === name) ?? null
}

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v6 = JSON.parse(fs.readFileSync(V6_JSON, "utf8"))
  const v11 = JSON.parse(fs.readFileSync(V11_JSON, "utf8"))
  if (strategyOf(v6) !== null || strategyOf(v11) !== null) throw new Error("prior selectedStrategy changed")
  const selected = selectMildEvents(v6.events)
  const needed = [...new Set(selected.map((event) => event.ticker))]
  const series = new Map(needed.map((symbol) => [symbol, loadSeries(symbol)]))
  const events = attachProfile(selected, series)
  if (events.length !== v11.events.length) throw new Error("v11 event count differs")
  for (let index = 0; index < events.length; index++) {
    const prior = v11.events[index]
    const event = events[index]
    if (event.eventId !== prior.eventId || event.leadershipGroup !== prior.leadershipGroup || event.atrBand !== prior.atrBand) {
      throw new Error(`v11 identity differs ${event.eventId}`)
    }
    if (!closeEnough(event.lowToWindow, prior.lowToWindow)) throw new Error(`window rebound differs ${event.eventId}`)
    if (!closeEnough(event.hits["10"].days, prior.hits["10"].days)) throw new Error(`hit day differs ${event.eventId}`)
  }
  const correlations = predictorCorrelations(events)
  const t0 = t0Links(events)
  const grid = leadershipAtrGrid(events)
  const contrasts = conditionalContrasts(grid)
  const speeds = speedGrid(events)
  const models = continuousModels(events)
  const leave = {
    atrLowWindow: summarizeLeave(leaveOneCorrelation(events, (event) => event.predictors.atrPct, (event) => event.lowToWindow)),
    leadershipLowWindow: summarizeLeave(leaveOneCorrelation(events, (event) => event.predictors.leadership, (event) => event.lowToWindow)),
    atrHit10: summarizeLeave(leaveOneCorrelation(events, (event) => event.predictors.atrPct, (event) => event.hits["10"].days)),
  }
  const lowModel = models.lowToWindow.steps
  const judgments = {
    leadershipGivenAtr: judgeAssociation(lowModel[2].n, beta(lowModel[2], "leadership")?.standardizedBeta),
    atrGivenLeadership: judgeAssociation(lowModel[2].n, beta(lowModel[2], "atrPct")?.standardizedBeta),
    speedGivenLeadershipAtr: judgeAssociation(lowModel[3].n, beta(lowModel[3], "correctionSpeed")?.standardizedBeta),
    gridContrast: judgeContrasts(contrasts),
    speedGridCellsAtLeast10: speeds.filter((cell) => cell.n >= 10).length,
    singleTicker: leave.atrLowWindow.signFlips.length || leave.leadershipLowWindow.signFlips.length || leave.atrHit10.signFlips.length ? "약한 차이" : "차이 없음",
  }
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question: "Can correction-day entry states separate these events, and do later rebound size and speed differ across those states?",
      predictors: "ATR, realized volatility, correction speed, correction duration, and volume ratio use the v7 definitions through the correction close. The 50-day average and the 60- and 120-day ranges are the sessions strictly before the correction close. The correction close is the price placed against that prior average and range. The v8 within-stock ATR percentile is not an entry-state predictor.",
      speedSplit: "FAST is correction speed at or below the median of these events. SLOW is above that median. v7 correction speed is the peak-to-entry decline per session, so a larger value is a steeper decline. The split is fixed before the outcomes are read.",
      bands: "Leadership groups and ATR tertiles are the stored v2 and v9–v11 definitions. Thresholds are not refit.",
      dependence: "The same ticker can contribute more than one event. p-values and standardized betas are not a sell rule.",
    },
    consistency: {
      events: events.length,
      groups: {
        HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length,
        MID: events.filter((event) => event.leadershipGroup === "MID").length,
        LOW: events.filter((event) => event.leadershipGroup === "LOW").length,
      },
      atrBands: events.bandCounts,
      speedCut: events.speedCut,
      speedCounts: {
        FAST: events.filter((event) => event.speedSide === "FAST").length,
        SLOW: events.filter((event) => event.speedSide === "SLOW").length,
      },
    },
    correlations,
    t0,
    leadershipAtr: grid,
    contrasts,
    speedGrid: speeds,
    models,
    leaveOneTickerOut: leave,
    judgments,
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      leadershipGroup: event.leadershipGroup,
      atrBand: event.atrBand,
      speedSide: event.speedSide,
      predictors: event.predictors,
      entryPath: event.entryPath,
      lowToWindow: event.lowToWindow,
      hit10: event.hits["10"],
      hit20: event.hits["20"],
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("Entry-state profile v12 — research only, selectedStrategy null")
  console.log("events", doc.consistency.events, doc.consistency.groups, "bands", events.bandCounts, "speed", doc.consistency.speedCounts, "cut", events.speedCut)
  console.log("flagged", JSON.stringify(correlations.flagged))
  for (const pair of ["atrPct", "leadership", "correctionSpeed", "volumeRatio20", "vol20"]) {
    const row = correlations.matrix.atrPct[pair] || correlations.matrix.leadership[pair]
    console.log("focus", pair, correlations.matrix.atrPct[pair]?.rho, correlations.matrix.leadership[pair]?.rho)
  }
  for (const cell of grid) {
    const hit = cell.hit10
    console.log("cell", cell.leadership, cell.atr, cell.view.status, cell.n, "t10", cell.view.t10?.avg, "t20", cell.view.t20?.avg, "win", cell.view.window?.avg, "low", cell.view.lowWindow?.avg, "h10", hit.rate, hit.medianDays, hit.status)
  }
  for (const row of contrasts) console.log(row.id, row.judgment, row.leftN, row.rightN)
  for (const cell of speeds) console.log("speed", cell.leadership, cell.atr, cell.speed, cell.view.status, cell.n, cell.view.lowWindow?.avg ?? "", cell.view.hit10?.rate ?? "")
  for (const step of models.lowToWindow.steps) {
    console.log("low", step.id, "n", step.n, "r2", step.r2, "adj", step.adjustedR2, (step.coefficients ?? []).map((row) => `${row.name}:${row.coefficient}/${row.standardizedBeta}`).join(" "))
  }
  for (const row of models.lowToWindow.additions) console.log("add low", row.key, row.n, row.baseAdjustedR2, row.adjustedR2, row.adjustedDelta, row.note)
  for (const outcome of ["t20", "window"]) {
    for (const step of models[outcome].steps) console.log(outcome, step.id, step.n, step.r2, step.adjustedR2)
  }
  for (const key of Object.keys(leave)) {
    const held = leave[key]
    console.log("loo", key, held.baseline, held.min, held.max, held.median, held.signFlips.join(",") || "none")
  }
  console.log("judgments", JSON.stringify(judgments))
}

main()
