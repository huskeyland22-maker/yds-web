/**
 * US single-stock ATR depth-versus-rebound study v10 (research only).
 *
 * Splits the correction-day ATR association into how deep the later low is
 * and how far price rebounds after that low. Drawdown is an outcome used as
 * a control, not an entry-time predictor. No sell rule is selected.
 */

import { mean, median, sampleJudgment, spearman } from "./equity-sell-backtest-v2.mjs"
import { describeRebound } from "./equity-sell-backtest-v6.mjs"
import { loadOhlcv, selectMildEvents } from "./equity-sell-backtest-v7.mjs"
import { leaveOneCorrelation } from "./equity-sell-backtest-v7.mjs"
import {
  assignAtrBands,
  fitInferred,
  partialSpearmanControls,
  presentCell,
  studyFactors,
} from "./equity-sell-backtest-v9.mjs"

export { loadOhlcv, selectMildEvents, leaveOneCorrelation, presentCell }

export const SELECTED_STRATEGY = null
export const LOCKED_EVENTS = 103
export const LOCKED_GROUPS = { HIGH: 15, MID: 53, LOW: 35 }
export const DEPTH_EDGES = [0.05, 0.1, 0.15]

const MODEL_KEYS = [
  ["M0", "T0", ["t0"]],
  ["M1", "T0 + leadership", ["t0", "leadership"]],
  ["M2", "T0 + leadership + ATR", ["t0", "leadership", "atrPct"]],
  ["M3", "M2 + drawdown to low", ["t0", "leadership", "atrPct", "drawdown"]],
  ["M4", "M3 + correction speed", ["t0", "leadership", "atrPct", "drawdown", "correctionSpeed"]],
  ["M5", "M4 + 20d realized volatility", ["t0", "leadership", "atrPct", "drawdown", "correctionSpeed", "vol20"]],
]
const PARTIALS = [
  ["P1", ["t0"]],
  ["P2", ["leadership"]],
  ["P3", ["drawdown"]],
  ["P4", ["t0", "leadership"]],
  ["P5", ["t0", "leadership", "drawdown"]],
]

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function finite(value) {
  return Number.isFinite(value)
}

function dateIndex(dates, date) {
  let lo = 0
  let hi = dates.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (dates[mid] === date) return mid
    if (dates[mid] < date) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}

export function priceIdentity(lowReturn, lowToWindow, entryToWindow) {
  if (!finite(lowReturn) || !finite(lowToWindow) || !finite(entryToWindow)) return { matched: false }
  const product = (1 + lowToWindow) * (1 + lowReturn)
  const direct = 1 + entryToWindow
  const reboundOnEntry = lowToWindow * (1 + lowReturn)
  const summed = reboundOnEntry + lowReturn
  return {
    matched: Math.abs(product - direct) <= 1e-9 && Math.abs(summed - entryToWindow) <= 1e-9,
    product,
    direct,
  }
}

export function depthBucket(drawdown) {
  if (!finite(drawdown)) return null
  if (drawdown < DEPTH_EDGES[0]) return "lt5"
  if (drawdown < DEPTH_EDGES[1]) return "m5"
  if (drawdown < DEPTH_EDGES[2]) return "m10"
  return "ge15"
}

