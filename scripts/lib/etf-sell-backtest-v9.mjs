/**
 * ETF correction-path study v9 (research only).
 *
 * Groups the v8 +10/-10 events by the additional drop already visible
 * from T+1 through T+5. Later lows do not assign the group.
 * No sell rule is selected.
 */

import { median } from "./etf-sell-backtest.mjs"
import { describeCorrection, locateProfitCorrection, speedBucket, speedCuts } from "./etf-sell-backtest-v6.mjs"
import { observeThrough, outcomesAfter } from "./etf-sell-backtest-v8.mjs"

export { observeThrough, outcomesAfter, speedBucket, speedCuts }

export const LOCKED_SPEED = Object.freeze({ fastMax: 9, slowMin: 14 })
export const PRIMARY_DROP = 0.03
const LEVEL_EPS = 1e-12
const THRESHOLDS = [0.02, 0.03, 0.04, 0.05]

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

export function furtherDrop(closes, t0Price, checkpointIdx, end, knownMae) {
  let minAfter = null
  for (let k = checkpointIdx + 1; k <= end && k < closes.length; k++) {
    if (minAfter == null || closes[k] < minAfter) minAfter = closes[k]
  }
  if (minAfter == null || !(t0Price > 0)) return null
  const futureMae = Math.max(0, (t0Price - minAfter) / t0Price)
  return Math.max(0, futureMae - knownMae)
}

function clock(rows, key) {
  const present = rows.filter((row) => row.outcomes?.[key])
  const values = present.map((row) => row.outcomes[key].vsEntry)
  return {
    n: present.length,
    avg: pct(mean(values)),
    median: pct(median(values)),
    win_rate: round2(share(values.map((value) => value > 0))),
    ...gate(present.length),
  }
}

export function summarizePaths(rows) {
  const withFuture = rows.filter((row) => row.furtherDrop != null)
  const recovered = rows.filter((row) => row.outcomes?.peakAfter != null)
  return {
    n: rows.length,
    ...gate(rows.length),
    speedMix: {
      FAST: rows.filter((row) => row.speed === "FAST").length,
      NORMAL: rows.filter((row) => row.speed === "NORMAL").length,
      SLOW: rows.filter((row) => row.speed === "SLOW").length,
    },
    t10: clock(rows, "t10"),
    t20: clock(rows, "t20"),
    t40: clock(rows, "t40"),
    window_end: clock(rows, "windowEnd"),
    entry_recovery_rate: round2(share(recovered.map((row) => row.outcomes.entryAfter === true))),
    peak_recovery_rate: round2(share(recovered.map((row) => row.outcomes.peakAfter === true))),
    avg_further_drop: pct(mean(withFuture.map((row) => row.furtherDrop))),
    median_further_drop: pct(median(withFuture.map((row) => row.furtherDrop))),
    further_3: round2(share(withFuture.map((row) => row.furtherDrop + LEVEL_EPS >= 0.03))),
    further_5: round2(share(withFuture.map((row) => row.furtherDrop + LEVEL_EPS >= 0.05))),
    further_7: round2(share(withFuture.map((row) => row.furtherDrop + LEVEL_EPS >= 0.07))),
    further_10: round2(share(withFuture.map((row) => row.furtherDrop + LEVEL_EPS >= 0.1))),
    further_n: withFuture.length,
  }
}

function labeled(rows, label) {
  return { label, ...summarizePaths(rows) }
}

