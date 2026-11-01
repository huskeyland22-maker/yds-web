/**
 * SOXL prior-close limit-buy study v1 (research only).
 *
 * A and B are mechanical baselines: every session T places one day order
 * for T+1 at 90% or 85% of the T close. They do not reconstruct a
 * discretionary "buy only when a crash looks likely" rule.
 *
 * C and D are not implemented.
 * selectedStrategy stays null. No sell rule is chosen.
 *
 * Fill and cost assumptions were fixed before the first run:
 * - Base: a gap (next open <= limit) fills at the open. A touch
 *   (open > limit and low <= limit) fills at the limit. No commission
 *   and no slippage.
 * - Conservative: a gap fills at the limit plus 10 bps (no price
 *   improvement). A touch is not a fill, because a daily low does not
 *   prove a tradeable print. No commission.
 * - Each T+1 order expires that session. Orders in the fill-rate table
 *   are independent, so overlapping hypothetical entries are counted.
 *   The capital path is separate: after a fill, further orders wait until
 *   the observation horizon ends. That horizon is not a sell rule.
 */

export const SELECTED_STRATEGY = null

/** Public split history used only to test whether quote prices are split-adjusted. */
export const PUBLISHED_SOXL_SPLITS = Object.freeze([
  Object.freeze({
    exDate: "2015-05-20",
    numerator: 4,
    denominator: 1,
    source: "SOXL 4-for-1 forward split, ex-date 2015-05-20",
  }),
  Object.freeze({
    exDate: "2021-03-02",
    numerator: 15,
    denominator: 1,
    source: "SOXL 15-for-1 forward split, ex-date 2021-03-02",
  }),
])

export const HORIZONS = Object.freeze([5, 20, 60])
export const LIMIT_FACTORS = Object.freeze({ A: 0.9, B: 0.85 })
export const CONSERVATIVE_SLIPPAGE = 0.001
export const COMMISSION = 0

const DAY_MS = 86400000

function round4(value) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.round(value * 10000) / 10000
}

export function median(values) {
  const xs = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!xs.length) return null
  const mid = Math.floor(xs.length / 2)
  if (xs.length % 2) return xs[mid]
  return (xs[mid - 1] + xs[mid]) / 2
}