export function attachDepth(events, seriesBySymbol) {
  if (events.length !== LOCKED_EVENTS) throw new Error(`events ${events.length} !== ${LOCKED_EVENTS}`)
  const attached = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (entryIdx < 0 || t0Idx < 0) throw new Error(`missing dates ${event.eventId}`)
    const described = describeRebound(series.closes, entryIdx, t0Idx, series.closes[entryIdx])
    if (described.lowDay !== event.lowDay) throw new Error(`lowDay mismatch ${event.eventId}`)
    const factors = studyFactors(series, entryIdx, t0Idx)
    if (!factors.matched) throw new Error(`correction path does not match ${event.eventId}`)
    const lowReturn = described.lowReturnFromEntry
    const lowToWindow = described.lowToWindowReturn
    const entryToWindow = described.fromEntry.windowEnd
    if (finite(lowReturn) && !priceIdentity(lowReturn, lowToWindow, entryToWindow).matched) {
      throw new Error(`price identity failed ${event.eventId}`)
    }
    return {
      ...event,
      factors,
      atrPct: factors.atrPct,
      correctionSpeed: factors.correctionSpeed,
      vol20: factors.vol20,
      lowDay: described.lowDay,
      lowReturn,
      drawdown: finite(lowReturn) ? -lowReturn : null,
      lowToT10: described.afterLowFormed.t10,
      lowToT20: described.afterLowFormed.t20,
      lowToWindow,
      entryToWindow,
      entryT10: described.fromEntry.t10,
      entryT20: described.fromEntry.t20,
    }
  })
  for (const key of Object.keys(LOCKED_GROUPS)) {
    const found = attached.filter((event) => event.leadershipGroup === key).length
    if (found !== LOCKED_GROUPS[key]) throw new Error(`${key} ${found} !== ${LOCKED_GROUPS[key]}`)
  }
  return assignDepthBands(assignAtrBands(attached))
}

function assignDepthBands(events) {
  const usable = events.filter((event) => finite(event.drawdown))
  const ordered = [...usable].sort((a, b) => a.drawdown - b.drawdown || a.eventId.localeCompare(b.eventId))
  const third = Math.floor(ordered.length / 3)
  const bandOf = new Map()
  ordered.forEach((event, index) => {
    const band = index < third ? "LOW" : index < third * 2 ? "MID" : "HIGH"
    bandOf.set(event.eventId, band)
  })
  const tagged = events.map((event) => ({ ...event, depthBand: bandOf.get(event.eventId) ?? null, depthBucket: depthBucket(event.drawdown) }))
  tagged.bandCounts = events.bandCounts
  tagged.bandEdges = events.bandEdges
  const depths = ["LOW", "MID", "HIGH"].map((band) => tagged.filter((event) => event.depthBand === band).length)
  tagged.depthCounts = { LOW: depths[0], MID: depths[1], HIGH: depths[2], missing: events.length - usable.length }
  return tagged
}

function link(events, xRead, yRead) {
  return spearman(events.map((event) => ({ x: xRead(event), y: yRead(event) })).filter((pair) => finite(pair.x) && finite(pair.y)))
}

export function depthCorrelations(events) {
  const atr = (event) => event.atrPct
  return {
    drawdown: link(events, atr, (event) => event.drawdown),
    lowReturn: link(events, atr, (event) => event.lowReturn),
    lowToWindow: link(events, atr, (event) => event.lowToWindow),
    entryToWindow: link(events, atr, (event) => event.entryToWindow),
    lowDay: link(events, atr, (event) => event.lowDay),
    lowToT10: link(events, atr, (event) => event.lowToT10),
    lowToT20: link(events, atr, (event) => event.lowToT20),
  }
}

function level(values, scale) {
  const xs = values.filter(finite)
  const avg = mean(xs)
  const mid = median(xs)
  return {
    n: xs.length,
    avg: round2(avg == null ? null : avg * scale),
    median: round2(mid == null ? null : mid * scale),
  }
}

function gap(left, right) {
  if (!finite(left) || !finite(right)) return null
  return round2(left - right)
}

export function atrBandDepth(events) {
  const read = {
    t0: [(event) => event.t0, 100],
    lowDay: [(event) => event.lowDay, 1],
    drawdown: [(event) => event.drawdown, 100],
    lowReturn: [(event) => event.lowReturn, 100],
    lowToT10: [(event) => event.lowToT10, 100],
    lowToT20: [(event) => event.lowToT20, 100],
    lowToWindow: [(event) => event.lowToWindow, 100],
    entryToWindow: [(event) => event.entryToWindow, 100],
  }
  const bands = ["LOW", "MID", "HIGH"].map((band) => {
    const rows = events.filter((event) => event.atrBand === band)
    const stats = { band, n: rows.length }
    for (const [key, [pick, scale]] of Object.entries(read)) stats[key] = level(rows.map(pick), scale)
    return stats
  })
  const high = bands.find((row) => row.band === "HIGH")
  const low = bands.find((row) => row.band === "LOW")
  const keys = ["drawdown", "lowDay", "lowToT10", "lowToT20", "lowToWindow", "entryToWindow"]
  return {
    counts: events.bandCounts,
    bands,
    highMinusLow: Object.fromEntries(keys.map((key) => [key, gap(high[key].avg, low[key].avg)])),
  }
}

