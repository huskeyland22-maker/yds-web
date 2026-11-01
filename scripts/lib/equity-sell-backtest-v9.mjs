/**
 * US single-stock ATR decomposition study v9 (research only).
 *
 * Asks why a higher correction-day ATR(14)/price lines up with the later
 * rebound. Predictors stop at the correction close. No sell rule is selected.
 */

import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"
import { mean, median, sampleJudgment, spearman } from "./equity-sell-backtest-v2.mjs"
import { studentTwoTail } from "./equity-sell-backtest-v4.mjs"
import { describeRebound } from "./equity-sell-backtest-v6.mjs"
import { loadOhlcv, predictorBlock, selectMildEvents } from "./equity-sell-backtest-v7.mjs"

export { EQUITY_SELL_RESEARCH_UNIVERSE, loadOhlcv, selectMildEvents }

export const SELECTED_STRATEGY = null
export const LOCKED_EVENTS = 103
export const LOCKED_GROUPS = { HIGH: 15, MID: 53, LOW: 35 }

const ENTRY_KEYS = [
  ["t5", "t5"],
  ["t10", "t10"],
  ["t20", "t20"],
  ["t40", "t40"],
  ["window", "windowEnd"],
]
const MATRIX_ROWS = ["atrPct", "vol20", "correctionSpeed", "correctionDuration", "t0", "leadership", "atrOverVol"]
const MATRIX_COLS = ["t5", "t10", "t20", "t40", "window", "lowT10", "lowT20", "lowWindow"]
const MODEL_KEYS = [
  ["M0", "T0", ["t0"]],
  ["M1", "T0 + leadership", ["t0", "leadership"]],
  ["M2", "T0 + leadership + ATR14/price", ["t0", "leadership", "atrPct"]],
  ["M3", "T0 + leadership + ATR14/price + correction speed", ["t0", "leadership", "atrPct", "correctionSpeed"]],
  ["M4", "M3 + 20d realized volatility", ["t0", "leadership", "atrPct", "correctionSpeed", "vol20"]],
  ["M5", "M4 + ATR14/price ÷ 20d realized volatility", ["t0", "leadership", "atrPct", "correctionSpeed", "vol20", "atrOverVol"]],
]

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
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

function averageRanks(values) {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((a, b) => a.value - b.value)
  const ranks = new Array(values.length)
  for (let i = 0; i < indexed.length; ) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) j += 1
    const rank = (i + 1 + (j + 1)) / 2
    for (let k = i; k <= j; k++) ranks[indexed[k].index] = rank
    i = j + 1
  }
  return ranks
}

function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx
    const b = ys[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (dx === 0 || dy === 0) return null
  return num / Math.sqrt(dx * dy)
}

function solveLinear(matrix, vector) {
  const n = vector.length
  const a = matrix.map((row, index) => [...row, vector[index]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    const swap = a[col]
    a[col] = a[pivot]
    a[pivot] = swap
    const div = a[col][col]
    for (let j = col; j <= n; j++) a[col][j] /= div
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = a[row][col]
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j]
    }
  }
  return a.map((row) => row[n])
}

function residualize(y, controls) {
  const n = y.length
  const p = controls.length + 1
  if (n <= p) return null
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = Array(p).fill(0)
  for (let i = 0; i < n; i++) {
    const x = [1, ...controls.map((column) => column[i])]
    for (let a = 0; a < p; a++) {
      xty[a] += x[a] * y[i]
      for (let b = 0; b < p; b++) xtx[a][b] += x[a] * x[b]
    }
  }
  const beta = solveLinear(xtx, xty)
  if (!beta) return null
  return y.map((value, index) => {
    const x = [1, ...controls.map((column) => column[index])]
    return value - x.reduce((sum, item, j) => sum + item * beta[j], 0)
  })
}

export function partialSpearmanControls(rows) {
  const usable = rows.filter((row) => finite(row.x) && finite(row.y) && row.controls.every(finite))
  const width = rows[0]?.controls.length ?? 0
  if (usable.length < width + 3) return { n: usable.length, rho: null, judgment: sampleJudgment(usable.length) }
  const ranked = [usable.map((row) => row.x), usable.map((row) => row.y), ...usable[0].controls.map((_, index) => usable.map((row) => row.controls[index]))].map(averageRanks)
  const ex = residualize(ranked[0], ranked.slice(2))
  const ey = residualize(ranked[1], ranked.slice(2))
  if (!ex || !ey) return { n: usable.length, rho: null, judgment: sampleJudgment(usable.length) }
  return { n: usable.length, rho: round4(pearson(ex, ey)), judgment: sampleJudgment(usable.length) }
}

