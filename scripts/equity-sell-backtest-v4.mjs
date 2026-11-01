#!/usr/bin/env node
/**
 * US single-stock T0-controlled leadership study v4 (research only).
 *
 *   node scripts/equity-sell-backtest-v4.mjs
 *
 * Does not select a sell rule and does not modify v1–v3.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"
import { spearman } from "./lib/equity-sell-backtest-v2.mjs"
import {
  SELECTED_STRATEGY,
  analyzeBuckets,
  analyzeQuantiles,
  associationBlock,
  fitOutcomes,
  joinV3Events,
  lockedGroupCheck,
  pearsonCorrelation,
} from "./lib/equity-sell-backtest-v4.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const V2_JSON = path.join(CACHE, "equity-sell-backtest-v2-result.json")
const V3_JSON = path.join(CACHE, "equity-sell-backtest-v3-result.json")
const OUT_JSON = path.join(CACHE, "equity-sell-backtest-v4-result.json")

function main() {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const symbols = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
  if (symbols.length !== 31 || new Set(symbols).size !== 31 || symbols.includes("FNTN")) {
    throw new Error("research universe changed")
  }
  const v2 = JSON.parse(fs.readFileSync(V2_JSON, "utf8"))
  const v3 = JSON.parse(fs.readFileSync(V3_JSON, "utf8"))
  if (v2.selectedStrategy !== null || v3.selectedStrategy !== null) throw new Error("prior selectedStrategy changed")
  const v2Events = v2.events.filter((event) => event.correctionDepth === 0.1)
  const v3Events = v3.events.filter((event) => event.correctionDepth === 0.1)
  const events = joinV3Events(v2Events, v3Events)
  const consistency = lockedGroupCheck(events)
  if (!consistency.match) throw new Error(`v3 values differ:\n${consistency.mismatches.join("\n")}`)
  const scored = events.filter((event) => Number.isFinite(event.leadershipScore))
  const t0Link = {
    pearson: pearsonCorrelation(scored.map((event) => ({ x: event.leadershipScore, y: event.t0 }))),
    spearman: spearman(scored.map((event) => ({ x: event.leadershipScore, y: event.t0 }))),
  }
  const doc = {
    metadata: {
      researchOnly: true,
      selectedStrategy: SELECTED_STRATEGY,
      productionApplied: false,
      question:
        "Inside the same T0 return bucket, do high-leadership events still have a stronger path after a +10/-10 correction than low-leadership events?",
      eventCount: events.length,
      bucketRule: "Fixed cuts at 0, 5, 10, 15, and 20 percent of the stored v3 T0 return. Quantiles are a sensitivity check only.",
      repeatedEvents:
        "Thirty-one tickers contribute repeated events. Event-weighted results give every event one vote. Stock-weighted results average inside each ticker first.",
    },
    consistency,
    t0Buckets: analyzeBuckets(events),
    t0Quantiles: analyzeQuantiles(events),
    correlations: { leadershipVsT0: t0Link },
    partialCorrelations: associationBlock(events),
    regressions: fitOutcomes(events),
    eventWeighted: analyzeBuckets(events).map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      n: bucket.n,
      high: bucket.high,
      low: bucket.low,
      highMinusLow: bucket.highMinusLow.event,
    })),
    stockWeighted: analyzeBuckets(events).map((bucket) => ({
      id: bucket.id,
      label: bucket.label,
      n: bucket.n,
      high: bucket.stock.HIGH.n,
      low: bucket.stock.LOW.n,
      highMinusLow: bucket.highMinusLow.stock,
    })),
    events: events.map((event) => ({
      eventId: event.eventId,
      ticker: event.ticker,
      t0Date: event.t0Date,
      plus10Date: event.plus10Date,
      episodeStart: event.episodeStart,
      leadershipScore: event.leadershipScore,
      leadershipGroup: event.leadershipGroup,
      t0: event.t0,
      bucket: event.bucket,
    })),
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2))
  console.log("Equity T0-controlled leadership v4 — research only, selectedStrategy null")
  console.log(`events ${events.length} match ${consistency.match}`)
  console.log("leadership vs T0", JSON.stringify(t0Link))
  for (const bucket of doc.t0Buckets) {
    const row = bucket.highMinusLow.event
    console.log(
      bucket.label,
      `n ${bucket.n} H ${bucket.high} L ${bucket.low}`,
      `T20 ${row.t20.highAvg}/${row.t20.lowAvg} d ${row.t20.diff} ${row.t20.judgment} n ${row.t20.highN}/${row.t20.lowN}`,
      `W ${row.windowEnd.highAvg}/${row.windowEnd.lowAvg} d ${row.windowEnd.diff} ${row.windowEnd.judgment}`,
      `add ${row.additionalDrawdown.highAvg}/${row.additionalDrawdown.lowAvg} d ${row.additionalDrawdown.diff}`,
      `entry ${row.entryRecovery.highAvg}/${row.entryRecovery.lowAvg} d ${row.entryRecovery.diff}`,
    )
  }
  console.log(JSON.stringify(doc.partialCorrelations, null, 2))
  console.log(JSON.stringify(doc.regressions, null, 2))
}

main()
