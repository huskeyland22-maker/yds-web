/**
 * ETF correction-path study v8 (research only).
 *
 * T0 is the first -10% close after +10%, using the v6 peak.
 * A checkpoint may use only closes from T0 through that checkpoint.
 * Returns, peak recovery, and later drawdowns are measured on later bars.
 * No sell rule is selected.
 */

import { median } from "./etf-sell-backtest.mjs"
import { describeCorrection, locateProfitCorrection, speedBucket, speedCuts } from "./etf-sell-backtest-v6.mjs"

export { describeCorrection, locateProfitCorrection, speedBucket, speedCuts }

export const CHECKPOINTS = [1, 3, 5, 7, 10]
export const OUTCOME_OFFSETS = [10, 20, 40]
export const DD_LEVELS = [3, 5, 7, 10]
export const REBOUND_LEVELS = [3, 5, 7, 10]
const EPS = 1e-9
const LEVEL_EPS = 1e-12

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function pct(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return null
  return round2(fraction * 100)
}

function mean(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

function share(flags) {
  if (!flags.length) return null
  return (flags.filter(Boolean).length / flags.length) * 100
}

function gate(n) {
  return { sample_small: n < 10, no_conclusion: n < 5 }
}

export function observeThrough(closes, t0, t0Price, entry, idx) {
  let runLow = t0Price
  let minPrice = t0Price
  let maxRebound = 0
  const hit = { 3: false, 5: false, 7: false, 10: false }
  const bases = []
  let rebreak = false
  for (let j = t0 + 1; j <= idx; j++) {
    const rise = runLow > 0 ? (closes[j] - runLow) / runLow : 0
    if (rise > maxRebound) maxRebound = rise
    const fresh = []
    for (const level of REBOUND_LEVELS) {
      if (!hit[level] && rise + LEVEL_EPS >= level / 100) {
        hit[level] = true
        fresh.push(runLow)
      }
    }
    if (bases.some((low) => closes[j] < low)) rebreak = true
    bases.push(...fresh)
    if (closes[j] < minPrice) minPrice = closes[j]
    if (closes[j] < runLow) runLow = closes[j]
  }
  const price = closes[idx]
  const mae = t0Price > 0 ? Math.max(0, (t0Price - minPrice) / t0Price) : null
  return {
    idx,
    price,
    additionalMae: mae,
    dd3: mae != null && mae + LEVEL_EPS >= 0.03,
    dd5: mae != null && mae + LEVEL_EPS >= 0.05,
    dd7: mae != null && mae + LEVEL_EPS >= 0.07,
    dd10: mae != null && mae + LEVEL_EPS >= 0.1,
    maxRebound,
    reboundNow: minPrice > 0 ? (price - minPrice) / minPrice : null,
    reb3: hit[3],
    reb5: hit[5],
    reb7: hit[7],
    reb10: hit[10],
    vsEntry: entry > 0 ? (price - entry) / entry : null,
    vsT0: t0Price > 0 ? (price - t0Price) / t0Price : null,
    entryPosition: price <= entry ? "AT_OR_BELOW_ENTRY" : "ABOVE_ENTRY",
    rebreak,
  }
}

export function outcomesAfter(closes, described, checkpointIdx) {
  const { entry, end, peak, t0, t0Price } = described
  const price = closes[checkpointIdx]
  const at = (offset) => {
    const idx = t0 + offset
    if (idx <= checkpointIdx || idx > end || idx >= closes.length) return null
    return {
      vsEntry: (closes[idx] - entry) / entry,
      vsT0: t0Price > 0 ? (closes[idx] - t0Price) / t0Price : null,
      vsCheckpoint: price > 0 ? (closes[idx] - price) / price : null,
    }
  }
  let minAfter = null
  let peakAfter = false
  let entryAfter = false
  for (let k = checkpointIdx + 1; k <= end && k < closes.length; k++) {
    if (minAfter == null || closes[k] < minAfter) minAfter = closes[k]
    if (closes[k] + EPS >= peak) peakAfter = true
    if (closes[k] + EPS >= entry) entryAfter = true
  }
  const hasAfter = minAfter != null
  return {
    t10: at(10),
    t20: at(20),
    t40: at(40),
    windowEnd:
      end > checkpointIdx
        ? {
            vsEntry: (closes[end] - entry) / entry,
            vsT0: t0Price > 0 ? (closes[end] - t0Price) / t0Price : null,
            vsCheckpoint: price > 0 ? (closes[end] - price) / price : null,
          }
        : null,
    peakAfter: hasAfter ? peakAfter : null,
    entryAfter: hasAfter ? entryAfter : null,
    subsequentDd: hasAfter && price > 0 ? Math.max(0, (price - minAfter) / price) : null,
  }
}

function clock(rows, key) {
  const present = rows.filter((row) => row.outcomes?.[key])
  const values = present.map((row) => row.outcomes[key].vsEntry)
  const mark = gate(present.length)
  return {
    n: present.length,
    avg: pct(mean(values)),
    median: pct(median(values)),
    win_rate: round2(share(values.map((value) => value > 0))),
    ...mark,
  }
}

export function summarizeSnapshots(rows) {
  const withAfter = rows.filter((row) => row.outcomes?.subsequentDd != null)
  const mark = gate(rows.length)
  return {
    n: rows.length,
    ...mark,
    t10: clock(rows, "t10"),
    t20: clock(rows, "t20"),
    t40: clock(rows, "t40"),
    window_end: clock(rows, "windowEnd"),
    peak_recovery_rate: round2(share(withAfter.map((row) => row.outcomes.peakAfter === true))),
    entry_recovery_rate: round2(share(withAfter.map((row) => row.outcomes.entryAfter === true))),
    avg_subsequent_drawdown: pct(mean(withAfter.map((row) => row.outcomes.subsequentDd))),
    median_subsequent_drawdown: pct(median(withAfter.map((row) => row.outcomes.subsequentDd))),
    peak_n: withAfter.length,
  }
}

function rate(rows, pick) {
  return round2(share(rows.map(pick)))
}

function analysisA(slow) {
  return CHECKPOINTS.map((offset) => {
    const rows = slow.filter((row) => row.points[offset])
    const state = (key) => rows.map((row) => row.points[offset][key])
    return {
      checkpoint: `T+${offset}`,
      n: rows.length,
      ...gate(rows.length),
      additional_3: rate(rows, (row) => row.points[offset].dd3),
      additional_5: rate(rows, (row) => row.points[offset].dd5),
      additional_7: rate(rows, (row) => row.points[offset].dd7),
      additional_10: rate(rows, (row) => row.points[offset].dd10),
      at_or_below_entry: rate(rows, (row) => row.points[offset].entryPosition === "AT_OR_BELOW_ENTRY"),
      rebound_3: rate(rows, (row) => row.points[offset].reb3),
      rebound_5: rate(rows, (row) => row.points[offset].reb5),
      rebound_7: rate(rows, (row) => row.points[offset].reb7),
      rebound_10: rate(rows, (row) => row.points[offset].reb10),
      rebreak: rate(rows, (row) => row.points[offset].rebreak),
      avg_additional_mae: pct(mean(state("additionalMae"))),
      avg_max_rebound: pct(mean(state("maxRebound"))),
    }
  })
}

function pair(rows, label) {
  return { label, ...summarizeSnapshots(rows) }
}

function analysisB(slow) {
  const out = []
  for (const offset of CHECKPOINTS) {
    const ready = pointsAt(slow, offset)
    for (const level of [3, 5, 7]) {
      const key = `dd${level}`
      out.push({
        checkpoint: `T+${offset}`,
        rule: `additional>=${level}`,
        hit: pair(ready.filter((row) => row[key]), "hit"),
        miss: pair(ready.filter((row) => !row[key]), "miss"),
      })
    }
  }
  return out
}

function pointsAt(rows, offset, pred = () => true) {
  return rows.filter((row) => row.points[offset] && pred(row.points[offset])).map((row) => row.points[offset])
}

function analysisC(slow) {
  const specs = [
    ["A", "SLOW + additional < 5%", (state) => !state.dd5],
    ["B", "SLOW + additional >= 5%", (state) => state.dd5],
    ["C", "SLOW + at or below entry", (state) => state.entryPosition === "AT_OR_BELOW_ENTRY"],
    ["D", "SLOW + above entry", (state) => state.entryPosition === "ABOVE_ENTRY"],
    ["E", "SLOW + rebound >= 5%", (state) => state.reb5],
    ["F", "SLOW + rebound < 5%", (state) => !state.reb5],
  ]
  return specs.map(([id, label, pred]) => ({ id, ...pair(pointsAt(slow, 5, pred), label) }))
}

function analysisD(slow) {
  const specs = [
    ["D1", "SLOW + T+5 additional >= 5%", (state) => state.dd5],
    ["D2", "SLOW + T+5 additional >= 7%", (state) => state.dd7],
    ["D3", "SLOW + T+5 at or below entry", (state) => state.entryPosition === "AT_OR_BELOW_ENTRY"],
    ["D4", "SLOW + T+5 additional >= 5% and at or below entry", (state) => state.dd5 && state.entryPosition === "AT_OR_BELOW_ENTRY"],
    ["D5", "SLOW + T+5 additional < 5% and above entry", (state) => !state.dd5 && state.entryPosition === "ABOVE_ENTRY"],
  ]
  return specs.map(([id, label, pred]) => ({ id, ...pair(pointsAt(slow, 5, pred), label) }))
}

function analysisE(fast) {
  return [
    pair(pointsAt(fast, 5, (state) => state.dd5), "FAST + T+5 additional >= 5%"),
    pair(pointsAt(fast, 5, (state) => !state.dd5), "FAST + T+5 additional < 5%"),
  ]
}

function horizonVerdict(left, right, key) {
  const a = left[key]
  const b = right[key]
  if (!a || !b || a.n < 10 || b.n < 10) {
    return { status: "withheld", left_n: a?.n ?? 0, right_n: b?.n ?? 0, left_avg: a?.avg ?? null, right_avg: b?.avg ?? null }
  }
  return {
    status: a.avg < b.avg ? "lower" : "not_lower",
    left_n: a.n,
    right_n: b.n,
    left_avg: a.avg,
    right_avg: b.avg,
    left_win: a.win_rate,
    right_win: b.win_rate,
  }
}

function questions(study) {
  const byId = Object.fromEntries(study.analysisC.map((row) => [row.id, row]))
  const byD = Object.fromEntries(study.analysisD.map((row) => [row.id, row]))
  const fastHit = study.analysisE[0]
  const fastMiss = study.analysisE[1]
  const q1t20 = horizonVerdict(byId.B, byId.A, "t20")
  const q1end = horizonVerdict(byId.B, byId.A, "window_end")
  const q2t20 = horizonVerdict(byId.C, byId.D, "t20")
  const q2end = horizonVerdict(byId.C, byId.D, "window_end")
  const q4t20 = horizonVerdict(fastHit, fastMiss, "t20")
  const q4end = horizonVerdict(fastHit, fastMiss, "window_end")
  const combo = horizonVerdict(byD.D4, byD.D5, "window_end")
  const singleDd = q1end
  const singleEntry = q2end
  let q3 = { status: "withheld" }
  if (combo.status !== "withheld" && singleDd.status !== "withheld" && singleEntry.status !== "withheld") {
    const comboGap = combo.right_avg - combo.left_avg
    const ddGap = singleDd.right_avg - singleDd.left_avg
    const entryGap = singleEntry.right_avg - singleEntry.left_avg
    q3 = {
      status: comboGap > ddGap && comboGap > entryGap ? "stronger" : "not_stronger",
      combo_gap: round2(comboGap),
      additional_gap: round2(ddGap),
      entry_gap: round2(entryGap),
    }
  }
  const slowEnd = q1end
  const fastEnd = q4end
  let q5 = { status: "withheld", t20: q1t20.status === "withheld" || q4t20.status === "withheld" ? "withheld" : "comparable" }
  if (slowEnd.status !== "withheld" && fastEnd.status !== "withheld") {
    const slowGap = slowEnd.right_avg - slowEnd.left_avg
    const fastGap = fastEnd.right_avg - fastEnd.left_avg
    let relation = "similar_additional_drawdown_effect"
    if (slowGap > 0 && fastGap <= 0) relation = "slow_interaction"
    else if (fastGap > 0 && slowGap <= 0) relation = "fast_interaction"
    else if (slowGap > 0 && fastGap > 0 && slowGap > fastGap + 5) relation = "slow_gap_larger"
    q5 = { status: relation, slow_gap: round2(slowGap), fast_gap: round2(fastGap), t20: q1t20.status === "withheld" ? "withheld" : "shown" }
  }
  return {
    Q1: { t20: q1t20, window_end: q1end },
    Q2: { t20: q2t20, window_end: q2end },
    Q3: q3,
    Q4: { t20: q4t20, window_end: q4end },
    Q5: q5,
  }
}

export function buildV8(parts, closesBySymbol) {
  const events = []
  for (const part of parts) {
    const closes = closesBySymbol.get(part.symbol)
    for (const event of part.profit["p10-d10"]) {
      if (!event.event) continue
      const described = describeCorrection(closes, locateProfitCorrection(closes, event.entryIdx, 60, 0.1, 0.1))
      if (!described.event || described.t0 !== event.t0 || described.speedDays !== event.speedDays) {
        throw new Error(`v8 correction day does not match v6 for ${part.symbol} entry ${event.entryIdx}`)
      }
      events.push({ etf: part.symbol, described })
    }
  }
  const cuts = speedCuts(events.map((row) => row.described.speedDays))
  const snaps = events.map((row) => {
    const speed = speedBucket(row.described.speedDays, cuts)
    const points = {}
    for (const offset of CHECKPOINTS) {
      const idx = row.described.t0 + offset
      if (idx > row.described.end) {
        points[offset] = null
        continue
      }
      points[offset] = {
        ...observeThrough(closesBySymbol.get(row.etf), row.described.t0, row.described.t0Price, row.described.entry, idx),
        outcomes: outcomesAfter(closesBySymbol.get(row.etf), row.described, idx),
      }
    }
    return { etf: row.etf, speed, speedDays: row.described.speedDays, points }
  })
  const count = (name) => snaps.filter((row) => row.speed === name).length
  const slow = snaps.filter((row) => row.speed === "SLOW")
  const fast = snaps.filter((row) => row.speed === "FAST")
  const study = {
    selectedStrategy: null,
    events: snaps.length,
    cuts,
    counts: { FAST: count("FAST"), NORMAL: count("NORMAL"), SLOW: count("SLOW") },
    analysisA: analysisA(slow),
    analysisB: analysisB(slow),
    analysisC: analysisC(slow),
    analysisD: analysisD(slow),
    analysisE: analysisE(fast),
    interaction: ["FAST", "NORMAL", "SLOW"].flatMap((speed) => {
      const mine = snaps.filter((row) => row.speed === speed)
      return [
        { speed, ...pair(pointsAt(mine, 5, (state) => state.dd5), `${speed} + T+5 additional >= 5%`) },
        { speed, ...pair(pointsAt(mine, 5, (state) => !state.dd5), `${speed} + T+5 additional < 5%`) },
      ]
    }),
  }
  study.questions = questions(study)
  return study
}