export function studyFactors(series, entryIdx, t0Idx) {
  const block = predictorBlock(series, entryIdx, t0Idx)
  if (!block.matched) return { matched: false }
  const atrPct = block.atrPct
  const vol20 = block.vol20
  return {
    matched: true,
    atrPct,
    atrLog: finite(atrPct) && atrPct > 0 ? Math.log(atrPct) : null,
    correctionSpeed: block.correctionSpeed,
    correctionDuration: block.correctionDuration,
    vol20,
    atrOverVol: finite(atrPct) && finite(vol20) && vol20 > 0 ? atrPct / vol20 : null,
  }
}

export function studyOutcomes(closes, entryIdx, t0Idx, entryPrice) {
  const described = describeRebound(closes, entryIdx, t0Idx, entryPrice)
  const entry = {}
  for (const [name, key] of ENTRY_KEYS) entry[name] = described.fromEntry[key]
  return {
    lowDay: described.lowDay,
    entry,
    low: {
      t5: described.afterLowFormed.t5,
      t10: described.afterLowFormed.t10,
      t20: described.afterLowFormed.t20,
      t40: described.afterLowFormed.t40,
      window: described.afterLowFormed.windowEnd,
    },
  }
}

function readFactor(event, id) {
  if (id === "leadership") return event.leadershipScore
  if (id === "t0") return event.t0
  return event.factors[id]
}

function readOutcome(event, id) {
  if (id.startsWith("low")) {
    const key = id === "lowT10" ? "t10" : id === "lowT20" ? "t20" : "window"
    return event.low[key]
  }
  return event.entry[id]
}

export function attachDecomposition(events, seriesBySymbol) {
  if (events.length !== LOCKED_EVENTS) throw new Error(`events ${events.length} !== ${LOCKED_EVENTS}`)
  const attached = events.map((event) => {
    const series = seriesBySymbol.get(event.ticker)
    if (!series) throw new Error(`missing series ${event.ticker}`)
    const entryIdx = dateIndex(series.dates, event.episodeStart)
    const t0Idx = dateIndex(series.dates, event.t0Date)
    if (entryIdx < 0 || t0Idx < 0) throw new Error(`missing dates ${event.eventId}`)
    const outcomes = studyOutcomes(series.closes, entryIdx, t0Idx, series.closes[entryIdx])
    if (outcomes.lowDay !== event.lowDay) throw new Error(`lowDay mismatch ${event.eventId}`)
    const factors = studyFactors(series, entryIdx, t0Idx)
    if (!factors.matched) throw new Error(`correction path does not match ${event.eventId}`)
    return { ...event, factors, entry: outcomes.entry, low: outcomes.low }
  })
  for (const key of Object.keys(LOCKED_GROUPS)) {
    const found = attached.filter((event) => event.leadershipGroup === key).length
    if (found !== LOCKED_GROUPS[key]) throw new Error(`${key} ${found} !== ${LOCKED_GROUPS[key]}`)
  }
  return assignAtrBands(attached)
}

export function assignAtrBands(events) {
  if (events.some((event) => !finite(event.factors.atrPct))) throw new Error("an event has no correction-day ATR")
  const ordered = [...events].sort((a, b) => a.factors.atrPct - b.factors.atrPct || a.eventId.localeCompare(b.eventId))
  const lowN = Math.floor(ordered.length / 3)
  const midN = Math.floor(ordered.length / 3)
  const bandOf = new Map()
  ordered.forEach((event, index) => {
    const band = index < lowN ? "LOW" : index < lowN + midN ? "MID" : "HIGH"
    bandOf.set(event.eventId, band)
  })
  const tagged = events.map((event) => ({ ...event, atrBand: bandOf.get(event.eventId) }))
  const span = (band) => tagged.filter((event) => event.atrBand === band).map((event) => event.factors.atrPct)
  const low = span("LOW")
  const mid = span("MID")
  const high = span("HIGH")
  tagged.bandCounts = { LOW: low.length, MID: mid.length, HIGH: high.length }
  tagged.bandEdges = {
    lowMax: Math.max(...low),
    midMin: Math.min(...mid),
    midMax: Math.max(...mid),
    highMin: Math.min(...high),
    lowMidTie: Math.max(...low) === Math.min(...mid),
    midHighTie: Math.max(...mid) === Math.min(...high),
  }
  return tagged
}

function level(values, scale) {
  const xs = values.filter(finite)
  return { n: xs.length, avg: round2(mean(xs) == null ? null : mean(xs) * scale), median: round2(median(xs) == null ? null : median(xs) * scale) }
}