function partialRows(events, controls) {
  return events
    .map((event) => ({
      x: event.atrPct,
      y: event.lowToWindow,
      controls: controls.map((key) => (key === "leadership" ? event.leadershipScore : key === "t0" ? event.t0 : event[key])),
    }))
    .filter((row) => finite(row.x) && finite(row.y) && row.controls.every(finite))
}

export function depthPartials(events) {
  return PARTIALS.map(([id, controls]) => {
    const rows = partialRows(events, controls)
    const raw = spearman(rows.map((row) => ({ x: row.x, y: row.y })))
    const partial = partialSpearmanControls(rows)
    return { id, controls, rawRho: raw.rho, partialRho: partial.rho, n: partial.n }
  })
}

function designRow(event, yKey) {
  const y = event[yKey]
  return {
    y: finite(y) ? y * 100 : null,
    t0: finite(event.t0) ? event.t0 * 100 : null,
    leadership: event.leadershipScore,
    atrPct: finite(event.atrPct) ? event.atrPct * 100 : null,
    drawdown: finite(event.drawdown) ? event.drawdown * 100 : null,
    correctionSpeed: finite(event.correctionSpeed) ? event.correctionSpeed * 100 : null,
    vol20: finite(event.vol20) ? event.vol20 * 100 : null,
  }
}

function slimFit(fit) {
  const pick = (name) => fit.coefficients?.find((row) => row.name === name) ?? null
  return {
    n: fit.n,
    r2: fit.r2,
    adjustedR2: fit.adjustedR2,
    atrPct: pick("atrPct"),
    drawdown: pick("drawdown"),
    leadership: pick("leadership"),
    t0: pick("t0"),
    coefficients: fit.coefficients,
  }
}

export function depthModels(events) {
  const note = "Event-level OLS. Drawdown to the low is an outcome used as a control, not a value known at the correction close. Repeated events from the same ticker are not independent, so a p-value is not a sell-rule threshold. Returns, T0, ATR/price, drawdown, correction speed, and 20-day volatility are in percent."
  const fitOutcome = (yKey) => {
    const rows = events.map((event) => designRow(event, yKey))
    const full = MODEL_KEYS[5][2]
    const common = rows.filter((row) => finite(row.y) && full.every((key) => finite(row[key])))
    const shared = MODEL_KEYS.map(([id, label, keys]) => ({ id, label, sample: "common", ...slimFit(fitInferred(common, keys)) }))
    const m2 = shared.find((row) => row.id === "M2")
    const m3 = shared.find((row) => row.id === "M3")
    return {
      shared,
      atrCoefficientChange: gap(m2.atrPct?.coefficient, m3.atrPct?.coefficient),
    }
  }
  return { lowToWindow: fitOutcome("lowToWindow"), entryToWindow: fitOutcome("entryToWindow"), note }
}

export function depthBuckets(events) {
  const order = [
    ["lt5", "drawdown < 5%"],
    ["m5", "5% <= drawdown < 10%"],
    ["m10", "10% <= drawdown < 15%"],
    ["ge15", "drawdown >= 15%"],
  ]
  return order.map(([id, label]) => {
    const rows = events.filter((event) => event.depthBucket === id)
    const association = link(rows, (event) => event.atrPct, (event) => event.lowToWindow)
    const view = rows.length < 5 ? { n: rows.length, status: "insufficient" } : rows.length < 10 ? { n: rows.length, status: "numbers_only" } : { n: rows.length, status: "limited" }
    return {
      id,
      label,
      n: rows.length,
      status: view.status,
      atr: level(rows.map((event) => event.atrPct), 100),
      lowToWindow: level(rows.map((event) => event.lowToWindow), 100),
      entryToWindow: level(rows.map((event) => event.entryToWindow), 100),
      spearman: association,
    }
  })
}

