/**
 * Technical sell study for the 31 US growth names.
 *
 * BUY is the existing Daily Bottom Buy episode open: frozen thresholds
 * RSI<=36, Stoch %K<=15.4, BB %B<=0.01, MA20 gap<=-4.2, rising edge of
 * count>=3, no overlapping episode. This file does not retune that entry.
 *
 * SELL rules are fixed before any result is read:
 * Stochastic (14,3,3) sells on a %K/%D cross down from %K>=80, or on a
 * cross below 80 from above 80. RSI(10) sells on a cross below 50.
 * The RSI 9-period average is computed and is not a sell rule.
 * MACD is 12/26/9 and sells when the histogram crosses from >=0 to <0.
 * MA20 sells when the close crosses below the 20-day average.
 * A latch starts only on a cross after the entry, so a level that was
 * already true on the buy day is not a sell. Weekly bars are a 20/60
 * filter, not a searched parameter. DOWNTREND-only is the single filter
 * variant. UPTREND and MIXED stay in the unfiltered record.
 * Stage 3 runs only when a stage-2 rule has positive mean excess return,
 * or a drawdown at least 5 points shallower with time in market >= 0.4.
 * Stage 4 uses the same gate on stage 3. Nothing is refit on the test slice.
 *
 * selectedStrategy stays null. This is not a production sell rule.
 */

import { enrichBarsWithIndicators, rsiWilderSeries, smaSeries, stochasticSeries } from "./daily-bottom-indicators.mjs"
import { FROZEN_THRESHOLDS, buildSplitBuyEpisodes } from "./daily-bottom-split-buy-sim.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./equity-sell-research-universe.mjs"

export const SELECTED_STRATEGY = null
export const TICKERS = EQUITY_SELL_RESEARCH_UNIVERSE.map((item) => item.symbol)
export const STOCH_OVERBOUGHT = 80
export const RSI_PERIOD = 10
export const RSI_SIGNAL = 9
export const RSI_SELL_LEVEL = 50
export const MACD_PARAMS = { fast: 12, slow: 26, signal: 9 }
export const WEEKLY_MA = { fast: 20, slow: 60 }
export const OOS_SPLITS = [0.7, 0.6, 0.5]

export const SELL_JUDGMENT = {
  meaningful: "단순 기술적 SELL이 의미 있음",
  partial: "일부 종목에서만 의미 있음",
  hold: "ETF가 아니라 개별 성장주에서는 Buy & Hold가 우세",
  insufficient: "증거 부족",
}

const INDS = ["stoch", "rsi", "macd", "ma20"]
const TRIOS = [
  ["stoch", "rsi", "macd"],
  ["stoch", "rsi", "ma20"],
  ["stoch", "macd", "ma20"],
  ["rsi", "macd", "ma20"],
]
const PAIRS = [
  ["stoch", "rsi"],
  ["stoch", "macd"],
  ["stoch", "ma20"],
  ["rsi", "macd"],
  ["rsi", "ma20"],
  ["macd", "ma20"],
]