function pack(events) {
  const out = { n: events.length }
  out.t0 = level(events.map((event) => event.t0), 100)
  for (const key of ["t5", "t10", "t20", "t40", "window"]) out[key] = level(events.map((event) => event.entry[key]), 100)
  for (const key of ["t10", "t20", "window"]) out[`low${key === "t10" ? "T10" : key === "t20" ? "T20" : "Window"}`] = level(events.map((event) => event.low[key]), 100)
  return out
}

function diff(left, right) {
  if (!finite(left) || !finite(right)) return null
  return round2(left - right)
}

export function correlationMatrix(events) {
  const table = {}
  for (const row of MATRIX_ROWS) {
    table[row] = {}
    for (const column of MATRIX_COLS) {
      table[row][column] = spearman(
        events
          .map((event) => ({ x: readFactor(event, row), y: readOutcome(event, column) }))
          .filter((pair) => finite(pair.x) && finite(pair.y)),
      )
    }
  }
  return table
}

const PARTIALS = [
  ["P1", ["t0"]],
  ["P2", ["leadership"]],
  ["P3", ["correctionSpeed"]],
  ["P4", ["t0", "leadership"]],
  ["P5", ["t0", "leadership", "correctionSpeed"]],
]

function partialFor(events, outcome) {
  return PARTIALS.map(([id, controls]) => {
    const rows = events
      .map((event) => ({
        x: event.factors.atrPct,
        y: readOutcome(event, outcome),
        controls: controls.map((key) => readFactor(event, key)),
      }))
      .filter((row) => finite(row.x) && finite(row.y) && row.controls.every(finite))
    const raw = spearman(rows.map((row) => ({ x: row.x, y: row.y })))
    const partial = partialSpearmanControls(rows)
    return { id, outcome, controls, rawRho: raw.rho, partialRho: partial.rho, n: partial.n }
  })
}

export function partialBlock(events) {
  return {
    window: partialFor(events, "window"),
    t20: partialFor(events, "t20"),
    lowWindow: partialFor(events, "lowWindow"),
    lowT20: partialFor(events, "lowT20"),
  }
}

function designRow(event, yKey) {
  const y = readOutcome(event, yKey)
  return {
    y: finite(y) ? y * 100 : null,
    t0: finite(event.t0) ? event.t0 * 100 : null,
    leadership: event.leadershipScore,
    atrPct: finite(event.factors.atrPct) ? event.factors.atrPct * 100 : null,
    correctionSpeed: finite(event.factors.correctionSpeed) ? event.factors.correctionSpeed * 100 : null,
    vol20: finite(event.factors.vol20) ? event.factors.vol20 * 100 : null,
    atrOverVol: event.factors.atrOverVol,
  }
}

export function fitInferred(rows, keys) {
  const usable = rows.filter((row) => finite(row.y) && keys.every((key) => finite(row[key])))
  const n = usable.length
  const p = keys.length + 1
  if (n <= p) return { n, r2: null, adjustedR2: null, coefficients: null }
  const xtx = Array.from({ length: p }, () => Array(p).fill(0))
  const xty = Array(p).fill(0)
  for (const row of usable) {
    const x = [1, ...keys.map((key) => row[key])]
    for (let i = 0; i < p; i++) {
      xty[i] += x[i] * row.y
      for (let j = 0; j < p; j++) xtx[i][j] += x[i] * x[j]
    }
  }
  const beta = solveLinear(xtx, xty)
  if (!beta) return { n, r2: null, adjustedR2: null, coefficients: null }
  const center = mean(usable.map((row) => row.y))
  let sse = 0
  let sst = 0
  for (const row of usable) {
    const fitted = beta[0] + keys.reduce((sum, key, index) => sum + beta[index + 1] * row[key], 0)
    sse += (row.y - fitted) ** 2
    sst += (row.y - center) ** 2
  }
  const r2 = sst === 0 ? null : 1 - sse / sst
  const adjustedR2 = r2 == null ? null : 1 - ((1 - r2) * (n - 1)) / (n - p)
  const df = n - p
  const sigma2 = df > 0 ? sse / df : null
  const names = ["intercept", ...keys]
  const coefficients = names.map((name, index) => {
    const unit = Array(p).fill(0)
    unit[index] = 1
    const column = sigma2 == null ? null : solveLinear(xtx, unit)
    const variance = column && sigma2 >= 0 ? sigma2 * column[index] : null
    const se = variance != null && variance >= 0 ? Math.sqrt(variance) : null
    const t = se != null && se > 1e-12 ? beta[index] / se : null
    return {
      name,
      coefficient: round4(beta[index]),
      standardError: se == null ? null : round4(se),
      t: t == null ? null : round4(t),
      pValue: t == null ? null : round4(studentTwoTail(t, df)),
    }
  })
  return { n, r2: round4(r2), adjustedR2: round4(adjustedR2), coefficients }
}