function mean(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

function daysBetween(left, right) {
  const a = Date.parse(`${left}T00:00:00Z`)
  const b = Date.parse(`${right}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity
  return Math.abs(a - b) / DAY_MS
}

/**
 * @param {object | null | undefined} chartResult
 */
/**
 * Drop the last bar when it is the current New York session and that
 * session has not ended. A partial day is not a finished limit session.
 * @param {{ date: string }[]} bars
 * @param {number} nowMs
 * @param {number | null | undefined} regularEndUnix
 */
export function withoutOpenSession(bars, nowMs, regularEndUnix) {
  if (!Array.isArray(bars) || !bars.length) return { bars: bars || [], dropped: false, droppedDate: null }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs))
  const last = bars[bars.length - 1]
  const stillOpen = Number.isFinite(Number(regularEndUnix)) && nowMs < Number(regularEndUnix) * 1000
  if (last?.date === today && stillOpen) {
    return { bars: bars.slice(0, -1), dropped: true, droppedDate: last.date }
  }
  return { bars, dropped: false, droppedDate: null }
}

export function splitsFromChartResult(chartResult) {
  const raw = chartResult?.events?.splits
  if (!raw || typeof raw !== "object") return []
  const out = []
  for (const row of Object.values(raw)) {
    const numerator = Number(row?.numerator)
    const denominator = Number(row?.denominator)
    const unix = Number(row?.date)
    const exDate = Number.isFinite(unix) && unix > 0 ? new Date(unix * 1000).toISOString().slice(0, 10) : null
    if (!exDate || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) continue
    out.push({ exDate, numerator, denominator })
  }
  return out.sort((a, b) => a.exDate.localeCompare(b.exDate))
}

function priceFactor(split) {
  return split.denominator / split.numerator
}

function nearUnadjusted(ratio, factor) {
  return Number.isFinite(ratio) && ratio > 0 && Math.abs(ratio / factor - 1) <= 0.2
}

/**
 * Quote OHLC is split-adjusted only when each published split is present
 * and the ex-session does not jump by that split's price factor.
 * @param {{ date: string, open: number, high: number, low: number, close: number }[]} bars
 * @param {{ exDate: string, numerator: number, denominator: number }[]} yahooSplits
 */
export function confirmSplitAdjustment(bars, yahooSplits) {
  /** @type {string[]} */
  const issues = []
  /** @type {object[]} */
  const checks = []
  const listed = Array.isArray(yahooSplits) ? yahooSplits : []
  if (!listed.length) issues.push("Yahoo split events are missing")

  for (const published of PUBLISHED_SOXL_SPLITS) {
    const match = listed.find(
      (row) =>
        row.numerator === published.numerator &&
        row.denominator === published.denominator &&
        daysBetween(row.exDate, published.exDate) <= 5,
    )
    if (!match) {
      issues.push(`published split ${published.exDate} ${published.numerator}-for-${published.denominator} is missing from Yahoo`)
      continue
    }
    const idx = bars.findIndex((bar) => bar.date >= match.exDate)
    if (idx <= 0) {
      issues.push(`no session after split ${match.exDate}`)
      continue
    }
    const prevClose = bars[idx - 1].close
    const openRatio = bars[idx].open / prevClose
    const closeRatio = bars[idx].close / prevClose
    const factor = priceFactor(published)
    const unadjusted = nearUnadjusted(openRatio, factor) || nearUnadjusted(closeRatio, factor)
    const continuous = openRatio >= 0.45 && openRatio <= 1.8 && closeRatio >= 0.45 && closeRatio <= 1.8
    checks.push({
      exDate: match.exDate,
      publishedExDate: published.exDate,
      numerator: published.numerator,
      denominator: published.denominator,
      prevDate: bars[idx - 1].date,
      sessionDate: bars[idx].date,
      openRatio: round4(openRatio),
      closeRatio: round4(closeRatio),
      unadjustedPriceFactor: factor,
      continuous,
    })
    if (unadjusted || !continuous) {
      issues.push(`split ${match.exDate} does not show a continuous adjusted price`)
    }
  }

  for (const row of listed) {
    const known = PUBLISHED_SOXL_SPLITS.some(
      (published) =>
        published.numerator === row.numerator &&
        published.denominator === row.denominator &&
        daysBetween(published.exDate, row.exDate) <= 5,
    )
    if (!known) issues.push(`unexpected Yahoo split ${row.exDate} ${row.numerator}-for-${row.denominator}`)
  }

  return { confirmed: issues.length === 0, issues, checks }
}

/**
 * @param {{ date: string, open: number, high: number, low: number, close: number, volume?: number }[]} bars
 */
export function assessBars(bars) {
  /** @type {string[]} */
  const issues = []
  /** @type {string[]} */
  const warnings = []
  if (!Array.isArray(bars) || bars.length < 3) {
    return { ok: false, issues: ["fewer than 3 bars"], warnings, first: null, last: null, count: bars?.length ?? 0, duplicateDates: 0, missingOhlc: 0, largeGaps: [] }
  }
  const seen = new Set()
  let duplicateDates = 0
  let missingOhlc = 0
  /** @type {{ from: string, to: string, calendarDays: number }[]} */
  const largeGaps = []
  /** @type {{ date: string, priorDate: string, openOverPriorClose: number }[]} */
  const extremeOpens = []

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]
    if (!bar?.date || seen.has(bar.date)) duplicateDates += 1
    if (bar?.date) seen.add(bar.date)
    const fields = [bar?.open, bar?.high, bar?.low, bar?.close]
    if (fields.some((value) => !Number.isFinite(value) || value <= 0)) missingOhlc += 1
    else if (bar.high < bar.low || bar.low > bar.open || bar.low > bar.close || bar.high < bar.open || bar.high < bar.close) {
      missingOhlc += 1
    }
    if (i > 0 && bars[i - 1]?.date && bar?.date && bar.date < bars[i - 1].date) issues.push("dates are not sorted")
    if (i > 0 && bars[i - 1]?.close > 0 && bar?.open > 0) {
      const gapDays = daysBetween(bars[i - 1].date, bar.date)
      if (gapDays > 7) largeGaps.push({ from: bars[i - 1].date, to: bar.date, calendarDays: gapDays })
      const ratio = bar.open / bars[i - 1].close
      if (ratio < 0.25 || ratio > 4) {
        extremeOpens.push({ date: bar.date, priorDate: bars[i - 1].date, openOverPriorClose: round4(ratio) })
      } else if (ratio < 0.45 || ratio > 2.2) {
        warnings.push(`${bar.date} open is ${round4(ratio)} times the prior close`)
      }
    }
  }
  if (duplicateDates) issues.push(`${duplicateDates} duplicate dates`)
  if (missingOhlc) issues.push(`${missingOhlc} bars with missing or inconsistent OHLC`)
  if (largeGaps.length) issues.push(`${largeGaps.length} calendar gaps longer than 7 days`)
  if (extremeOpens.length) issues.push(`${extremeOpens.length} opens move by more than 4x versus the prior close`)

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    first: bars[0]?.date ?? null,
    last: bars.at(-1)?.date ?? null,
    count: bars.length,
    duplicateDates,
    missingOhlc,
    largeGaps,
    extremeOpens,
  }
}

/**
 * @param {number | null | undefined} close
 * @param {number | null | undefined} adjClose
 */
export function quoteDividendGap(close, adjClose) {
  if (!Number.isFinite(close) || close <= 0 || !Number.isFinite(adjClose) || adjClose <= 0) return null
  return Math.abs(adjClose / close - 1)
}

export function summarizeDividendGap(gaps) {
  const xs = (gaps || []).filter((value) => Number.isFinite(value))
  if (!xs.length) return { compared: 0, maxAbs: null, daysOver1Pct: 0 }
  return {
    compared: xs.length,
    maxAbs: round4(Math.max(...xs)),
    daysOver1Pct: xs.filter((value) => value > 0.01).length,
  }
}

function validBar(bar) {
  return bar && [bar.open, bar.high, bar.low, bar.close].every((value) => Number.isFinite(value) && value > 0)
}

/**
 * @param {{ open: number, high: number, low: number }} next
 * @param {number} limit
 */
export function classifyFill(next, limit) {
  if (!(limit > 0) || !validBar(next)) return "unfilled"
  if (next.open <= limit) return "gap"
  if (next.low <= limit) return "touch"
  return "unfilled"
}

/**
 * @param {"base" | "conservative"} mode
 * @param {"gap" | "touch" | "unfilled"} kind
 * @param {{ open: number }} next
 * @param {number} limit
 */
export function fillPrice(mode, kind, next, limit) {
  if (kind === "unfilled") return null
  if (mode === "conservative") {
    if (kind !== "gap") return null
    return limit * (1 + CONSERVATIVE_SLIPPAGE)
  }
  if (kind === "gap") return next.open
  if (kind === "touch") return limit
  return null
}

function returnStats(values) {
  const xs = values.filter((value) => Number.isFinite(value))
  return {
    n: xs.length,
    mean: round4(mean(xs)),
    median: round4(median(xs)),
    winRate: xs.length ? round4(xs.filter((value) => value > 0).length / xs.length) : null,
  }
}

/**
 * Independent day orders. The limit is the prior close times the factor.
 * Later prices never change the limit.
 * @param {{ date: string, open: number, high: number, low: number, close: number }[]} bars
 * @param {number} factor
 * @param {"base" | "conservative"} mode
 */
export function buildOrders(bars, factor, mode) {
  /** @type {object[]} */
  const orders = []
  for (let i = 0; i < bars.length - 1; i++) {
    const decision = bars[i]
    const next = bars[i + 1]
    if (!validBar(decision) || !validBar(next)) continue
    const limit = decision.close * factor
    const kind = classifyFill(next, limit)
    const price = fillPrice(mode, kind, next, limit)
    orders.push({
      decisionDate: decision.date,
      sessionDate: next.date,
      decisionIndex: i,
      sessionIndex: i + 1,
      limit,
      kind,
      filled: price != null,
      fillPrice: price,
    })
  }
  return orders
}

function horizonReturn(bars, order, horizon) {
  const idx = order.sessionIndex + horizon
  if (!order.filled || idx >= bars.length || !(order.fillPrice > 0) || !(bars[idx].close > 0)) return null
  return bars[idx].close / order.fillPrice - 1
}

function maeToHorizon(bars, order, horizon) {
  const end = order.sessionIndex + horizon
  if (!order.filled || end >= bars.length || !(order.fillPrice > 0)) return null
  let minLow = Infinity
  for (let i = order.sessionIndex; i <= end; i++) {
    if (bars[i].low < minLow) minLow = bars[i].low
  }
  if (!Number.isFinite(minLow)) return null
  return minLow / order.fillPrice - 1
}

function recoveryDays(bars, order) {
  if (!order.filled || !(order.fillPrice > 0)) return { recovered: false, days: null }
  for (let i = order.sessionIndex; i < bars.length; i++) {
    if (bars[i].close >= order.fillPrice) {
      return { recovered: true, days: i - order.sessionIndex }
    }
  }
  return { recovered: false, days: null }
}

/**
 * One position at a time. A fill is held for `horizon` sessions and then
 * marked at that close. The hold is an observation window, not a sell rule.
 * @param {object[]} orders
 * @param {{ date: string, close: number }[]} bars
 * @param {number} horizon
 */
export function observationPath(orders, bars, horizon) {
  let equity = 1
  let peak = 1
  let maxDrawdown = 0
  let cursor = -1
  let holdingDays = 0
  let trades = 0
  const bySession = new Map(orders.map((order) => [order.sessionIndex, order]))

  for (let i = 1; i < bars.length; i++) {
    if (i <= cursor) continue
    const order = bySession.get(i)
    const exit = i + horizon
    if (!order?.filled || exit >= bars.length) {
      if (equity > peak) peak = equity
      const dd = equity / peak - 1
      if (dd < maxDrawdown) maxDrawdown = dd
      continue
    }
    const shares = equity / order.fillPrice
    for (let k = i; k <= exit; k++) {
      const marked = shares * bars[k].close
      if (marked > peak) peak = marked
      const dd = marked / peak - 1
      if (dd < maxDrawdown) maxDrawdown = dd
    }
    equity = shares * bars[exit].close
    holdingDays += horizon + 1
    trades += 1
    cursor = exit
  }

  const span = Math.max(bars.length - 1, 1)
  return {
    horizon,
    trades,
    endingEquity: round4(equity),
    totalReturn: round4(equity - 1),
    maxDrawdown: round4(maxDrawdown),
    holdingDays,
    cashDays: span - holdingDays,
    utilization: round4(holdingDays / span),
  }
}

/**
 * @param {{ date: string, open: number, high: number, low: number, close: number }[]} bars
 * @param {number} factor
 * @param {"base" | "conservative"} mode
 */
export function summarizeStrategy(bars, factor, mode) {
  const orders = buildOrders(bars, factor, mode)
  const filled = orders.filter((order) => order.filled)
  const gaps = orders.filter((order) => order.kind === "gap")
  const touches = orders.filter((order) => order.kind === "touch")
  const horizons = {}
  for (const horizon of HORIZONS) {
    const returns = filled.map((order) => horizonReturn(bars, order, horizon)).filter((value) => value != null)
    const maes = filled.map((order) => maeToHorizon(bars, order, horizon)).filter((value) => value != null)
    horizons[String(horizon)] = {
      ...returnStats(returns),
      mae: {
        n: maes.length,
        mean: round4(mean(maes)),
        median: round4(median(maes)),
      },
    }
  }
  const recoveries = filled.map((order) => recoveryDays(bars, order))
  const recoveredDays = recoveries.filter((row) => row.recovered).map((row) => row.days)
  const paths = {}
  for (const horizon of HORIZONS) paths[String(horizon)] = observationPath(orders, bars, horizon)

  return {
    orders: orders.length,
    filled: filled.length,
    unfilled: orders.length - filled.length,
    fillRate: orders.length ? round4(filled.length / orders.length) : null,
    unfilledRate: orders.length ? round4((orders.length - filled.length) / orders.length) : null,
    gapCandidates: gaps.length,
    touchCandidates: touches.length,
    gapsFilled: filled.filter((order) => order.kind === "gap").length,
    touchesFilled: filled.filter((order) => order.kind === "touch").length,
    horizons,
    recovery: {
      recovered: recoveredDays.length,
      unrecovered: recoveries.filter((row) => !row.recovered).length,
      meanDays: round4(mean(recoveredDays)),
      medianDays: round4(median(recoveredDays)),
    },
    paths,
  }
}

/**
 * Close-to-close price return. Dividends are not added.
 * @param {{ close: number }[]} bars
 */
export function buyAndHoldPriceReturn(bars) {
  if (!bars?.length || !(bars[0].close > 0) || !(bars.at(-1).close > 0)) return null
  return round4(bars.at(-1).close / bars[0].close - 1)
}

/**
 * Same sessions and horizons as the limit fills. The alternative buys the
 * fill session's close instead of the limit. This is not a sell rule.
 * @param {object[]} orders from the base mode, so the sample is the base fills
 * @param {{ close: number }[]} bars
 */
export function holdFromFillClose(orders, bars) {
  const baseFills = orders.filter((order) => order.filled)
  const horizons = {}
  for (const horizon of HORIZONS) {
    const strategy = []
    const hold = []
    for (const order of baseFills) {
      const idx = order.sessionIndex + horizon
      if (idx >= bars.length || !(order.fillPrice > 0) || !(bars[order.sessionIndex].close > 0)) continue
      strategy.push(bars[idx].close / order.fillPrice - 1)
      hold.push(bars[idx].close / bars[order.sessionIndex].close - 1)
    }
    horizons[String(horizon)] = {
      n: strategy.length,
      limitMean: round4(mean(strategy)),
      sameDayCloseMean: round4(mean(hold)),
      meanDifference: round4(mean(strategy.map((value, index) => value - hold[index]))),
    }
  }
  return horizons
}