function finite(value) {
  return Number.isFinite(value)
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function mean(values) {
  const xs = values.filter(finite)
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

export function emaSeries(values, period) {
  const out = new Array(values.length).fill(null)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let sum = 0
  for (let i = 0; i < period; i += 1) sum += values[i]
  let e = sum / period
  out[period - 1] = e
  for (let i = period; i < values.length; i += 1) {
    e = values[i] * k + e * (1 - k)
    out[i] = e
  }
  return out
}

export function macdSeries(closes, params = MACD_PARAMS) {
  const fast = emaSeries(closes, params.fast)
  const slow = emaSeries(closes, params.slow)
  const macd = closes.map((_, i) => (fast[i] == null || slow[i] == null ? null : fast[i] - slow[i]))
  const signal = new Array(closes.length).fill(null)
  const hist = new Array(closes.length).fill(null)
  const k = 2 / (params.signal + 1)
  const seed = []
  let e = null
  for (let i = 0; i < macd.length; i += 1) {
    if (macd[i] == null) continue
    if (e == null) {
      seed.push(macd[i])
      if (seed.length === params.signal) {
        e = seed.reduce((sum, value) => sum + value, 0) / params.signal
        signal[i] = e
        hist[i] = macd[i] - e
      }
      continue
    }
    e = macd[i] * k + e * (1 - k)
    signal[i] = e
    hist[i] = macd[i] - e
  }
  return { macd, signal, hist }
}

function latchFromCross(onEnter, onExit) {
  const n = onEnter.length
  const state = new Array(n).fill(false)
  const edge = new Array(n).fill(false)
  let on = false
  for (let i = 0; i < n; i += 1) {
    const prev = on
    if (onEnter[i]) on = true
    else if (onExit[i]) on = false
    state[i] = on
    edge[i] = on && !prev
  }
  return { state, edge }
}

export function stochasticSell(k, d, overbought = STOCH_OVERBOUGHT) {
  const n = k.length
  const enter = new Array(n).fill(false)
  const exit = new Array(n).fill(false)
  for (let i = 1; i < n; i += 1) {
    if (![k[i], d[i], k[i - 1], d[i - 1]].every(finite)) continue
    const bearCross = k[i - 1] >= d[i - 1] && k[i] < d[i] && k[i - 1] >= overbought
    const leaveOverbought = k[i - 1] >= overbought && k[i] < overbought
    const bullCross = k[i - 1] <= d[i - 1] && k[i] > d[i]
    if (bearCross || leaveOverbought) enter[i] = true
    else if (bullCross) exit[i] = true
  }
  return latchFromCross(enter, exit)
}

export function rsiSell(rsi, level = RSI_SELL_LEVEL) {
  const n = rsi.length
  const enter = new Array(n).fill(false)
  const exit = new Array(n).fill(false)
  for (let i = 1; i < n; i += 1) {
    if (!finite(rsi[i]) || !finite(rsi[i - 1])) continue
    if (rsi[i - 1] >= level && rsi[i] < level) enter[i] = true
    else if (rsi[i - 1] < level && rsi[i] >= level) exit[i] = true
  }
  return latchFromCross(enter, exit)
}

export function histogramSell(hist) {
  const n = hist.length
  const enter = new Array(n).fill(false)
  const exit = new Array(n).fill(false)
  for (let i = 1; i < n; i += 1) {
    if (!finite(hist[i]) || !finite(hist[i - 1])) continue
    if (hist[i - 1] >= 0 && hist[i] < 0) enter[i] = true
    else if (hist[i - 1] < 0 && hist[i] >= 0) exit[i] = true
  }
  return latchFromCross(enter, exit)
}

export function maCrossSell(closes, ma) {
  const n = closes.length
  const enter = new Array(n).fill(false)
  const exit = new Array(n).fill(false)
  for (let i = 1; i < n; i += 1) {
    if (!finite(closes[i]) || !finite(ma[i]) || !finite(closes[i - 1]) || !finite(ma[i - 1])) continue
    const prevAbove = closes[i - 1] >= ma[i - 1]
    const nowBelow = closes[i] < ma[i]
    const prevBelow = closes[i - 1] < ma[i - 1]
    const nowAbove = closes[i] >= ma[i]
    if (prevAbove && nowBelow) enter[i] = true
    else if (prevBelow && nowAbove) exit[i] = true
  }
  return latchFromCross(enter, exit)
}

export function weekKey(date) {
  const [year, month, day] = date.split("-").map(Number)
  const stamp = new Date(Date.UTC(year, month - 1, day))
  const mondayOffset = (stamp.getUTCDay() + 6) % 7
  stamp.setUTCDate(stamp.getUTCDate() - mondayOffset)
  return stamp.toISOString().slice(0, 10)
}

export function weeklyStates(dates, closes) {
  const state = new Array(dates.length).fill(null)
  const done = []
  let week = null
  let weekClose = null
  for (let i = 0; i < dates.length; i += 1) {
    const key = weekKey(dates[i])
    if (week == null) week = key
    if (key !== week) {
      done.push(weekClose)
      week = key
    }
    weekClose = closes[i]
    const series = done.concat([weekClose])
    if (series.length < WEEKLY_MA.slow) continue
    const maFast = series.slice(-WEEKLY_MA.fast).reduce((sum, value) => sum + value, 0) / WEEKLY_MA.fast
    const maSlow = series.slice(-WEEKLY_MA.slow).reduce((sum, value) => sum + value, 0) / WEEKLY_MA.slow
    if (weekClose > maFast && maFast > maSlow) state[i] = "UPTREND"
    else if (weekClose < maFast && maFast < maSlow) state[i] = "DOWNTREND"
    else state[i] = "MIXED"
  }
  return state
}

export function existingBuyIndexes(bars) {
  const enriched = enrichBarsWithIndicators(bars)
  const episodes = buildSplitBuyEpisodes(enriched, FROZEN_THRESHOLDS, {
    fromIdx: 0,
    toIdx: enriched.length,
  })
  return episodes.map((episode) => episode.openIdx)
}

export function prepareSeries(bars) {
  const dates = bars.map((bar) => bar.date)
  const closes = bars.map((bar) => bar.close)
  const stoch = stochasticSeries(bars, 14, 3, 3)
  const rsi = rsiWilderSeries(closes, RSI_PERIOD)
  const macd = macdSeries(closes)
  const ma20 = smaSeries(closes, 20)
  const signals = {
    stoch: stochasticSell(stoch.k, stoch.d),
    rsi: rsiSell(rsi),
    macd: histogramSell(macd.hist),
    ma20: maCrossSell(closes, ma20),
  }
  return {
    dates,
    closes,
    buyIndexes: existingBuyIndexes(bars),
    weekly: weeklyStates(dates, closes),
    signals,
  }
}

function yearsBetween(start, end) {
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (!finite(a) || !finite(b) || b <= a) return null
  return (b - a) / 86400000 / 365.25
}

function pathStats(closes, dates, longFlags, entryIdx) {
  let equity = 1
  let peak = 1
  let mdd = 0
  let longDays = 0
  let span = 0
  for (let i = entryIdx + 1; i < closes.length; i += 1) {
    span += 1
    if (!longFlags[i]) continue
    longDays += 1
    equity *= closes[i] / closes[i - 1]
    peak = Math.max(peak, equity)
    mdd = Math.min(mdd, equity / peak - 1)
  }
  const years = yearsBetween(dates[entryIdx], dates[closes.length - 1])
  const totalReturn = equity - 1
  const cagr = years != null && years >= 0.25 && equity > 0 ? equity ** (1 / years) - 1 : null
  return {
    totalReturn: round4(totalReturn),
    cagr: round4(cagr),
    mdd: round4(mdd),
    cagrOverMdd: finite(cagr) && mdd < 0 ? round4(cagr / Math.abs(mdd)) : null,
    timeInMarket: span > 0 ? round4(longDays / span) : null,
  }
}

export function simulate(prepared, spec, fromIdx = 0) {
  const { dates, closes, signals, weekly } = prepared
  const n = closes.length
  const buys = new Set(prepared.buyIndexes.filter((index) => index >= fromIdx && index < n))
  const longFlags = new Array(n).fill(false)
  const latched = Object.fromEntries(spec.indicators.map((name) => [name, false]))
  const trades = []
  let holding = false
  let entry = null
  let entryWeekly = null
  for (let i = fromIdx; i < n; i += 1) {
    if (!holding) {
      if (!buys.has(i)) continue
      holding = true
      entry = i
      entryWeekly = weekly[i]
      for (const name of spec.indicators) latched[name] = false
      continue
    }
    longFlags[i] = true
    for (const name of spec.indicators) {
      if (signals[name].edge[i]) latched[name] = true
      if (!signals[name].state[i]) latched[name] = false
    }
    const votes = spec.indicators.filter((name) => latched[name]).length
    const weeklyOk = spec.weekly === "none" || weekly[i] === "DOWNTREND"
    if (votes >= spec.need && weeklyOk) {
      trades.push({
        entry,
        exit: i,
        entryDate: dates[entry],
        exitDate: dates[i],
        hold: i - entry,
        ret: round4(closes[i] / closes[entry] - 1),
        weekly: weekly[i],
        entryWeekly,
        closed: true,
      })
      holding = false
      entry = null
    }
  }
  if (holding && entry != null) {
    const last = n - 1
    trades.push({
      entry,
      exit: last,
      entryDate: dates[entry],
      exitDate: dates[last],
      hold: last - entry,
      ret: round4(closes[last] / closes[entry] - 1),
      weekly: null,
      entryWeekly,
      closed: false,
    })
  }
  const first = prepared.buyIndexes.find((index) => index >= fromIdx && index < n)
  if (first == null) return null
  const bhFlags = new Array(n).fill(false)
  for (let i = first + 1; i < n; i += 1) bhFlags[i] = true
  const strategy = pathStats(closes, dates, longFlags, first)
  const hold = pathStats(closes, dates, bhFlags, first)
  strategy.upsideCapture = finite(hold.totalReturn) && hold.totalReturn !== 0
    ? round4(strategy.totalReturn / hold.totalReturn)
    : null
  const closed = trades.filter((trade) => trade.closed)
  const missed = []
  for (const trade of closed) {
    let next = n - 1
    for (const index of prepared.buyIndexes) {
      if (index > trade.exit) {
        next = index
        break
      }
    }
    let maxClose = closes[trade.exit]
    for (let i = trade.exit; i <= next; i += 1) maxClose = Math.max(maxClose, closes[i])
    missed.push(maxClose / closes[trade.exit] - 1)
  }
  const byState = {}
  for (const state of ["UPTREND", "DOWNTREND", "MIXED"]) {
    const rows = closed.filter((trade) => trade.weekly === state)
    byState[state] = { trades: rows.length, meanReturn: round4(mean(rows.map((trade) => trade.ret))) }
  }
  return {
    trades: closed.length,
    open: trades.some((trade) => !trade.closed),
    winRate: closed.length ? round4(closed.filter((trade) => trade.ret > 0).length / closed.length) : null,
    avgHold: round4(mean(closed.map((trade) => trade.hold))),
    missedUpside: round4(mean(missed)),
    byState,
    strategy,
    hold,
    beat: finite(strategy.totalReturn) && finite(hold.totalReturn) && strategy.totalReturn > hold.totalReturn,
    excessReturn: finite(strategy.totalReturn) && finite(hold.totalReturn)
      ? round4(strategy.totalReturn - hold.totalReturn)
      : null,
    excessCagr: finite(strategy.cagr) && finite(hold.cagr) ? round4(strategy.cagr - hold.cagr) : null,
    mddBetter: finite(strategy.mdd) && finite(hold.mdd) && strategy.mdd > hold.mdd,
  }
}

function specList(stage) {
  const weekly = ["none", "downtrend"]
  const make = (id, indicators, need, mode, stageNo) => ({
    id, stage: stageNo, indicators, need, weekly: mode,
    complexity: indicators.length + (mode === "downtrend" ? 0.5 : 0),
  })
  if (stage === 1) {
    return INDS.flatMap((name) => weekly.map((mode) => make(`s1-${name}-${mode}`, [name], 1, mode, 1)))
  }
  if (stage === 2) {
    return [4, 3, 2].flatMap((need) => weekly.map((mode) => make(`s2-vote${need}-${mode}`, INDS, need, mode, 2)))
  }
  if (stage === 3) {
    return TRIOS.flatMap((names) => weekly.map((mode) => make(`s3-${names.join("-")}-${mode}`, names, names.length, mode, 3)))
  }
  return PAIRS.flatMap((names) => weekly.map((mode) => make(`s4-${names.join("-")}-${mode}`, names, names.length, mode, 4)))
}

function summarize(spec, rows) {
  const present = rows.filter(Boolean)
  const wins = present.filter((row) => row.beat).length
  const summary = {
    id: spec.id,
    stage: spec.stage,
    indicators: spec.indicators,
    need: spec.need,
    weekly: spec.weekly,
    complexity: spec.complexity,
    tickers: present.length,
    tickerWins: wins,
    tickerWinRate: present.length ? round4(wins / present.length) : null,
    meanCagr: round4(mean(present.map((row) => row.strategy.cagr))),
    meanBhCagr: round4(mean(present.map((row) => row.hold.cagr))),
    meanMdd: round4(mean(present.map((row) => row.strategy.mdd))),
    meanBhMdd: round4(mean(present.map((row) => row.hold.mdd))),
    meanExcessReturn: round4(mean(present.map((row) => row.excessReturn))),
    meanExcessCagr: round4(mean(present.map((row) => row.excessCagr))),
    meanTrades: round4(mean(present.map((row) => row.trades))),
    meanTimeInMarket: round4(mean(present.map((row) => row.strategy.timeInMarket))),
    meanUpsideCapture: round4(mean(present.map((row) => row.strategy.upsideCapture))),
    meanMissedUpside: round4(mean(present.map((row) => row.missedUpside))),
    meanHoldDays: round4(mean(present.map((row) => row.avgHold))),
    meanWinRate: round4(mean(present.map((row) => row.winRate))),
  }
  summary.cagrOverMdd = finite(summary.meanCagr) && finite(summary.meanMdd) && summary.meanMdd < 0
    ? round4(summary.meanCagr / Math.abs(summary.meanMdd))
    : null
  summary.bhCagrOverMdd = finite(summary.meanBhCagr) && finite(summary.meanBhMdd) && summary.meanBhMdd < 0
    ? round4(summary.meanBhCagr / Math.abs(summary.meanBhMdd))
    : null
  summary.mddImprovement = finite(summary.meanMdd) && finite(summary.meanBhMdd)
    ? round4(summary.meanMdd - summary.meanBhMdd)
    : null
  return summary
}

function gateOpen(summaries) {
  return summaries.some((row) => {
    const excess = row.meanExcessReturn
    const draw = row.mddImprovement
    return (finite(excess) && excess > 0) || (finite(draw) && draw >= 0.05 && finite(row.meanTimeInMarket) && row.meanTimeInMarket >= 0.4)
  })
}

function clears(summary, oos) {
  const positive = oos.filter((row) => row && row.tickers >= 10 && finite(row.meanExcessCagr) && row.meanExcessCagr > 0).length
  return positive >= 2
    && finite(summary.mddImprovement) && summary.mddImprovement > 0
    && summary.tickerWins >= 16
    && finite(summary.meanTimeInMarket) && summary.meanTimeInMarket >= 0.5
    && finite(summary.meanTrades) && summary.meanTrades >= 1
}

function partial(summary, oos) {
  const positive = oos.filter((row) => row && row.tickers >= 10 && finite(row.meanExcessCagr) && row.meanExcessCagr > 0).length
  return positive >= 2
    && finite(summary.mddImprovement) && summary.mddImprovement > 0
    && summary.tickerWins >= 8
    && summary.tickerWins < 16
}

export function judgeSell(strategies) {
  const covered = Math.max(0, ...strategies.map((row) => row.summary.tickers))
  if (covered < 20) {
    return { sell: SELL_JUDGMENT.insufficient, buy: "C", winner: null }
  }
  const cleared = strategies.filter((row) => clears(row.summary, row.oos))
  if (cleared.length) {
    cleared.sort((a, b) => a.summary.complexity - b.summary.complexity || (b.summary.meanExcessCagr ?? -Infinity) - (a.summary.meanExcessCagr ?? -Infinity))
    return { sell: SELL_JUDGMENT.meaningful, buy: "A", winner: cleared[0].summary.id }
  }
  const some = strategies.filter((row) => partial(row.summary, row.oos))
  if (some.length) {
    some.sort((a, b) => b.summary.tickerWins - a.summary.tickerWins || a.summary.complexity - b.summary.complexity)
    return { sell: SELL_JUDGMENT.partial, buy: "B", winner: some[0].summary.id }
  }
  return { sell: SELL_JUDGMENT.hold, buy: "B", winner: null }
}

function runSpecs(preparedByTicker, specs, fromIdx = 0) {
  return specs.map((spec) => {
    const byTicker = {}
    for (const [symbol, prepared] of preparedByTicker) {
      byTicker[symbol] = simulate(prepared, spec, fromIdx)
    }
    return { spec, byTicker, summary: summarize(spec, Object.values(byTicker)) }
  })
}

function oosFor(preparedByTicker, spec) {
  return OOS_SPLITS.map((ratio) => {
    const rows = []
    for (const prepared of preparedByTicker.values()) {
      const start = Math.floor(prepared.closes.length * ratio)
      rows.push(simulate(prepared, spec, start))
    }
    const summary = summarize(spec, rows)
    return {
      split: ratio,
      tickers: summary.tickers,
      meanExcessCagr: summary.meanExcessCagr,
      meanExcessReturn: summary.meanExcessReturn,
      meanMdd: summary.meanMdd,
      meanBhMdd: summary.meanBhMdd,
      tickerWins: summary.tickerWins,
      meanTimeInMarket: summary.meanTimeInMarket,
      meanTrades: summary.meanTrades,
      meanUpsideCapture: summary.meanUpsideCapture,
    }
  })
}

export function auditLookAhead(bars) {
  if (bars.length < 80) return 0
  const full = prepareSeries(bars)
  const cut = bars.length - 15
  const part = prepareSeries(bars.slice(0, cut))
  const i = cut - 1
  let violations = 0
  if (part.weekly[i] !== full.weekly[i]) violations += 1
  for (const name of INDS) {
    if (part.signals[name].edge[i] !== full.signals[name].edge[i]) violations += 1
    if (part.signals[name].state[i] !== full.signals[name].state[i]) violations += 1
  }
  const fullBuys = new Set(full.buyIndexes.filter((index) => index < cut))
  for (const index of part.buyIndexes) if (!fullBuys.has(index)) violations += 1
  if (part.buyIndexes.length !== fullBuys.size) violations += 1
  return violations
}

function compactTicker(row) {
  if (!row) return null
  return {
    trades: row.trades,
    winRate: row.winRate,
    avgHold: row.avgHold,
    missedUpside: row.missedUpside,
    beat: row.beat,
    excessReturn: row.excessReturn,
    excessCagr: row.excessCagr,
    cagr: row.strategy.cagr,
    bhCagr: row.hold.cagr,
    mdd: row.strategy.mdd,
    bhMdd: row.hold.mdd,
    totalReturn: row.strategy.totalReturn,
    bhTotalReturn: row.hold.totalReturn,
    timeInMarket: row.strategy.timeInMarket,
    upsideCapture: row.strategy.upsideCapture,
    byState: row.byState,
  }
}

export function study(series) {
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  if (TICKERS.length !== 31 || new Set(TICKERS).size !== 31) throw new Error("universe drifted")
  const symbols = series.map((item) => item.symbol)
  if (symbols.join() !== TICKERS.join()) throw new Error("ticker order drifted")
  const preparedByTicker = new Map()
  let lookAhead = 0
  const buyCounts = {}
  for (const item of series) {
    const prepared = prepareSeries(item.bars)
    preparedByTicker.set(item.symbol, prepared)
    buyCounts[item.symbol] = prepared.buyIndexes.length
    lookAhead += auditLookAhead(item.bars)
  }
  const stage1 = specList(1)
  const stage2 = specList(2)
  const ran = [...runSpecs(preparedByTicker, stage1), ...runSpecs(preparedByTicker, stage2)]
  const stage2Open = gateOpen(ran.filter((row) => row.spec.stage === 2).map((row) => row.summary))
  const stage3 = stage2Open ? specList(3) : []
  if (stage3.length) ran.push(...runSpecs(preparedByTicker, stage3))
  const stage3Open = stage3.length ? gateOpen(ran.filter((row) => row.spec.stage === 3).map((row) => row.summary)) : false
  const stage4 = stage3Open ? specList(4) : []
  if (stage4.length) ran.push(...runSpecs(preparedByTicker, stage4))
  const strategies = ran.map((row) => {
    const oos = oosFor(preparedByTicker, row.spec)
    const byTicker = {}
    for (const symbol of TICKERS) byTicker[symbol] = compactTicker(row.byTicker[symbol])
    return { summary: row.summary, oos, byTicker }
  })
  const judgment = judgeSell(strategies)
  const focus = ["NVDA", "AMD", "AVGO", "MSFT", "AAPL", "TSLA", "PLTR", "CRWD"]
  return {
    selectedStrategy: SELECTED_STRATEGY,
    buyChanged: false,
    production: { buy: false, sell: false, ui: false, api: false, db: false },
    buy: {
      source: "buildSplitBuyEpisodes rising edge of frozen count>=3",
      thresholds: FROZEN_THRESHOLDS,
      counts: buyCounts,
    },
    sellRules: {
      stoch: "14,3,3 cross down from 80 or leave 80",
      rsi: "RSI(10) cross below 50; signal 9 stored, unused",
      macd: "12/26/9 histogram cross below 0",
      ma20: "close cross below SMA20",
      weekly: "20w/60w; filter variant sells only in DOWNTREND",
      stageGate: "stage 3/4 only if a prior rule has excess return > 0, or MDD improvement >= 0.05 with time in market >= 0.4",
    },
    lookAhead: { violations: lookAhead },
    universe: TICKERS,
    stages: { stage3: stage2Open, stage4: stage3Open },
    strategies: strategies.map((row) => ({
      ...row.summary,
      oos: row.oos,
      byTicker: row.byTicker,
      focus: Object.fromEntries(focus.map((symbol) => [symbol, row.byTicker[symbol]])),
    })),
    judgment,
  }
}

export { FROZEN_THRESHOLDS }