export function fitDecomposition(events) {
  const note = "Event-level OLS. The same ticker can contribute more than one event, so the events are not independent and a p-value is not a reason to adopt a sell rule. Returns, T0, ATR/price, correction speed, and 20-day volatility are in percent. Leadership stays on its 0–100 score. ATR/price ÷ volatility stays a ratio."
  const fitOutcome = (yKey) => {
    const rows = events.map((event) => designRow(event, yKey))
    const own = MODEL_KEYS.map(([id, label, keys]) => ({ id, label, sample: "available", ...fitInferred(rows, keys) }))
    const full = MODEL_KEYS[5][2]
    const common = rows.filter((row) => finite(row.y) && full.every((key) => finite(row[key])))
    const shared = MODEL_KEYS.map(([id, label, keys]) => ({ id, label, sample: "common", ...fitInferred(common, keys) }))
    return { own, shared }
  }
  return { t20: fitOutcome("t20"), window: fitOutcome("window"), note }
}

export function atrBandTable(events) {
  const bands = ["LOW", "MID", "HIGH"].map((band) => ({ band, ...pack(events.filter((event) => event.atrBand === band)) }))
  const high = bands.find((row) => row.band === "HIGH")
  const low = bands.find((row) => row.band === "LOW")
  const gaps = {}
  for (const key of ["t0", "t5", "t10", "t20", "t40", "window", "lowT10", "lowT20", "lowWindow"]) {
    gaps[key] = diff(high[key].avg, low[key].avg)
  }
  return { counts: events.bandCounts, edges: events.bandEdges, bands, highMinusLow: gaps }
}

export function presentCell(cell) {
  if (cell.n < 5) return { n: cell.n, status: "insufficient" }
  const values = {
    t10: cell.t10,
    t20: cell.t20,
    window: cell.window,
    lowT20: cell.lowT20,
    lowWindow: cell.lowWindow,
  }
  if (cell.n < 10) return { n: cell.n, status: "numbers_only", values }
  return { n: cell.n, status: "limited", values }
}

export function leadershipAtrGrid(events) {
  const cells = []
  for (const leadership of ["HIGH", "LOW"]) {
    for (const atr of ["HIGH", "LOW"]) {
      const rows = events.filter((event) => event.leadershipGroup === leadership && event.atrBand === atr)
      const packed = pack(rows)
      cells.push({
        leadership,
        atr,
        n: rows.length,
        t10: packed.t10,
        t20: packed.t20,
        window: packed.window,
        lowT20: packed.lowT20,
        lowWindow: packed.lowWindow,
        view: null,
      })
    }
  }
  return cells.map((cell) => ({ ...cell, view: presentCell(cell) }))
}

const DECOMPOSITION_VARS = [
  ["atrPct", "ATR14/price", 100],
  ["correctionSpeed", "correction speed", 100],
  ["correctionDuration", "correction duration", 1],
  ["leadership", "leadership", 1],
  ["t0", "T0", 100],
]

export function decompositionTable(events) {
  return DECOMPOSITION_VARS.map(([id, label, scale]) => {
    const high = level(events.filter((event) => event.leadershipGroup === "HIGH").map((event) => readFactor(event, id)), scale)
    const low = level(events.filter((event) => event.leadershipGroup === "LOW").map((event) => readFactor(event, id)), scale)
    const link = (outcome, controls) => {
      if (controls.includes(id)) return { rawRho: null, partialRho: null, n: null, note: "control duplicates the variable" }
      const rows = events
        .map((event) => ({
          x: readFactor(event, id),
          y: readOutcome(event, outcome),
          controls: controls.map((key) => readFactor(event, key)),
        }))
        .filter((row) => finite(row.x) && finite(row.y) && row.controls.every(finite))
      const raw = spearman(rows.map((row) => ({ x: row.x, y: row.y })))
      const partial = controls.length ? partialSpearmanControls(rows) : raw
      return { rawRho: raw.rho, partialRho: partial.rho, n: partial.n }
    }
    return {
      id,
      label,
      leadershipHighMinusLow: diff(high.avg, low.avg),
      highN: high.n,
      lowN: low.n,
      window: link("window", []),
      t20: link("t20", []),
      controlLeadership: link("window", ["leadership"]),
      controlT0: link("window", ["t0"]),
      controlSpeed: link("window", ["correctionSpeed"]),
    }
  })
}