export function atrDepthGrid(events) {
  const cells = []
  for (const atr of ["HIGH", "LOW"]) {
    for (const depth of ["HIGH", "LOW"]) {
      const rows = events.filter((event) => event.atrBand === atr && event.depthBand === depth)
      cells.push({
        atr,
        depth,
        n: rows.length,
        lowToWindow: level(rows.map((event) => event.lowToWindow), 100),
        entryToWindow: level(rows.map((event) => event.entryToWindow), 100),
        lowToT20: level(rows.map((event) => event.lowToT20), 100),
      })
    }
  }
  return cells.map((cell) => ({ ...cell, view: presentCell({ n: cell.n, window: cell.entryToWindow, t10: cell.lowToWindow, t20: cell.lowToT20, lowT20: cell.lowToT20, lowWindow: cell.lowToWindow }) }))
}

export function leadershipDepth(events) {
  return ["HIGH", "MID", "LOW"].map((group) => {
    const rows = events.filter((event) => event.leadershipGroup === group)
    const status = rows.length < 5 ? "insufficient" : rows.length < 10 ? "numbers_only" : "limited"
    return {
      group,
      n: rows.length,
      status,
      atr: level(rows.map((event) => event.atrPct), 100),
      drawdown: level(rows.map((event) => event.drawdown), 100),
      lowToWindow: level(rows.map((event) => event.lowToWindow), 100),
      atrDrawdown: link(rows, (event) => event.atrPct, (event) => event.drawdown),
      atrRebound: link(rows, (event) => event.atrPct, (event) => event.lowToWindow),
    }
  })
}

export function judgeDepthPath(stats) {
  const values = [stats.depthRho, stats.reboundRho, stats.partialDepth, stats.partialAll]
  if (values.some((value) => !finite(value))) return "표본 부족"
  const drop = Math.abs(stats.reboundRho) - Math.abs(stats.partialDepth)
  if (Math.abs(stats.depthRho) >= 0.2 && drop >= 0.15 && Math.abs(stats.partialDepth) < 0.15) return "A"
  if (Math.abs(stats.partialDepth) >= 0.2 && drop < 0.08 && Math.abs(stats.depthRho) < 0.15 && Math.abs(stats.partialAll) >= 0.15) return "B"
  return "C"
}

export function pathSummary(events, partials) {
  const correlations = depthCorrelations(events)
  const byId = Object.fromEntries(partials.map((row) => [row.id, row]))
  const stats = {
    depthRho: correlations.drawdown.rho,
    reboundRho: correlations.lowToWindow.rho,
    entryRho: correlations.entryToWindow.rho,
    partialDepth: byId.P3.partialRho,
    partialAll: byId.P5.partialRho,
  }
  return {
    rows: [
      { path: "ATR → drawdown to low", rho: stats.depthRho, n: correlations.drawdown.n },
      { path: "ATR → low-to-window rebound", rho: stats.reboundRho, n: correlations.lowToWindow.n },
      { path: "ATR → entry-to-window return", rho: stats.entryRho, n: correlations.entryToWindow.n },
      { path: "ATR → low-to-window, drawdown controlled", rho: stats.partialDepth, n: byId.P3.n },
      { path: "ATR → low-to-window, T0 + leadership + drawdown controlled", rho: stats.partialAll, n: byId.P5.n },
    ],
    label: judgeDepthPath(stats),
    labels: {
      A: "ATR lines up with a deeper low, and the rebound association fades once that depth is held fixed.",
      B: "The rebound association remains after depth is held fixed, and ATR does not line up with a deeper low.",
      C: "Depth and the post-low rebound each account for part of the ATR association.",
    },
  }
}
