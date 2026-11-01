#!/usr/bin/env node
/**
 * US single-stock within-ticker study of the v4 T0 < 0% sample (research only).
 *
 *   node scripts/equity-sell-backtest-v5.mjs
 *
 * Does not select a sell rule and does not modify v1–v4.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import {
  SELECTED_STRATEGY,
  analyzeInnerBuckets,
  comparisonTable,
  directionComparison,
  groupCompositions,
  leaveOneTickerOut,
  selectLt0Events,
  tickerControlledAssociation,
  tickerReports,
} from "./lib/equity-sell-backtest-v5.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V2_JSON = path.join(CACHE, "equity-sell-backtest-v2-result.json")
const V3_JSON = path.join(CACHE, "equity-sell-backtest-v3-result.json")
const V4_JSON = path.join(CACHE, "equity-sell-backtest-v4-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v5-result.json")

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || symbols.includes("FNTN")) throw new Error("research universe changed")
  const v2 = JSON.parse(fs.readFileSync(V2_JSON, "utf8"))
  const v3 = JSON.parse(fs.readFileSync(V3_JSON, "utf8"))
  const v4 = JSON.parse(fs.readFileSync(V4_JSON, "utf8"))
  const strategyOf = (doc) => (doc.selectedStrategy === undefined ? doc.metadata?.selectedStrategy : doc.selectedStrategy)
  if (strategyOf(v2) !== null || strategyOf(v3) !== null || strategyOf(v4) !== null) {
    throw new Error("prior selectedStrategy changed")
  }
  const v2Events = v2.events.filter((event) => event.correctionDepth === 0.1)
  const v3Events = v3.events.filter((event) => event.correctionDepth === 0.1)
  const events = selectLt0Events(v4.events, v3Events, v2Events)
  const reports = tickerReports(events)
  const table = comparisonTable(reports)
  const heldOut = leaveOneTickerOut(events)
  const compositions = groupCompositions(events)
  const weighting = directionComparison(events, reports)
  const inner = analyzeInnerBuckets(events)
  const tickerControl = tickerControlledAssociation(events)
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question:
        "Inside the fixed v4 T0 < 0% events, is the high-leadership path advantage repeated across tickers or carried by a few names?",
      eventCount: events.length,
      sampleRule: "Both HIGH and LOW need n >= 10 inside a ticker before a within-ticker comparison is interpretable. 5 to 9 is shown without a conclusion. Below 5 is not interpretable.",
      repeatedEvents:
        "Event-weighted results give every event one vote. Stock-weighted results average inside each ticker first. Within-stock comparisons keep only tickers where both groups have n >= 10.",
    },
    consistency: {
      events: events.length,
      groups: { HIGH: events.filter((event) => event.leadershipGroup === "HIGH").length, MID: events.filter((event) => event.leadershipGroup === "MID").length, LOW: events.filter((event) => event.leadershipGroup === "LOW").length },
      tickerEventSum: reports.reduce((sum, row) => sum + row.total, 0),
      leaveOneOutRemovedSum: heldOut.rows.reduce((sum, row) => sum + row.removed, 0),
      innerBucketSum: inner.reduce((sum, bucket) => sum + bucket.n, 0),
      v4Match: true,
    },
    tickers: reports,
    comparisonTable: table,
    leaveOneTickerOut: heldOut,
    compositions,
    weighting,
    innerBuckets: inner,
    tickerControl,
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      episodeStart: event.episodeStart,
      t0Date: event.t0Date,
      t0: event.t0,
      leadershipScore: event.leadershipScore,
      leadershipGroup: event.leadershipGroup,
      innerBucket: event.innerBucket,
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("Equity T0 < 0% within-ticker study v5 — research only, selectedStrategy null")
  console.log(`events ${events.length} HIGH ${compositions.HIGH.events} LOW ${compositions.LOW.events}`)
  console.log("comparison")
  for (const row of table) {
    if (row.total === 0) continue
    console.log(
      row.ticker,
      `n ${row.total} H ${row.high} L ${row.low}`,
      `T20 ${row.highT20}/${row.lowT20} d ${row.t20Diff}`,
      `W ${row.highWindow}/${row.lowWindow} d ${row.windowDiff}`,
      `reb ${row.highRebound}/${row.lowRebound} d ${row.reboundDiff}`,
      row.status,
    )
  }
  const top = heldOut.largestWindowImpact
  console.log("largest window impact", JSON.stringify(top))
  console.log("HIGH max share", compositions.HIGH.maxShare, "tickers", compositions.HIGH.tickers, "caution", compositions.HIGH.caution)
  console.log("LOW max share", compositions.LOW.maxShare, "tickers", compositions.LOW.tickers, "caution", compositions.LOW.caution)
  console.log("directions", JSON.stringify(weighting.windowDirection))
  console.log("within included", weighting.withinStock.includedCount, weighting.withinStock.includedTickers.join(","))
  for (const bucket of inner) {
    console.log(bucket.label, `n ${bucket.n} H ${bucket.high} L ${bucket.low}`, `T20 ${bucket.t20.highAvg}/${bucket.t20.lowAvg} d ${bucket.t20.diff}`, `W ${bucket.windowEnd.highAvg}/${bucket.windowEnd.lowAvg} d ${bucket.windowEnd.diff}`, `reb d ${bucket.reboundFromLow.diff}`, `add d ${bucket.additionalDrawdown.diff}`, bucket.status)
  }
  console.log("within spearman", JSON.stringify({ t20: tickerControl.t20.withinSpearman, window: tickerControl.windowEnd.withinSpearman, both: tickerControl.bothSides.tickers }))
  console.log("within regression window", JSON.stringify(tickerControl.windowEnd.withinRegression))
  console.log("within regression t20", JSON.stringify(tickerControl.t20.withinRegression))
}

main()