export function judgeFade(horizons) {
  const needed = ["t5", "t10", "t20", "t40", "window"]
  if (needed.some((key) => !horizons[key] || horizons[key].n < 10 || !finite(horizons[key].rho))) return "표본 부족"
  const magnitude = (key) => Math.abs(horizons[key].rho)
  const early = (magnitude("t5") + magnitude("t10")) / 2
  const later = [magnitude("t20"), magnitude("t40"), magnitude("window")]
  const laterAvg = mean(later)
  if (early >= 0.2 && later.every((value) => value < 0.2) && laterAvg <= early - 0.15) return "지지"
  if (early >= 0.15 && laterAvg <= early - 0.05) return "약한 지지"
  return "기각"
}

export function judgeInteraction(fast, slow) {
  if (!fast || !slow || fast.n < 10 || slow.n < 10 || !finite(fast.rho) || !finite(slow.rho)) return "표본 부족"
  const gap = fast.rho - slow.rho
  if (gap >= 0.15 && fast.rho > 0) return "지지"
  if (gap > 0) return "약한 지지"
  return "기각"
}

export function judgeCombination(cells) {
  const byKey = Object.fromEntries(cells.map((cell) => [`${cell.leadership}|${cell.atr}`, cell]))
  const needed = ["HIGH|HIGH", "HIGH|LOW", "LOW|HIGH", "LOW|LOW"]
  if (needed.some((key) => !byKey[key] || byKey[key].n < 10)) return "표본 부족"
  const avg = (key) => byKey[key].window.avg
  if (needed.some((key) => !finite(avg(key)))) return "표본 부족"
  const combo = avg("HIGH|HIGH")
  const leadOnly = avg("HIGH|LOW")
  const atrOnly = avg("LOW|HIGH")
  const neither = avg("LOW|LOW")
  const atrInsideHigh = combo - leadOnly
  const atrInsideLow = atrOnly - neither
  if (atrInsideHigh >= 2 && atrInsideLow >= 2) return "기각"
  if (combo >= leadOnly + 5 && combo >= atrOnly + 5 && atrInsideLow < atrInsideHigh) return "지지"
  if (combo >= leadOnly && combo >= atrOnly) return "약한 지지"
  return "기각"
}

export function speedSplit(events) {
  const usable = events.filter((event) => finite(event.factors.correctionSpeed))
  const cut = median(usable.map((event) => event.factors.correctionSpeed))
  const side = (rows, outcome) =>
    spearman(rows.map((event) => ({ x: event.factors.atrPct, y: readOutcome(event, outcome) })).filter((pair) => finite(pair.x) && finite(pair.y)))
  const fast = usable.filter((event) => event.factors.correctionSpeed >= cut)
  const slow = usable.filter((event) => event.factors.correctionSpeed < cut)
  return {
    cut,
    fast: { n: fast.length, window: side(fast, "window"), t20: side(fast, "t20"), lowWindow: side(fast, "lowWindow") },
    slow: { n: slow.length, window: side(slow, "window"), t20: side(slow, "t20"), lowWindow: side(slow, "lowWindow") },
  }
}

export function judgeHypotheses(events, matrix, grid) {
  const fade = judgeFade(matrix.atrPct)
  const split = speedSplit(events)
  const interaction = judgeInteraction(
    { n: split.fast.window.n, rho: split.fast.window.rho },
    { n: split.slow.window.n, rho: split.slow.window.rho },
  )
  const t20Interaction = judgeInteraction(
    { n: split.fast.t20.n, rho: split.fast.t20.rho },
    { n: split.slow.t20.n, rho: split.slow.t20.rho },
  )
  let speedLabel = interaction
  if (interaction === "지지" && t20Interaction === "기각") speedLabel = "약한 지지"
  return {
    fade: { label: fade, rule: "지지 requires the T+5/T+10 ATR association to average at least 0.20 and every later horizon to stay under 0.20 and at least 0.15 lower. A smaller fade is 약한 지지. Otherwise 기각." },
    speed: { label: speedLabel, window: interaction, t20: t20Interaction, split, rule: "Events are split at the median correction speed. 지지 requires the fast half's ATR–window rho to exceed the slow half by at least 0.15. A smaller positive gap is 약한 지지." },
    combination: { label: judgeCombination(grid), rule: "All four leadership × ATR cells need n≥10. 기각 when the HIGH-ATR window average exceeds the LOW-ATR average by at least 2 points inside both leadership groups. 지지 when the joint cell leads each single cell by at least 5 points and the ATR gap is larger inside HIGH leadership." },
  }
}