function horizonLower(left, right, key) {
  const a = left[key]
  const b = right[key]
  if (!a || !b || a.n < 10 || b.n < 10 || a.avg == null || b.avg == null) {
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

function judge(study) {
  const under = study.table1.find((row) => row.label === "<3%")
  const over = study.table1.find((row) => row.label === ">=3%")
  const clocks = ["t10", "t20", "window_end"].map((key) => ({ key, ...horizonLower(over, under, key) }))
  const confirmed = clocks.every((row) => row.status === "lower")
  const h1 = confirmed ? "worse_on_t10_t20_and_window" : "not_confirmed"
  const h2 = clocks.find((row) => row.key === "window_end")
  const a1 = study.table2.find((row) => row.id === "A1")
  const b2 = study.table2.find((row) => row.id === "B2")
  const combo = horizonLower(b2, a1, "window_end")
  const base = clocks.find((row) => row.key === "window_end")
  let h3 = { status: "withheld" }
  if (combo.status !== "withheld" && base.status !== "withheld") {
    const comboGap = combo.right_avg - combo.left_avg
    const baseGap = base.right_avg - base.left_avg
    h3 = { status: comboGap > baseGap ? "clearer" : "not_clearer", combo_gap: round2(comboGap), base_gap: round2(baseGap) }
  }
  const cell = (speed, label) => study.table3.find((row) => row.speed === speed && row.label === label)
  const h4clocks = ["FAST", "NORMAL", "SLOW"].map((speed) => ({
    speed,
    ...horizonLower(cell(speed, ">=3%"), cell(speed, "<3%"), "window_end"),
  }))
  const comparable = h4clocks.filter((row) => row.status !== "withheld")
  let h4 = "withheld"
  if (comparable.length >= 2) {
    const signs = new Set(comparable.map((row) => row.status))
    h4 = signs.size === 1 ? "same_direction" : "speed_specific"
  }
  const gaps = study.table4.map((row) => {
    const hit = row.hit
    const miss = row.miss
    const end = horizonLower(hit, miss, "window_end")
    return { threshold: row.threshold, n: hit.n, status: end.status, gap: end.status === "withheld" ? null : round2(end.right_avg - end.left_avg) }
  })
  const three = gaps.find((row) => row.threshold === ">=3%")
  const others = gaps.filter((row) => row.threshold !== ">=3%" && row.status !== "withheld" && row.gap != null)
  let h5 = "withheld"
  if (three?.status === "lower" && others.length === 3) {
    h5 = others.every((row) => three.gap > row.gap + 2) ? "three_percent_stronger" : "not_special"
  }
  return { H1: { status: h1, clocks }, H2: h2, H3: h3, H4: { status: h4, speeds: h4clocks }, H5: { status: h5, gaps } }
}

export function buildV9(parts, closesBySymbol) {
  const raw = []
  for (const part of parts) {
    const closes = closesBySymbol.get(part.symbol)
    for (const event of part.profit["p10-d10"]) {
      if (!event.event) continue
      const described = describeCorrection(closes, locateProfitCorrection(closes, event.entryIdx, 60, 0.1, 0.1))
      if (!described.event || described.t0 !== event.t0 || described.speedDays !== event.speedDays) {
        throw new Error(`v9 correction day does not match v6/v8 for ${part.symbol} entry ${event.entryIdx}`)
      }
      raw.push({ etf: part.symbol, described, closes })
    }
  }
  const computed = speedCuts(raw.map((row) => row.described.speedDays))
  if (!computed || computed.fastMax !== LOCKED_SPEED.fastMax || computed.slowMin !== LOCKED_SPEED.slowMin) {
    throw new Error(`v9 speed cuts ${computed?.fastMax}/${computed?.slowMin} do not match locked 9/14`)
  }
  const ready = []
  let missingT5 = 0
  for (const row of raw) {
    const idx = row.described.t0 + 5
    if (idx > row.described.end) {
      missingT5 += 1
      continue
    }
    const state = observeThrough(row.closes, row.described.t0, row.described.t0Price, row.described.entry, idx)
    ready.push({
      etf: row.etf,
      speed: speedBucket(row.described.speedDays, LOCKED_SPEED),
      mae: state.additionalMae,
      entryPosition: state.entryPosition,
      outcomes: outcomesAfter(row.closes, row.described, idx),
      furtherDrop: furtherDrop(row.closes, row.described.t0Price, idx, row.described.end, state.additionalMae),
    })
  }
  const over = (level) => ready.filter((row) => row.mae + LEVEL_EPS >= level)
  const under = (level) => ready.filter((row) => row.mae + LEVEL_EPS < level)
  const above = (row) => row.entryPosition === "ABOVE_ENTRY"
  const below = (row) => row.entryPosition === "AT_OR_BELOW_ENTRY"
  const study = {
    selectedStrategy: null,
    events: raw.length,
    withT5: ready.length,
    missingT5,
    counts: {
      FAST: raw.filter((row) => speedBucket(row.described.speedDays, LOCKED_SPEED) === "FAST").length,
      NORMAL: raw.filter((row) => speedBucket(row.described.speedDays, LOCKED_SPEED) === "NORMAL").length,
      SLOW: raw.filter((row) => speedBucket(row.described.speedDays, LOCKED_SPEED) === "SLOW").length,
    },
    table1: [labeled(under(PRIMARY_DROP), "<3%"), labeled(over(PRIMARY_DROP), ">=3%")],
    table2: [
      { id: "A1", ...labeled(under(PRIMARY_DROP).filter(above), "<3% + above entry") },
      { id: "A2", ...labeled(under(PRIMARY_DROP).filter(below), "<3% + at or below entry") },
      { id: "B1", ...labeled(over(PRIMARY_DROP).filter(above), ">=3% + above entry") },
      { id: "B2", ...labeled(over(PRIMARY_DROP).filter(below), ">=3% + at or below entry") },
    ],
    table3: ["FAST", "NORMAL", "SLOW"].flatMap((speed) => {
      const mine = ready.filter((row) => row.speed === speed)
      return [
        { ...labeled(mine.filter((row) => row.mae + LEVEL_EPS < PRIMARY_DROP), "<3%"), speed },
        { ...labeled(mine.filter((row) => row.mae + LEVEL_EPS >= PRIMARY_DROP), ">=3%"), speed },
      ]
    }),
    table4: THRESHOLDS.map((level) => ({
      threshold: `>=${Math.round(level * 100)}%`,
      hit: labeled(over(level), `>=${Math.round(level * 100)}%`),
      miss: labeled(under(level), `<${Math.round(level * 100)}%`),
    })),
  }
  study.questions = judge(study)
  return study
}
